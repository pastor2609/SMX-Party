// =====================================================================
//  plataforma/simulacion.js — La física de "Fuera de la plataforma"
// ---------------------------------------------------------------------
//  Solo la ejecuta el HOST. No dibuja nada: solo calcula posiciones,
//  choques, empujones, caídas y quién gana.
//
//  Coordenadas: el centro de la plataforma es (0, 0). "x" va a la
//  derecha, "z" hacia la cámara y "y" es la altura (0 = suelo).
// =====================================================================

import { limpiarEntrada } from '../tiempo-real/cliente.js';
import { calcularPuestos } from '../puntuacion/host.js';

// --------- Ajustes del minijuego (cámbialos aquí para probar) ---------
export const AJUSTES = {
  DURACION: 60,               // segundos como máximo
  RADIO_INICIAL: 9,           // tamaño de la plataforma al empezar
  RADIOS: [7.4, 5.9, 4.6, 3.4, 2.4], // tamaños tras cada encogimiento
  CADA: 10,                   // encoge cada 10 segundos
  AVISO: 2,                   // el borde parpadea 2 s antes
  VELOCIDAD_ENCOGER: 4,       // metros por segundo al encoger

  RADIO_JUGADOR: 0.55,
  VELOCIDAD: 5,               // velocidad andando
  ACELERACION: 9,
  EMPUJON_VELOCIDAD: 15,      // velocidad de la embestida
  EMPUJON_DURACION: 0.18,     // segundos que dura la embestida
  RECARGA: 1.5,               // segundos entre empujones
  FUERZA_GOLPE: 11,           // con qué fuerza sale despedido el rival
  ATURDIDO: 0.35,             // segundos casi sin control tras un golpe
  REBOTE: 0.8,                // choques normales (1 = muy elásticos)
  GRAVEDAD: 22,
  ESPERA_FINAL: 1.5,          // segundos extra para ver el último chapuzón
};
const A = AJUSTES;

const redondear = (v) => Math.round(v * 100) / 100;

export class SimulacionPlataforma {
  /** @param {Array} jugadores [{ id, nombre, color }] */
  constructor(jugadores) {
    this.t = 0;
    this.radio = A.RADIO_INICIAL;
    this.fin = null;            // momento en que se decidió el final
    this.total = jugadores.length;
    this.jugadores = {};

    // Repartidos en círculo, mirando al centro
    jugadores.forEach((j, i) => {
      const angulo = (i / jugadores.length) * Math.PI * 2;
      const x = Math.sin(angulo) * A.RADIO_INICIAL * 0.6;
      const z = Math.cos(angulo) * A.RADIO_INICIAL * 0.6;
      this.jugadores[j.id] = {
        x, z, y: 0, vx: 0, vz: 0, vy: 0,
        ang: Math.atan2(-x, -z),  // mirando al centro
        estado: 'vivo',           // 'vivo' | 'cayendo' | 'fuera'
        recarga: 0, embestida: 0, aturdido: 0,
        acciones: null,           // último contador de Espacio visto
        eliminadoEn: null,
        desconectado: false,
      };
    });
  }

  /** Radio al que tiene que llegar la plataforma ahora mismo. */
  _radioObjetivo() {
    const n = Math.floor(this.t / A.CADA);
    return n === 0 ? A.RADIO_INICIAL : A.RADIOS[Math.min(n, A.RADIOS.length) - 1];
  }

  /** Radio del siguiente encogimiento si toca avisar, o null. */
  _radioAviso() {
    if (this.fin !== null) return null;
    const n = Math.floor(this.t / A.CADA);
    const proximo = (n + 1) * A.CADA;
    if (n >= A.RADIOS.length || proximo >= A.DURACION) return null;
    return proximo - this.t <= A.AVISO ? A.RADIOS[n] : null;
  }

  _vivos() { return Object.values(this.jugadores).filter((j) => j.estado === 'vivo'); }

  // -------------------------------------------------------------------
  paso(dt, entradas) {
    this.t += dt;

    // 1) La plataforma encoge poco a poco hasta su nuevo tamaño
    const objetivo = this._radioObjetivo();
    if (this.radio > objetivo) this.radio = Math.max(objetivo, this.radio - A.VELOCIDAD_ENCOGER * dt);

    // 2) Mover a cada jugador según sus controles
    for (const [id, j] of Object.entries(this.jugadores)) {
      if (j.estado === 'vivo') this._moverVivo(j, entradas[id], dt);
      else if (j.estado === 'cayendo') this._moverCayendo(j, dt);
    }

    // 3) Choques entre jugadores
    const vivos = this._vivos();
    for (let i = 0; i < vivos.length; i++) {
      for (let k = i + 1; k < vivos.length; k++) this._chocar(vivos[i], vivos[k]);
    }

    // 4) ¿Alguien se ha salido de la plataforma?
    for (const j of vivos) {
      if (Math.hypot(j.x, j.z) > this.radio) {
        j.estado = 'cayendo';
        j.eliminadoEn = this.t;
        j.vy = 2; // pequeño saltito antes de caer
      }
    }

    // 5) ¿Se acabó?
    if (this.fin === null) {
      const quedan = this._vivos().length;
      const ultimoEnPie = this.total >= 2 ? quedan <= 1 : quedan === 0;
      if (ultimoEnPie || this.t >= A.DURACION) this.fin = this.t;
    }
  }

