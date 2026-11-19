// =====================================================================
//  controlador.js — Lo que ve CADA jugador durante un minijuego
// ---------------------------------------------------------------------
//  Sirve para todos los minijuegos. Sigue las etapas que marca el host
//  en estado.minijuego:
//
//    'instrucciones'  -> nombre, objetivo y controles (5 s)
//    'cuenta'         -> 3, 2, 1...
//    'jugando'        -> el minijuego en sí
//    'resultados'     -> puestos y monedas ganadas
//
//  Durante 'jugando':
//   - tiempo real: manda los controles al host y dibuja las
//     instantáneas que llegan (suavizadas).
//   - puntuación: la vista juega en local y al final manda los puntos.
// =====================================================================

import { $, filaJugador } from '../interfaz/pantallas.js';
import { MINIJUEGOS } from './registro.js';
import { CapturaControles, BufferInstantaneas } from './tiempo-real/cliente.js';

const NOMBRE_TIPO = {
  tiempoReal: '⚡ Tiempo real: todos en el mismo escenario',
  puntuacion: '🎯 Puntuación: cada uno en su pantalla',
};

/** Muestra u oculta un elemento. */
function ver(id, visible) { $(id).classList.toggle('oculto', !visible); }

export class ControladorMinijuegos {
  /**
   * @param {object} opciones
   *   enviarAlHost(datos)  -> manda un mensaje al host
   *   alAbrir()            -> se abre un minijuego (pausar el tablero)
   *   alCerrar()           -> se cierra (volver al tablero)
   */
  constructor({ enviarAlHost, alAbrir, alCerrar }) {
    this.enviarAlHost = enviarAlHost;
    this.alAbrir = alAbrir;
    this.alCerrar = alCerrar;
    this.instancia = null;      // id de la partida de minijuego actual
    this.vista = null;
    this.captura = null;
    this.buffer = null;
    this.etapa = null;
    this.cuentas = {};          // etapa -> { seq, fin }
    this.soyHost = false;

    $('mj-continuar').addEventListener('click', () => this._continuar());
  }

  get abierto() { return this.instancia !== null; }

  // -------------------------------------------------------------------
  //  Llega un estado nuevo del host
  // -------------------------------------------------------------------
  actualizar(estado, miId, soyHost) {
    const m = estado.minijuego;
    if (!m) return this.cerrar();
    this.miId = miId;
    this.soyHost = soyHost;
    this.jugadores = estado.jugadores;
    this.def = MINIJUEGOS[m.id];

    if (m.instancia !== this.instancia) this._abrir(m);
    this.participo = m.participantes.includes(miId) && estado.jugadores[miId].conectado;

    // Cuenta atrás de la etapa (se mide desde que la recibimos)
    const c = this.cuentas[m.etapa];
    if (!c || c.seq !== m.seq) this.cuentas[m.etapa] = { seq: m.seq, fin: performance.now() + m.ms };

    const nueva = m.etapa !== this.etapa;
    this.etapa = m.etapa;
    $('capa-mj').dataset.etapa = m.etapa; // el CSS oculta cosas según la etapa

    ver('mj-instrucciones', m.etapa === 'instrucciones');
    ver('mj-hud', m.etapa === 'jugando');
    ver('mj-resultados', m.etapa === 'resultados');
    if (m.etapa !== 'cuenta' && !(m.etapa === 'jugando' && this._mostrandoYa)) ver('mj-cuenta', false);

    if (nueva && m.etapa === 'cuenta') ver('mj-cuenta', true);
    if (nueva && m.etapa === 'jugando') this._empezarAJugar();
    if (m.etapa === 'resultados') this._mostrarResultados(m);
  }

  /** Llega una instantánea de tiempo real del host. */
  alInstantanea(inst) {
    if (this.buffer) this.buffer.agregar(inst);
  }

  /** Espacio fuera del juego: el host puede cerrar los resultados. */
  teclaEspacio() {
    if (this.etapa === 'resultados') this._continuar();
  }

