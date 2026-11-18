// =====================================================================
//  hud.js — Todo lo que se ve ENCIMA del tablero durante la partida
// ---------------------------------------------------------------------
//  Marcador, ronda, dado, botones, preguntas (bifurcación / tienda),
//  minijuego provisional y resultados. Se redibuja cada vez que llega
//  un estado nuevo del host.
// =====================================================================

import { $, filaJugador, ponerEtiqueta } from './pantallas.js';
import { CONFIG } from '../reglas/config.js';

/** Muestra u oculta un elemento. */
function ver(id, visible) { $(id).classList.toggle('oculto', !visible); }

export class Hud {
  /**
   * @param {object} acciones  alTirar, alSaltar, alElegir(opcion),
   *                           alContinuar, alVolverSala, alSalir
   */
  constructor(acciones) {
    this.acciones = acciones;
    this.estado = null;
    this.miId = null;
    this.ultimoDado = null;       // seq del último dado animado
    this.dadoGirando = false;
    this.cuentas = {};            // cuentas atrás: nombre -> { seq, fin }

    $('btn-tirar').addEventListener('click', () => acciones.alTirar());
    $('btn-saltar').addEventListener('click', () => acciones.alSaltar());
    $('btn-continuar').addEventListener('click', () => acciones.alContinuar());
    $('btn-volver-sala').addEventListener('click', () => acciones.alVolverSala());
    $('btn-salir-final').addEventListener('click', () => acciones.alSalir());

    // Refrescar las cuentas atrás 5 veces por segundo
    setInterval(() => this._pintarCuentas(), 200);
  }

  // -------------------------------------------------------------------
  //  Teclado (lo llama main.js)
  // -------------------------------------------------------------------
  /** Espacio: tirar el dado si me toca, o saltar la animación. */
  teclaEspacio() {
    if (!$('btn-tirar').classList.contains('oculto')) this.acciones.alTirar();
    else if (!$('btn-saltar').classList.contains('oculto')) this.acciones.alSaltar();
    else if (!$('btn-continuar').classList.contains('oculto') &&
      !$('capa-minijuego').classList.contains('oculto')) this.acciones.alContinuar();
  }

  /** Teclas 1, 2, 3...: elegir una opción de la pregunta. */
  teclaNumero(n) {
    const d = this.estado && this.estado.decision;
    if (d && d.jugadorId === this.miId && d.opciones[n - 1]) this.acciones.alElegir(d.opciones[n - 1].id);
  }

  // -------------------------------------------------------------------
  //  Dibujar el estado
  // -------------------------------------------------------------------
  actualizar(estado, miId, soyHost) {
    this.estado = estado;
    this.miId = miId;
    this.soyHost = soyHost;
    const e = estado;
    const deTurno = e.turnoDe && e.jugadores[e.turnoDe];

    // Barra superior
    $('hud-ronda').textContent = `Ronda ${Math.max(e.ronda, 1)} / ${e.rondasTotales}`;
    const turno = $('hud-turno');
    if (e.fase === 'turno' && deTurno) {
      turno.textContent = e.turnoDe === miId ? '👉 ¡Tu turno!' : `Turno de ${deTurno.nombre}`;
      turno.style.color = deTurno.color;
    } else if (e.fase === 'minijuego') {
      turno.textContent = '🎮 Minijuego';
      turno.style.color = '';
    } else {
      turno.textContent = e.fase === 'fin' ? '🏁 Fin de la partida' : '';
      turno.style.color = '';
    }

    this._pintarMarcador(e, miId);
    this._pintarCentro(e, miId, soyHost);
    this._pintarDecision(e, miId);
    this._pintarMinijuego(e, soyHost);
    this._pintarResultados(e, miId, soyHost);
  }