  _moverVivo(j, entradaBruta, dt) {
    j.recarga = Math.max(0, j.recarga - dt);
    j.embestida = Math.max(0, j.embestida - dt);
    j.aturdido = Math.max(0, j.aturdido - dt);

    // Cuando se acaba el minijuego, los supervivientes se quedan quietos
    const e = this.fin === null ? limpiarEntrada(entradaBruta) : { x: 0, z: 0, a: j.acciones || 0 };
    let dx = e.x;
    let dz = e.z;
    const largo = Math.hypot(dx, dz);
    if (largo > 0) { dx /= largo; dz /= largo; }
    if (largo > 0 && j.embestida === 0 && j.aturdido === 0) j.ang = Math.atan2(dx, dz);

    // ¿Ha pulsado Espacio otra vez? -> empujón (si no está recargando)
    if (j.acciones === null) j.acciones = e.a;
    if (e.a > j.acciones) {
      j.acciones = e.a;
      if (j.recarga === 0 && j.aturdido === 0) {
        j.embestida = A.EMPUJON_DURACION;
        j.recarga = A.RECARGA;
        j.vx = Math.sin(j.ang) * A.EMPUJON_VELOCIDAD;
        j.vz = Math.cos(j.ang) * A.EMPUJON_VELOCIDAD;
      }
    }

    if (j.embestida === 0) {
      // Andar: la velocidad se acerca poco a poco a la deseada
      const control = j.aturdido > 0 ? 0.12 : 1;
      const k = Math.min(1, A.ACELERACION * dt * control);
      j.vx += (dx * A.VELOCIDAD - j.vx) * k;
      j.vz += (dz * A.VELOCIDAD - j.vz) * k;
    }
    j.x += j.vx * dt;
    j.z += j.vz * dt;
  }

  _moverCayendo(j, dt) {
    j.vx *= 1 - 1.5 * dt;
    j.vz *= 1 - 1.5 * dt;
    j.vy -= A.GRAVEDAD * dt;
    j.x += j.vx * dt;
    j.z += j.vz * dt;
    j.y += j.vy * dt;
    if (j.y < -4) j.estado = 'fuera';
  }

  _chocar(a, b) {
    let nx = b.x - a.x;
    let nz = b.z - a.z;
    let d = Math.hypot(nx, nz);
    const minimo = A.RADIO_JUGADOR * 2;
    if (d >= minimo) return;
    if (d < 0.0001) { nx = 1; nz = 0; d = 1; } else { nx /= d; nz /= d; }

    // Separarlos para que no se atraviesen
    const solape = (minimo - Math.min(d, minimo)) / 2;
    a.x -= nx * solape; a.z -= nz * solape;
    b.x += nx * solape; b.z += nz * solape;

    // Empujón: quien embiste lanza al otro hacia atrás
    const golpeA = a.embestida > 0;
    const golpeB = b.embestida > 0;
    if (golpeA || golpeB) {
      if (golpeA) this._golpear(a, b, nx, nz, golpeB ? 0.5 : 1);
      if (golpeB) this._golpear(b, a, -nx, -nz, golpeA ? 0.5 : 1);
      return;
    }

    // Choque normal: intercambian velocidad en la dirección del choque
    const vRel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
    if (vRel < 0) {
      const impulso = (-(1 + A.REBOTE) * vRel) / 2;
      a.vx -= impulso * nx; a.vz -= impulso * nz;
      b.vx += impulso * nx; b.vz += impulso * nz;
    }
  }

  /** "atacante" embiste a "victima" en la dirección (nx, nz). */
  _golpear(atacante, victima, nx, nz, factor) {
    victima.vx = nx * A.FUERZA_GOLPE * factor;
    victima.vz = nz * A.FUERZA_GOLPE * factor;
    victima.aturdido = A.ATURDIDO;
    victima.embestida = 0;
    atacante.embestida = 0;
    atacante.vx *= 0.2;
    atacante.vz *= 0.2;
  }

  // -------------------------------------------------------------------
  eliminarJugador(id) {
    const j = this.jugadores[id];
    if (!j || j.desconectado) return;
    j.desconectado = true;
    if (j.estado === 'vivo') {
      j.estado = 'fuera';
      j.eliminadoEn = this.t;
    }
  }

  get terminado() {
    return this.fin !== null && this.t >= this.fin + A.ESPERA_FINAL;
  }

  /** Puestos: los que siguen en pie comparten el 1.º; luego, quien cayó más tarde. */
  clasificacion() {
    const lista = Object.entries(this.jugadores)
      .filter(([, j]) => !j.desconectado)
      .map(([id, j]) => ({ id, valor: j.estado === 'vivo' ? Infinity : j.eliminadoEn }))
      .sort((a, b) => b.valor - a.valor);
    return calcularPuestos(lista, (x) => x.valor);
  }

  /** Foto del estado para enviar a todos (números redondeados = menos datos). */
  instantanea() {
    const j = {};
    for (const [id, p] of Object.entries(this.jugadores)) {
      j[id] = {
        x: redondear(p.x), z: redondear(p.z), y: redondear(p.y), ang: redondear(p.ang),
        est: p.estado,
        rec: redondear(p.recarga / A.RECARGA),   // 0 = listo, 1 = recién usado
        emb: p.embestida > 0 ? 1 : 0,
      };
    }
    const quedan = this._vivos().length;
    return {
      t: redondear(this.t),
      radio: redondear(this.radio),
      aviso: this._radioAviso(),
      j,
      hud: {
        tiempo: Math.max(0, A.DURACION - this.t),
        texto: `Quedan ${quedan} de ${this.total}`,
      },
    };
  }
}
