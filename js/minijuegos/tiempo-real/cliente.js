// =====================================================================
//  tiempo-real/cliente.js — Lo que hace CADA jugador en tiempo real
// ---------------------------------------------------------------------
//  Dos piezas reutilizables por todos los minijuegos de tiempo real:
//
//  1. CapturaControles: lee el teclado (WASD / flechas / Espacio) y se
//     lo manda al host. No mueve nada por su cuenta: quien decide es
//     el host.
//
//  2. BufferInstantaneas: guarda las "fotos" que manda el host y, al
//     dibujar, calcula una posición INTERMEDIA entre dos fotos
//     (interpolación). Así, aunque lleguen 20 fotos por segundo y con
//     algo de retraso, en pantalla se ve fluido a 60 imágenes por
//     segundo. A cambio, vemos el juego unos 100 ms "en diferido".
// =====================================================================

import { escribiendo } from '../../interfaz/pantallas.js';

// ---------------------------------------------------------------------
//  1. Controles
// ---------------------------------------------------------------------

const TECLAS = {
  KeyW: 'arriba', ArrowUp: 'arriba',
  KeyS: 'abajo', ArrowDown: 'abajo',
  KeyA: 'izquierda', ArrowLeft: 'izquierda',
  KeyD: 'derecha', ArrowRight: 'derecha',
};

export class CapturaControles {
  /** @param {function(object)} enviar  manda los controles al host */
  constructor(enviar) {
    this.enviar = enviar;
    this.pulsadas = new Set();
    this.acciones = 0;          // cuántas veces se ha pulsado Espacio
    this._ultimoEnviado = '';

    this._alBajar = (ev) => {
      if (escribiendo()) return;
      if (TECLAS[ev.code]) {
        ev.preventDefault();
        this.pulsadas.add(TECLAS[ev.code]);
        this._enviarSiCambia();
      } else if (ev.code === 'Space') {
        ev.preventDefault();
        if (!ev.repeat) { this.acciones++; this._enviarSiCambia(); }
      }
    };
    this._alSubir = (ev) => {
      if (TECLAS[ev.code]) {
        this.pulsadas.delete(TECLAS[ev.code]);
        this._enviarSiCambia();
      }
    };
    // Si la ventana pierde el foco, soltamos todas las teclas
    this._alPerderFoco = () => { this.pulsadas.clear(); this._enviarSiCambia(); };

    window.addEventListener('keydown', this._alBajar);
    window.addEventListener('keyup', this._alSubir);
    window.addEventListener('blur', this._alPerderFoco);
    // Reenviamos cada poco aunque no cambie nada (por si se perdió algo)
    this._intervalo = setInterval(() => this.enviar(this.entrada()), 150);
  }

  /** Controles actuales: dirección (x, z) y contador de acciones. */
  entrada() {
    const p = this.pulsadas;
    return {
      x: (p.has('derecha') ? 1 : 0) - (p.has('izquierda') ? 1 : 0),
      z: (p.has('abajo') ? 1 : 0) - (p.has('arriba') ? 1 : 0),
      a: this.acciones,
    };
  }

  _enviarSiCambia() {
    const e = this.entrada();
    const texto = JSON.stringify(e);
    if (texto === this._ultimoEnviado) return;
    this._ultimoEnviado = texto;
    this.enviar(e);
  }

  destruir() {
    window.removeEventListener('keydown', this._alBajar);
    window.removeEventListener('keyup', this._alSubir);
    window.removeEventListener('blur', this._alPerderFoco);
    clearInterval(this._intervalo);
  }
}

/** El host limpia los controles recibidos (nunca hay que fiarse del todo). */
export function limpiarEntrada(e) {
  const num = (v, min, max) => Math.max(min, Math.min(max, Number(v) || 0));
  return { x: num(e && e.x, -1, 1), z: num(e && e.z, -1, 1), a: Math.floor(num(e && e.a, 0, 1e9)) };
}

// ---------------------------------------------------------------------
//  2. Interpolación
// ---------------------------------------------------------------------

/** Mezcla dos ángulos por el camino más corto. */
function mezclarAngulo(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * k;
}

/**
 * Mezcla dos instantáneas (a = antigua, b = nueva) con k entre 0 y 1.
 * Los números se mezclan; el resto (textos, true/false) se toma de b.
 * Si un campo se llama "ang" se trata como un ángulo.
 */
export function interpolar(a, b, k, clave = '') {
  if (typeof b === 'number' && typeof a === 'number') {
    return clave === 'ang' ? mezclarAngulo(a, b, k) : a + (b - a) * k;
  }
  if (b && typeof b === 'object' && !Array.isArray(b) && a && typeof a === 'object') {
    const r = {};
    for (const c of Object.keys(b)) r[c] = c in a ? interpolar(a[c], b[c], k, c) : b[c];
    return r;
  }
  return b;
}

export class BufferInstantaneas {
  /** @param {number} retrasoMs  cuánto "en diferido" vemos el juego */
  constructor(retrasoMs = 110) {
    this.retraso = retrasoMs / 1000;
    this.lista = [];
    this.desfase = null;    // diferencia entre nuestro reloj y el del juego
  }

  /** Llega una instantánea del host (con su tiempo de juego "t"). */
  agregar(inst) {
    const ahora = performance.now() / 1000;
    const desfase = ahora - inst.t;
    // Nos quedamos con el desfase más pequeño (el de la foto que llegó
    // más rápido), pero dejamos que suba poco a poco por si la red empeora.
    this.desfase = this.desfase === null ? desfase : Math.min(desfase, this.desfase + 0.002);
    const ultima = this.lista[this.lista.length - 1];
    if (ultima && inst.t <= ultima.t) return; // desordenada: la ignoramos
    this.lista.push(inst);
    if (this.lista.length > 40) this.lista.shift();
  }

  /** Estado a dibujar ahora mismo (mezcla de dos fotos), o null. */
  actual() {
    const l = this.lista;
    if (l.length === 0) return null;
    const t = performance.now() / 1000 - this.desfase - this.retraso;
    if (t <= l[0].t) return l[0];
    for (let i = l.length - 1; i > 0; i--) {
      if (l[i - 1].t <= t) {
        if (t >= l[i].t) return l[i];
        const k = (t - l[i - 1].t) / (l[i].t - l[i - 1].t);
        return interpolar(l[i - 1], l[i], k);
      }
    }
    return l[l.length - 1];
  }

  /** La última foto recibida (sin retraso). */
  ultima() { return this.lista[this.lista.length - 1] || null; }
}