  // -------------------------------------------------------------------
  //  Abrir / cerrar
  // -------------------------------------------------------------------
  _abrir(m) {
    this.cerrar();
    this.instancia = m.instancia;
    this.etapa = null;
    this.cuentas = {};
    this._yaHecho = false;
    this._puntuacionIniciada = false;
    this.buffer = new BufferInstantaneas();
    this.alAbrir();
    ver('capa-mj', true);

    // Instrucciones
    $('mj-tipo').textContent = NOMBRE_TIPO[this.def.tipo] || '';
    $('mj-titulo').textContent = this.def.nombre;
    $('mj-objetivo').textContent = this.def.objetivo;
    const tabla = $('mj-controles');
    tabla.textContent = '';
    for (const [tecla, accion] of this.def.controles) {
      const fila = tabla.insertRow();
      const kbd = document.createElement('kbd');
      kbd.textContent = tecla;
      fila.insertCell().appendChild(kbd);
      fila.insertCell().textContent = accion;
    }
    $('mj-nombre').textContent = this.def.nombre;
    $('mj-texto').textContent = '';
    $('mj-tiempo').textContent = '';

    // Cargar la vista 3D del minijuego (mientras se leen las instrucciones)
    const instancia = m.instancia;
    const jugadores = m.participantes.map((id) => ({ id, ...this.jugadores[id] }));
    this.def.cargarVista().then((modulo) => {
      if (this.instancia !== instancia) return; // ya se cerró
      this.vista = new modulo.Vista({ contenedor: $('escena-mj'), jugadores, miId: this.miId });
      if (this.etapa === 'jugando') this._empezarAJugar();
    }).catch((err) => console.error('[minijuego] No se pudo cargar la vista', err));

    // Bucle de dibujo
    let anterior = performance.now();
    const fotograma = (ahora) => {
      if (this.instancia !== instancia) return;
      const dt = Math.min((ahora - anterior) / 1000, 0.1);
      anterior = ahora;
      this._fotograma(dt);
      this._raf = requestAnimationFrame(fotograma);
    };
    this._raf = requestAnimationFrame(fotograma);
  }

  /** Cierra el minijuego y vuelve al tablero. */
  cerrar() {
    if (!this.abierto) return;
    this.instancia = null;
    cancelAnimationFrame(this._raf);
    if (this.captura) this.captura.destruir();
    if (this.vista) this.vista.destruir();
    this.captura = null;
    this.vista = null;
    this.buffer = null;
    this.etapa = null;
    for (const id of ['capa-mj', 'mj-instrucciones', 'mj-hud', 'mj-cuenta', 'mj-resultados']) ver(id, false);
    this.alCerrar();
  }

  // -------------------------------------------------------------------
  //  Jugar
  // -------------------------------------------------------------------
  _empezarAJugar() {
    // "¡YA!" durante un momento (solo una vez por minijuego)
    if (!this._yaHecho) {
      this._yaHecho = true;
      this._mostrandoYa = true;
      $('mj-cuenta').textContent = '¡YA!';
      ver('mj-cuenta', true);
      setTimeout(() => {
        this._mostrandoYa = false;
        if (this.etapa !== 'cuenta') ver('mj-cuenta', false);
      }, 700);
    }
    if (!this.participo || !this.vista) return;

    if (this.def.tipo === 'tiempoReal' && !this.captura) {
      this.captura = new CapturaControles((d) => this.enviarAlHost({ t: 'entrada', d }));
    } else if (this.def.tipo === 'puntuacion' && !this._puntuacionIniciada && this.vista.jugar) {
      this._puntuacionIniciada = true;
      this.vista.jugar({
        alTerminar: (puntos) => this.enviarAlHost({ t: 'accion', accion: 'puntuacion', datos: { puntos } }),
      });
    }
  }

  _fotograma(dt) {
    const ahora = performance.now();
    const restante = (etapa) => {
      const c = this.cuentas[etapa];
      return c ? Math.max(0, c.fin - ahora) : 0;
    };

    if (this.etapa === 'instrucciones') {
      $('mj-cuenta-instr').textContent = `Empieza en ${Math.ceil(restante('instrucciones') / 1000)} s…`;
    } else if (this.etapa === 'cuenta') {
      $('mj-cuenta').textContent = String(Math.max(1, Math.ceil(restante('cuenta') / 1000)));
    } else if (this.etapa === 'resultados') {
      $('mj-res-cuenta').textContent = `Volviendo al tablero en ${Math.ceil(restante('resultados') / 1000)} s`;
    }

    const inst = this.buffer && this.buffer.actual();
    if (inst && inst.hud && this.etapa === 'jugando') {
      $('mj-tiempo').textContent = `⏱️ ${Math.ceil(inst.hud.tiempo)} s`;
      $('mj-texto').textContent = inst.hud.texto;
    }
    if (this.vista) this.vista.dibujar(inst, dt);
  }

  // -------------------------------------------------------------------
  //  Resultados
  // -------------------------------------------------------------------
  _mostrarResultados(m) {
    if (this.captura) { this.captura.destruir(); this.captura = null; }
    $('mj-res-nombre').textContent = this.def.nombre;
    const lista = $('mj-res-lista');
    lista.textContent = '';
    for (const r of m.resultados || []) {
      const j = this.jugadores[r.id];
      if (!j) continue;
      const medalla = ['🥇', '🥈', '🥉'][r.puesto - 1] || `${r.puesto}.º`;
      const li = filaJugador(j.color, `${medalla} ${j.nombre}${r.id === this.miId ? ' (tú)' : ''}`);
      const datos = document.createElement('span');
      datos.className = 'datos';
      datos.textContent = `+${r.monedas} 🪙`;
      li.appendChild(datos);
      lista.appendChild(li);
    }
    ver('mj-continuar', this.soyHost);
  }

  _continuar() {
    if (this.soyHost && this.etapa === 'resultados') {
      this.enviarAlHost({ t: 'accion', accion: 'continuar' });
    }
  }
}
