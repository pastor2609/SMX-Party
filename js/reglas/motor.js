// =====================================================================
//  motor.js — El "árbitro" de la partida (SOLO se ejecuta en el host)
// ---------------------------------------------------------------------
//  El host es la autoridad: guarda el estado real de la partida, decide
//  los dados, mueve las fichas y aplica las casillas. Los demás
//  jugadores solo le mandan ACCIONES ("quiero tirar el dado", "elijo
//  este camino"...) y reciben el ESTADO actualizado para dibujarlo.
//
//  Acciones que entiende:
//    'tirarDado'  -> el jugador del turno tira el dado
//    'elegir'     -> responde a una pregunta (bifurcación, tienda)
//                    datos: { opcion }
//    'saltar'     -> saltar animaciones del turno actual
//    'continuar'  -> (host) cerrar la pantalla de resultados del minijuego
//    'puntuacion' -> puntos de un minijuego de puntuación { puntos }
//
//  Además, durante los minijuegos de tiempo real llegan los controles
//  de cada jugador por recibirEntrada().
// =====================================================================

import { CONFIG } from './config.js';
import { CASILLAS, CASILLA_SALIDA, CANDIDATAS_ESTRELLA } from '../tablero/datos-tablero.js';
import {
  azar, elegirAlAzar, cambiarMonedas, jugadoresActivos,
  efectoAzul, efectoRoja, efectoEvento,
} from './casillas.js';
import { MINIJUEGOS, elegirMinijuegoAlAzar } from '../minijuegos/registro.js';
import { SesionTiempoRealHost } from '../minijuegos/tiempo-real/host.js';
import { SesionPuntuacionHost } from '../minijuegos/puntuacion/host.js';