  _pintarMarcador(e, miId) {
    const lista = $('marcador-lista');
    lista.textContent = '';
    // Ordenados por estrellas y luego monedas (los desconectados al final)
    const ids = [...e.orden].sort((a, b) => {
      const A = e.jugadores[a]; const B = e.jugadores[b];
      return (B.conectado - A.conectado) || (B.estrellas - A.estrellas) || (B.monedas - A.monedas);
    });
    ids.forEach((id, i) => {
      const j = e.jugadores[id];
      const li = filaJugador(j.color, `${i + 1}. ${j.nombre}`);
      if (id === miId) ponerEtiqueta(li, 'TÚ', 'etiqueta-tu');
      const datos = document.createElement('span');
      datos.className = 'datos';
      datos.textContent = `⭐${j.estrellas}  🪙${j.monedas}` + (j.dadosExtra ? ' 🎲' : '');
      li.appendChild(datos);
      if (id === e.turnoDe) li.classList.add('turno');
      if (!j.conectado) li.classList.add('desconectado');
      lista.appendChild(li);
    });
  }

  _pintarCentro(e, miId, soyHost) {
    ver('hud-centro', e.fase === 'turno');
    if (e.fase !== 'turno') return;
    const j = e.jugadores[e.turnoDe];
    if (!j) return;
    const esMio = e.turnoDe === miId;
    const mensaje = $('hud-mensaje');

    // --- Dado ---
    if (e.subfase === 'esperandoDado') {
      ver('dado', false);
      this.ultimoDado = null;
      mensaje.textContent = esMio ? '¡Es tu turno! Tira el dado.' : `Esperando a que ${j.nombre} tire el dado…`;
      this._empezarCuenta('dado', e.limiteDado);
    } else {
      this._pararCuenta('dado');
    }

    if (e.dado && e.dado.seq !== this.ultimoDado) {
      this.ultimoDado = e.dado.seq;
      this._animarDado(e.dado, e.rapido);
    }

    if (e.subfase === 'dado') {
      const extra = e.dado && e.dado.valores.length > 1 ? ` (${e.dado.valores.join(' + ')})` : '';
      mensaje.textContent = `${esMio ? 'Has' : j.nombre + ' ha'} sacado un ${e.dado.total}${extra}`;
    } else if (e.subfase === 'moviendo') {
      if (!this.dadoGirando) $('dado').textContent = e.pasosRestantes;
      const d = e.decision;
      if (d && d.jugadorId !== miId) mensaje.textContent = `${j.nombre} está eligiendo camino…`;
      else if (e.pasosRestantes === 0) mensaje.textContent = '¡Ha llegado!';
      else mensaje.textContent = `Avanzando… ${e.pasosRestantes === 1 ? 'queda 1 casilla' : `quedan ${e.pasosRestantes} casillas`}`;
    } else if (e.subfase === 'efecto') {
      ver('dado', false);
      const d = e.decision;
      mensaje.textContent = d && d.jugadorId !== miId ? `${j.nombre} está en la tienda…` : '';
    }

    // --- Botones ---
    ver('btn-tirar', esMio && e.subfase === 'esperandoDado');
    const sePuedeSaltar = ['dado', 'moviendo', 'efecto'].includes(e.subfase) && !e.rapido && !e.decision;
    ver('btn-saltar', sePuedeSaltar && (esMio || soyHost));
  }

  _animarDado(dado, rapido) {
    const caja = $('dado');
    ver('dado', true);
    clearInterval(this._intervaloDado);
    if (rapido) {
      this.dadoGirando = false;
      caja.classList.remove('girando');
      caja.textContent = dado.total;
      return;
    }
    // Números al azar durante un rato y luego el resultado
    this.dadoGirando = true;
    caja.classList.add('girando');
    const maximo = 6 * dado.valores.length;
    this._intervaloDado = setInterval(() => {
      caja.textContent = 1 + Math.floor(Math.random() * maximo);
    }, 70);
    setTimeout(() => {
      clearInterval(this._intervaloDado);
      this.dadoGirando = false;
      caja.classList.remove('girando');
      caja.textContent = this.estado && this.estado.subfase === 'moviendo'
        ? this.estado.pasosRestantes : dado.total;
    }, CONFIG.DURACION_DADO - 250);
  }

