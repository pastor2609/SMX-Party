// =====================================================================
//  anfitrion.js — Todo lo que hace el HOST (sala de espera + partida)
// ---------------------------------------------------------------------
//  Solo existe en el navegador de quien creó la sala.
//  Recibe TODOS los mensajes de los jugadores (también los del propio
//  host, que se los "manda a sí mismo") y responde.
//
//  Mensajes que recibe (jugador -> host):
//    { t: 'unirse', nombre }
//    { t: 'chat', texto }
//    { t: 'config', rondas, maxJugadores }     (solo el host)
//    { t: 'empezar' }                          (solo el host)
//    { t: 'accion', accion, datos }            (durante la partida)
//    { t: 'volverSala' }                       (solo el host, al final)
//    { t: 'entrada', d }                       (controles en tiempo real)
//    { t: 'probarMinijuego', id }              (solo el host, modo prueba)
//
//  Mensajes que envía (host -> jugadores):
//    { t: 'bienvenida', tuId }
//    { t: 'rechazo', motivo }
//    { t: 'sala', sala }
//    { t: 'estado', estado }
//    { t: 'aviso', texto }
//    { t: 'rt', d }            (fotos de los minijuegos de tiempo real)
//    { t: 'chat', nombre, color, texto, sistema }
// =====================================================================

import { CONFIG, COLORES_JUGADOR } from './config.js';
import { MotorPartida } from './motor.js';
import { MINIJUEGOS } from '../minijuegos/registro.js';

/** Limpia un nombre: sin espacios de más y con largo máximo. */
export function limpiarNombre(texto) {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, CONFIG.MAX_LARGO_NOMBRE);
  return limpio || 'Jugador';
}

export class Anfitrion {
  constructor(red) {
    this.red = red;
    this.motor = null;
    this.sala = {
      codigo: red.codigo,
      idHost: red.miId,
      jugadores: [],               // [{ id, nombre, color }]
      rondas: 10,
      maxJugadores: CONFIG.MAX_JUGADORES,
    };

    red.alRecibirComoHost((de, msg) => this._alMensaje(de, msg));
    red.alDesconectarseJugador((id) => this._alDesconectar(id));
  }

  _esHost(id) { return id === this.sala.idHost; }
  _buscar(id) { return this.sala.jugadores.find((j) => j.id === id); }
  _enviarSala() { this.red.enviarATodos({ t: 'sala', sala: this.sala }); }

  _mensajeSistema(texto) {
    this.red.enviarATodos({ t: 'chat', sistema: true, texto });
  }

  _alMensaje(de, msg) {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'unirse': return this._unirse(de, msg.nombre);
      case 'chat': return this._chat(de, msg.texto);
      case 'config': return this._config(de, msg);
      case 'empezar': return this._empezar(de);
      case 'accion':
        if (this.motor && this._buscar(de)) this.motor.recibirAccion(de, msg.accion, msg.datos);
        return;
      case 'volverSala': return this._volverSala(de);
      case 'entrada':
        if (this.motor && this._buscar(de)) this.motor.recibirEntrada(de, msg.d);
        return;
      case 'probarMinijuego': return this._probarMinijuego(de, msg.id);
      default: return;
    }
  }

  // --------------------------- Sala de espera ---------------------------
  _unirse(id, nombre) {
    if (this._buscar(id)) return; // ya estaba

    let motivo = null;
    if (this.motor) motivo = 'La partida ya ha empezado.';
    else if (this.sala.jugadores.length >= this.sala.maxJugadores) motivo = 'La sala está llena.';

    if (motivo) {
      this.red.enviarA(id, { t: 'rechazo', motivo });
      this.red.desconectarJugador(id);
      return;
    }

    // Primer color libre
    const usados = this.sala.jugadores.map((j) => j.color);
    const color = COLORES_JUGADOR.find((c) => !usados.includes(c)) || '#ffffff';
    const jugador = { id, nombre: limpiarNombre(nombre), color };
    this.sala.jugadores.push(jugador);

    this.red.enviarA(id, { t: 'bienvenida', tuId: id });
    this._enviarSala();
    this._mensajeSistema(`👋 ${jugador.nombre} se ha unido a la sala.`);
  }

  _chat(id, texto) {
    const j = this._buscar(id);
    if (!j) return;
    const limpio = String(texto || '').trim().slice(0, CONFIG.MAX_LARGO_CHAT);
    if (!limpio) return;
    this.red.enviarATodos({ t: 'chat', nombre: j.nombre, color: j.color, texto: limpio });
  }

  _config(id, msg) {
    if (!this._esHost(id) || this.motor) return;
    if (CONFIG.OPCIONES_RONDAS.includes(Number(msg.rondas))) this.sala.rondas = Number(msg.rondas);
    const max = Number(msg.maxJugadores);
    if (max >= CONFIG.MIN_JUGADORES && max <= CONFIG.MAX_JUGADORES) {
      // No se puede bajar por debajo de los que ya hay
      this.sala.maxJugadores = Math.max(max, this.sala.jugadores.length);
    }
    this._enviarSala();
  }

  _empezar(id) {
    if (!this._esHost(id) || this.motor) return;
    if (this.sala.jugadores.length < CONFIG.MIN_JUGADORES) {
      this.red.enviarA(id, { t: 'aviso', texto: `Hacen falta al menos ${CONFIG.MIN_JUGADORES} jugadores.` });
      return;
    }
    this._crearMotor(null);
    this._mensajeSistema(`🚀 ¡Empieza la partida! ${this.sala.rondas} rondas.`);
  }

  /** Modo prueba: jugar solo un minijuego (vale con 1 jugador). */
  _probarMinijuego(id, idMinijuego) {
    if (!this._esHost(id) || this.motor || !MINIJUEGOS[idMinijuego]) return;
    this._mensajeSistema(`🧪 Modo prueba: ${MINIJUEGOS[idMinijuego].nombre}`);
    const motor = this._crearMotor(idMinijuego);
    // Al acabar el minijuego, todos vuelven a la sala
    motor.terminado.then(() => {
      if (this.motor === motor) this._volverSala(this.sala.idHost);
    });
  }

  _crearMotor(minijuegoDePrueba) {
    this.motor = new MotorPartida({
      jugadores: this.sala.jugadores,
      rondas: this.sala.rondas,
      idHost: this.sala.idHost,
      emitir: (estado) => this.red.enviarATodos({ t: 'estado', estado }),
      avisar: (texto) => this.red.enviarATodos({ t: 'aviso', texto }),
      emitirTiempoReal: (d) => this.red.enviarATodos({ t: 'rt', d }),
      minijuegoDePrueba,
    });
    this.motor.terminado = this.motor.iniciar();
    return this.motor;
  }

  _volverSala(id) {
    if (!this._esHost(id) || !this.motor) return;
    this.motor.detener();
    this.motor = null;
    this._enviarSala();
    this._mensajeSistema('🏠 El host ha vuelto a la sala de espera.');
  }

  // ---------------------------- Desconexiones ----------------------------
  _alDesconectar(id) {
    const j = this._buscar(id);
    if (!j) return;
    this.sala.jugadores = this.sala.jugadores.filter((x) => x.id !== id);
    if (this.motor) {
      this.motor.jugadorDesconectado(id);
    } else {
      this._enviarSala();
      this._mensajeSistema(`🚪 ${j.nombre} ha salido de la sala.`);
    }
  }
}
