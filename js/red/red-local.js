// =====================================================================
//  red-local.js — Red de PRUEBAS entre pestañas del mismo navegador
// ---------------------------------------------------------------------
//  Usa BroadcastChannel, que permite que varias pestañas del MISMO
//  navegador se manden mensajes, sin internet.
//  Se activa añadiendo "?red=local" al final de la dirección.
//
//  Sirve también como ejemplo de que la red es intercambiable: tiene
//  exactamente los mismos métodos que red-peerjs.js.
// =====================================================================

import { RedBase, generarCodigo, normalizarCodigo } from './red-base.js';

const ID_HOST = 'host';

/** Crea un identificador aleatorio para esta pestaña. */
function idAleatorio() {
  return 'p-' + Math.random().toString(36).slice(2, 10);
}

export class RedLocal extends RedBase {
  constructor() {
    super();
    this._canal = null;
  }

  _abrirCanal(codigo) {
    this._canal = new BroadcastChannel('smxparty-' + codigo);
    this._canal.onmessage = (ev) => this._alMensajeCanal(ev.data);
  }

  _publicar(mensaje) {
    if (this._canal) this._canal.postMessage({ ...mensaje, de: this.miId });
  }

  _alMensajeCanal(msg) {
    if (!msg || msg.de === this.miId) return;
    if (msg.para && msg.para !== this.miId) return; // no es para mí

    if (this.esHost) {
      if (msg.tipo === 'hola') {
        this._alAbrirseConexion(msg.de);
        this._publicar({ tipo: 'bienvenido', para: msg.de });
      } else if (msg.tipo === 'paquete') {
        this._alLlegarPaquete(msg.de, msg.paquete);
      } else if (msg.tipo === 'adios') {
        this._alCerrarseConexion(msg.de);
      }
    } else {
      if (msg.de !== ID_HOST) return; // los jugadores solo escuchan al host
      if (msg.tipo === 'bienvenido' && this._resolverUnion) {
        this._resolverUnion();
        this._resolverUnion = null;
      } else if (msg.tipo === 'paquete') {
        this._alLlegarPaquete(null, msg.paquete);
      } else if (msg.tipo === 'adios' || msg.tipo === 'expulsado') {
        this._alCerrarseHost();
      }
    }
  }

  // ------------------------------- HOST -----------------------------------
  async crearSala() {
    this.codigo = generarCodigo();
    this.esHost = true;
    this.miId = ID_HOST;
    this._abrirCanal(this.codigo);
    this._iniciarLatidos();
    return this.codigo;
  }

  // ------------------------------ JUGADOR ---------------------------------
  async unirseASala(codigoEscrito) {
    const codigo = normalizarCodigo(codigoEscrito);
    if (codigo.length < 4) throw new Error('El código no es válido.');
    this.codigo = codigo;
    this.miId = idAleatorio();
    this._abrirCanal(codigo);

    await new Promise((resolver, rechazar) => {
      this._resolverUnion = resolver;
      this._publicar({ tipo: 'hola', para: ID_HOST });
      setTimeout(() => {
        if (this._resolverUnion) {
          this._resolverUnion = null;
          this._canal.close();
          this._canal = null;
          rechazar(new Error('No existe ninguna sala con ese código (en este navegador).'));
        }
      }, 2000);
    });
    this._iniciarLatidos();
  }

  // ------------------------- Transporte concreto --------------------------
  _enviarCrudo(idDestino, paquete) {
    this._publicar({ tipo: 'paquete', para: idDestino === null ? ID_HOST : idDestino, paquete });
  }

  _cerrarConexion(id) {
    this._publicar({ tipo: 'expulsado', para: id });
  }

  cerrar() {
    if (this._canal) {
      this._publicar({ tipo: 'adios' });
      this._canal.close();
      this._canal = null;
    }
    super.cerrar();
  }
}