  _pintarDecision(e, miId) {
    const d = e.decision;
    const mia = d && d.jugadorId === miId;
    ver('hud-decision', !!mia);
    if (!d) { this._pararCuenta('decision'); return; }
    this._empezarCuenta('decision', d);
    if (!mia) return;

    // Solo redibujamos los botones si es una pregunta nueva
    if (this._decisionPintada === d.seq) return;
    this._decisionPintada = d.seq;
    $('decision-texto').textContent = d.texto;
    const caja = $('decision-opciones');
    caja.textContent = '';
    d.opciones.forEach((op, i) => {
      const b = document.createElement('button');
      b.className = 'boton boton-opcion';
      b.textContent = `${i + 1}. ${op.texto}`;
      b.addEventListener('click', () => this.acciones.alElegir(op.id));
      caja.appendChild(b);
    });
  }

  _pintarMinijuego(e, soyHost) {
    const m = e.fase === 'minijuego' && e.minijuego;
    ver('capa-minijuego', !!m);
    if (!m) { this._pararCuenta('minijuego'); return; }
    this._empezarCuenta('minijuego', m);
    const lista = $('minijuego-premios');
    lista.textContent = '';
    for (const p of m.premios) {
      const j = e.jugadores[p.id];
      const li = filaJugador(j.color, j.nombre);
      const datos = document.createElement('span');
      datos.className = 'datos';
      datos.textContent = `+${p.monedas} 🪙`;
      datos.style.marginLeft = 'auto';
      datos.style.fontWeight = '700';
      li.appendChild(datos);
      lista.appendChild(li);
    }
    ver('btn-continuar', soyHost);
  }

  _pintarResultados(e, miId, soyHost) {
    const fin = e.fase === 'fin';
    ver('capa-resultados', fin);
    if (!fin) return;

    const ganadores = e.ganadores.map((id) => e.jugadores[id]);
    $('resultados-ganador').textContent = ganadores.length === 1
      ? `🥇 ¡Gana ${ganadores[0].nombre}!${ganadores[0].id === miId ? ' (¡eres tú!)' : ''}`
      : `🤝 Empate entre ${ganadores.map((g) => g.nombre).join(' y ')}`;
    $('resultados-motivo').textContent = e.motivoFin || '';

    const lista = $('resultados-lista');
    lista.textContent = '';
    e.clasificacion.forEach((j, i) => {
      const medalla = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
      const li = filaJugador(j.color, `${medalla} ${j.nombre}${j.conectado ? '' : ' (desconectado)'}`);
      const datos = document.createElement('span');
      datos.className = 'datos';
      datos.textContent = `⭐${j.estrellas}  🪙${j.monedas}`;
      li.appendChild(datos);
      lista.appendChild(li);
    });
    ver('btn-volver-sala', soyHost);
  }

  // -------------------------------------------------------------------
  //  Cuentas atrás (bifurcación, tienda, dado, minijuego)
  // -------------------------------------------------------------------
  /** info = { seq, ms }. Empieza a contar al recibirla por primera vez. */
  _empezarCuenta(nombre, info) {
    if (!info) return this._pararCuenta(nombre);
    const actual = this.cuentas[nombre];
    if (actual && actual.seq === info.seq) return;
    this.cuentas[nombre] = { seq: info.seq, fin: Date.now() + info.ms };
  }

  _pararCuenta(nombre) { delete this.cuentas[nombre]; }

  _pintarCuentas() {
    const segundos = (nombre) => {
      const c = this.cuentas[nombre];
      return c ? Math.max(0, Math.ceil((c.fin - Date.now()) / 1000)) : null;
    };
    const sDado = segundos('dado');
    const sDecision = segundos('decision');
    const centro = sDecision !== null ? `⏱️ ${sDecision} s para decidir` : (sDado !== null ? `⏱️ ${sDado} s` : '');
    $('hud-cuenta').textContent = centro;
    $('decision-cuenta').textContent = sDecision !== null ? `⏱️ ${sDecision} s` : '';
    const sMini = segundos('minijuego');
    $('minijuego-cuenta').textContent = sMini !== null ? `Se cierra en ${sMini} s` : '';
  }
}