/** Baraja una lista (orden aleatorio). */
function barajar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export class MotorPartida {
  /**
   * @param {object} opciones
   *   jugadores  -> [{ id, nombre, color }]
   *   rondas     -> número de rondas
   *   idHost     -> id del host (puede cerrar el minijuego)
   *   emitir     -> fn(estado): enviar el estado a todos
   *   avisar     -> fn(texto): mostrar un aviso a todos
   *   emitirTiempoReal -> fn(instantanea): fotos de los minijuegos
   *                       de tiempo real (20 por segundo)
   *   minijuegoDePrueba -> (opcional) id de un minijuego para jugar
   *                        SOLO ese minijuego, sin tablero
   */
  constructor({ jugadores, rondas, idHost, emitir, avisar, emitirTiempoReal, minijuegoDePrueba }) {
    this.idHost = idHost;
    this._emitir = emitir;
    this._avisar = avisar;
    this._emitirTiempoReal = emitirTiempoReal;
    this.minijuegoDePrueba = minijuegoDePrueba || null;
    this.sesion = null;         // minijuego en marcha (si lo hay)
    this._ultimoMinijuego = null;
    this._seq = 0;              // contador para identificar cada pregunta/dado
    this._pendiente = null;     // acción que estamos esperando
    this._despertar = null;     // para cortar una pausa al saltar
    this.saltando = false;
    this.detenido = false;

    const fichas = {};
    for (const j of jugadores) {
      fichas[j.id] = {
        id: j.id,
        nombre: j.nombre,
        color: j.color,
        monedas: CONFIG.MONEDAS_INICIALES,
        estrellas: 0,
        casilla: CASILLA_SALIDA,
        conectado: true,
        dadosExtra: 0,
      };
    }

    // ESTE es el estado que se envía a todos los navegadores
    this.estado = {
      fase: 'turno',          // 'turno' | 'minijuego' | 'fin'
      subfase: null,          // 'esperandoDado' | 'dado' | 'moviendo' | 'efecto'
      ronda: 0,
      rondasTotales: rondas,
      orden: barajar(jugadores.map((j) => j.id)),
      jugadores: fichas,
      turnoDe: null,
      dado: null,             // { valores, total, seq }
      pasosRestantes: 0,
      limiteDado: null,       // { seq, ms } cuenta atrás para tirar
      decision: null,         // { seq, jugadorId, tipo, texto, opciones, ms }
      casillaEstrella: elegirAlAzar(CANDIDATAS_ESTRELLA),
      rapido: false,          // true si se están saltando las animaciones
      minijuego: null,        // { instancia, id, etapa, seq, ms, participantes, resultados }
      clasificacion: null,    // al final de la partida
      ganadores: null,
      motivoFin: null,
    };
  }

  // ===================================================================
  //  Comunicación con el exterior
  // ===================================================================

  _enviar() { if (!this.detenido) this._emitir(this.estado); }

  /** Llega una acción de un jugador (la llama anfitrion.js). */
  recibirAccion(idJugador, accion, datos) {
    if (this.detenido) return;

    if (accion === 'saltar') {
      // Solo en el tablero, y solo el jugador del turno o el host
      const enTablero = this.estado.fase === 'turno';
      if (enTablero && (idJugador === this.estado.turnoDe || idJugador === this.idHost)) this._saltar();
      return;
    }

    if (accion === 'puntuacion') {
      if (this.sesion && this.sesion.recibirPuntuacion) {
        this.sesion.recibirPuntuacion(idJugador, datos && datos.puntos);
      }
      return;
    }

    const p = this._pendiente;
    if (p && p.jugadorId === idJugador && p.accion === accion) {
      p.terminar(datos || {});
    }
  }

  /** Controles de un jugador durante un minijuego de tiempo real. */
  recibirEntrada(idJugador, entrada) {
    if (this.sesion && this.sesion.recibirEntrada) this.sesion.recibirEntrada(idJugador, entrada);
  }

  /** Un jugador se ha ido: la partida sigue sin él. */
  jugadorDesconectado(idJugador) {
    const j = this.estado.jugadores[idJugador];
    if (!j || !j.conectado) return;
    j.conectado = false;
    this._avisar(`🔌 ${j.nombre} se ha desconectado. La partida continúa sin esa ficha.`);
    // Si era su turno, lo terminamos rápido
    if (this.estado.turnoDe === idJugador) this._saltar();
    // En un minijuego cuenta como eliminado
    if (this.sesion) this.sesion.jugadorDesconectado(idJugador);
    if (this._pendiente && this._pendiente.jugadorId === idJugador) this._pendiente.terminar(null);
    this._enviar();
  }

  /** Para la partida (por ejemplo si el host vuelve a la sala). */
  detener() {
    this.detenido = true;
    if (this.sesion) this.sesion.cancelar();
    if (this._pendiente) this._pendiente.terminar(null);
    if (this._despertar) this._despertar();
  }

  // ===================================================================
  //  Herramientas para esperar
  // ===================================================================

  /** Pausa de "ms" milisegundos que se corta si alguien salta. */
  esperar(ms) {
    if (this.saltando || this.detenido) return Promise.resolve();
    return new Promise((resolver) => {
      const temporizador = setTimeout(() => fin(), ms);
      const fin = () => {
        clearTimeout(temporizador);
        this._despertar = null;
        resolver();
      };
      this._despertar = fin;
    });
  }

  /**
   * Espera a que un jugador concreto haga una acción concreta.
   * Devuelve los datos de la acción, o null si se acabó el tiempo
   * o el jugador se desconectó.
   */
  esperarAccion(jugadorId, accion, ms) {
    const j = this.estado.jugadores[jugadorId];
    if (this.detenido || (j && !j.conectado)) return Promise.resolve(null);
    return new Promise((resolver) => {
      const temporizador = setTimeout(() => terminar(null), ms);
      const terminar = (valor) => {
        clearTimeout(temporizador);
        this._pendiente = null;
        resolver(valor);
      };
      this._pendiente = { jugadorId, accion, terminar };
    });
  }

  /**
   * Hace una pregunta a un jugador con varias opciones y tiempo límite.
   * Devuelve el id de la opción elegida (o la opción por defecto).
   */
  async preguntar(jugadorId, tipo, texto, opciones, ms, porDefecto) {
    this.estado.decision = { seq: ++this._seq, jugadorId, tipo, texto, opciones, ms };
    this._enviar();
    const respuesta = await this.esperarAccion(jugadorId, 'elegir', ms);
    this.estado.decision = null;
    const valida = respuesta && opciones.some((o) => o.id === respuesta.opcion);
    return valida ? respuesta.opcion : porDefecto;
  }

  _saltar() {
    if (this.saltando) return;
    this.saltando = true;
    this.estado.rapido = true;
    if (this._despertar) this._despertar();
    this._enviar();
  }

  /** ¿Hay que acabar ya? (menos de 2 jugadores conectados) */
  _debeTerminar() {
    if (this.detenido) return true;
    const minimo = this.minijuegoDePrueba ? 1 : CONFIG.MIN_JUGADORES;
    if (jugadoresActivos(this.estado).length < minimo) {
      this.estado.motivoFin = 'No quedan jugadores suficientes conectados.';
      return true;
    }
    return false;
  }

  // ===================================================================
  //  Desarrollo de la partida
  // ===================================================================

  async iniciar() {
    try {
      await this._bucle();
    } catch (err) {
      console.error('[motor] Error inesperado:', err);
      this._avisar('⚠️ Error inesperado en la partida: ' + err.message);
    }
  }

  async _bucle() {
    const e = this.estado;

    // Modo prueba: solo un minijuego y vuelta a la sala
    if (this.minijuegoDePrueba) {
      e.ronda = 1;
      e.rondasTotales = 1;
      await this._minijuego(this.minijuegoDePrueba);
      return;
    }

    const nombres = e.orden.map((id) => e.jugadores[id].nombre).join(', ');
    this._avisar(`🎲 Orden de turnos: ${nombres}`);

    for (let r = 1; r <= e.rondasTotales; r++) {
      e.ronda = r;
      for (const id of e.orden) {
        if (this._debeTerminar()) return this._terminar();
        if (!e.jugadores[id].conectado) continue; // se saltan los ausentes
        await this._turno(id);
      }
      if (this._debeTerminar()) return this._terminar();
      await this._minijuego();
    }
    this._terminar();
  }

  // ------------------------------ Un turno ------------------------------
  async _turno(id) {
    const e = this.estado;
    const j = e.jugadores[id];

    this.saltando = false;
    e.rapido = false;
    e.fase = 'turno';
    e.turnoDe = id;
    e.dado = null;
    e.pasosRestantes = 0;

    // 1) Esperar a que tire el dado
    e.subfase = 'esperandoDado';
    e.limiteDado = { seq: ++this._seq, ms: CONFIG.TIEMPO_TIRAR_DADO };
    this._enviar();
    const tiro = await this.esperarAccion(id, 'tirarDado', CONFIG.TIEMPO_TIRAR_DADO);
    if (this.detenido) return;
    e.limiteDado = null;
    if (!tiro && j.conectado) this._avisar(`⏱️ ${j.nombre} tardaba mucho: el dado se ha tirado solo.`);

    // 2) Tirar (1 dado, o 2 si compró el dado doble)
    const numDados = 1 + j.dadosExtra;
    j.dadosExtra = 0;
    const valores = Array.from({ length: numDados }, () => azar(1, 6));
    const total = valores.reduce((a, b) => a + b, 0);
    e.dado = { valores, total, seq: ++this._seq };
    e.subfase = 'dado';
    this._enviar();
    await this.esperar(CONFIG.DURACION_DADO);

    // 3) Avanzar casilla a casilla
    e.subfase = 'moviendo';
    e.pasosRestantes = total;
    this._enviar();
    while (e.pasosRestantes > 0 && !this.detenido) {
      const actual = CASILLAS[j.casilla];
      let destino = actual.siguientes[0];

      if (actual.siguientes.length > 1) {
        // ¡Bifurcación! El jugador elige camino (con tiempo límite)
        const opciones = actual.siguientes.map((s) => ({ id: s, texto: actual.etiquetas[s] }));
        destino = await this.preguntar(
          id, 'bifurcacion', '¿Por dónde quieres ir?', opciones,
          CONFIG.TIEMPO_BIFURCACION, elegirAlAzar(actual.siguientes),
        );
      }

      j.casilla = destino;
      e.pasosRestantes--;
      this._enviar();
      await this.esperar(CONFIG.DURACION_PASO);

      // Al pasar por la estrella se puede comprar (aunque no se pare ahí)
      if (destino === e.casillaEstrella) await this._pasarPorEstrella(id);
    }
    if (this.detenido) return;

    // 4) Efecto de la casilla donde ha caído
    e.subfase = 'efecto';
    await this._aplicarCasilla(id);
    this._enviar();
    await this.esperar(CONFIG.DURACION_EFECTO);
  }

  async _pasarPorEstrella(id) {
    const e = this.estado;
    const j = e.jugadores[id];
    if (j.monedas >= CONFIG.PRECIO_ESTRELLA) {
      j.monedas -= CONFIG.PRECIO_ESTRELLA;
      j.estrellas++;
      // La estrella se va a otra casilla
      const otras = CANDIDATAS_ESTRELLA.filter((c) => c !== e.casillaEstrella);
      e.casillaEstrella = elegirAlAzar(otras);
      this._avisar(`⭐ ¡${j.nombre} compra una ESTRELLA por ${CONFIG.PRECIO_ESTRELLA} monedas! La estrella cambia de sitio.`);
      this._enviar();
      await this.esperar(CONFIG.DURACION_ESTRELLA);
    } else {
      this._avisar(`⭐ ${j.nombre} pasa por la estrella, pero necesita ${CONFIG.PRECIO_ESTRELLA} monedas.`);
    }
  }

  async _aplicarCasilla(id) {
    const e = this.estado;
    const j = e.jugadores[id];
    if (j.casilla === e.casillaEstrella) return; // la estrella ya se trató al pasar

    const tipo = CASILLAS[j.casilla].tipo;
    let texto = null;
    if (tipo === 'azul') texto = efectoAzul(e, id);
    else if (tipo === 'roja') texto = efectoRoja(e, id);
    else if (tipo === 'evento') texto = efectoEvento(e, id);
    else if (tipo === 'tienda') texto = await this._tienda(id);
    if (texto) this._avisar(texto);
  }

  async _tienda(id) {
    const j = this.estado.jugadores[id];
    const precio = CONFIG.PRECIO_DADO_DOBLE;
    if (j.dadosExtra > 0) return `🛒 ${j.nombre} ya tiene un Dado doble guardado.`;
    if (j.monedas < precio) return `🛒 ${j.nombre} no tiene monedas para comprar en la tienda (${precio} 🪙).`;

    const opcion = await this.preguntar(
      id, 'tienda', '🛒 Tienda: ¿quieres comprar algo?',
      [
        { id: 'dado', texto: `🎲🎲 Dado doble (${precio} 🪙): tiras 2 dados en tu próximo turno` },
        { id: 'nada', texto: 'No, gracias' },
      ],
      CONFIG.TIEMPO_TIENDA, 'nada',
    );
    if (opcion === 'dado') {
      cambiarMonedas(j, -precio);
      j.dadosExtra = 1;
      return `🛒 ${j.nombre} compra un Dado doble.`;
    }
    return `🛒 ${j.nombre} sale de la tienda sin comprar nada.`;
  }

  // ------------------------------ Minijuego ------------------------------
  /**
   * Al final de cada ronda: instrucciones -> 3, 2, 1 -> partida ->
   * resultados (con monedas según el puesto).
   */
  async _minijuego(idForzado) {
    const e = this.estado;
    const def = (idForzado && MINIJUEGOS[idForzado]) || elegirMinijuegoAlAzar(this._ultimoMinijuego);
    this._ultimoMinijuego = def.id;

    e.fase = 'minijuego';
    e.subfase = null;
    e.turnoDe = null;
    e.dado = null;
    e.decision = null;
    e.rapido = false;
    this.saltando = false;

    const participantes = jugadoresActivos(e);
    const m = {
      instancia: ++this._seq,    // identifica esta partida de minijuego
      id: def.id,
      etapa: 'instrucciones',
      seq: ++this._seq,          // cambia en cada etapa (para las cuentas atrás)
      ms: CONFIG.MINIJUEGO_INSTRUCCIONES,
      participantes,
      resultados: null,
    };
    e.minijuego = m;
    const etapa = (nombre, ms) => {
      m.etapa = nombre;
      m.seq = ++this._seq;
      m.ms = ms;
      this._enviar();
    };

    this._enviar();
    await this.esperar(CONFIG.MINIJUEGO_INSTRUCCIONES);
    if (this.detenido) return;
    etapa('cuenta', CONFIG.MINIJUEGO_CUENTA_ATRAS);
    await this.esperar(CONFIG.MINIJUEGO_CUENTA_ATRAS);
    if (this.detenido) return;
    etapa('jugando', def.duracionMaxima * 1000);

    // ¡A jugar! (según el tipo de minijuego)
    const jugadores = participantes
      .filter((id) => e.jugadores[id].conectado)
      .map((id) => ({ id, nombre: e.jugadores[id].nombre, color: e.jugadores[id].color }));
    if (def.tipo === 'tiempoReal') {
      this.sesion = new SesionTiempoRealHost({
        simulacion: def.crearSimulacion(jugadores),
        enviar: (inst) => { if (!this.detenido) this._emitirTiempoReal(inst); },
      });
    } else {
      this.sesion = new SesionPuntuacionHost({
        participantes: jugadores.map((j) => j.id),
        duracionMaxima: def.duracionMaxima,
      });
    }
    const puestos = await this.sesion.ejecutar();
    this.sesion = null;
    if (this.detenido) return;

    // Repartir monedas según el puesto
    m.resultados = puestos
      .filter((p) => e.jugadores[p.id] && e.jugadores[p.id].conectado)
      .sort((a, b) => a.puesto - b.puesto)
      .map((p) => {
        const monedas = CONFIG.MONEDAS_POR_PUESTO[p.puesto - 1] ?? CONFIG.MONEDAS_RESTO_PUESTOS;
        cambiarMonedas(e.jugadores[p.id], monedas);
        return { id: p.id, puesto: p.puesto, monedas };
      });
    etapa('resultados', CONFIG.MINIJUEGO_RESULTADOS);

    // Se cierra cuando el host pulsa "Continuar" o al acabar el tiempo
    await this.esperarAccion(this.idHost, 'continuar', CONFIG.MINIJUEGO_RESULTADOS);
    e.minijuego = null;
  }

  // ------------------------------ Final ------------------------------
  _terminar() {
    if (this.detenido) return;
    const e = this.estado;
    e.fase = 'fin';
    e.subfase = null;
    e.turnoDe = null;
    e.decision = null;
    e.minijuego = null;

    // Ordenar: conectados primero, luego estrellas, luego monedas
    const lista = Object.values(e.jugadores).map((j) => ({
      id: j.id, nombre: j.nombre, color: j.color,
      estrellas: j.estrellas, monedas: j.monedas, conectado: j.conectado,
    }));
    lista.sort((a, b) =>
      (b.conectado - a.conectado) || (b.estrellas - a.estrellas) || (b.monedas - a.monedas));
    e.clasificacion = lista;

    // Ganadores: los que empatan arriba del todo (por si hay empate total)
    const primero = lista.find((j) => j.conectado) || lista[0];
    e.ganadores = lista
      .filter((j) => j.conectado === primero.conectado &&
        j.estrellas === primero.estrellas && j.monedas === primero.monedas)
      .map((j) => j.id);
    this._enviar();
  }
}
