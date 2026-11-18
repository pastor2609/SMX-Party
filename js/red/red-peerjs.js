// =====================================================================
//  red-peerjs.js — Red ONLINE usando PeerJS (WebRTC, peer-to-peer)
// ---------------------------------------------------------------------
//  - PeerJS usa un servidor público y gratuito solo para "presentar" a
//    los navegadores. Después, los datos van directamente de navegador
//    a navegador.
//  - El host se registra con el nombre "smxparty-<CÓDIGO>". Los demás
//    se conectan a ese nombre.
//  - La librería se carga desde CDN en index.html y queda en window.Peer.
// =====================================================================

import { RedBase, generarCodigo, normalizarCodigo } from './red-base.js';

const PREFIJO = 'smxparty-';
const TIEMPO_MAX_CONEXION_MS = 15000;

export class RedPeerJS extends RedBase {
  constructor() {
    super();
    this._peer = null;
    this._conexiones = new Map(); // (host) id jugador -> DataConnection
    this._conexionHost = null;    // (jugador) conexión con el host
  }

  /** Comprueba que la librería PeerJS se ha cargado. */
  _comprobarLibreria() {
    if (typeof window.Peer !== 'function') {
      throw new Error('No se ha podido cargar PeerJS. ¿Tienes conexión a internet?');
    }
  }

  /** Abre un Peer con el id indicado (o uno aleatorio si es null). */
  _abrirPeer(id) {
    return new Promise((resolver, rechazar) => {
      const peer = id ? new window.Peer(id, { debug: 1 }) : new window.Peer({ debug: 1 });
      const alError = (err) => { peer.off('open', alAbrir); peer.destroy(); rechazar(err); };
      const alAbrir = () => { peer.off('error', alError); resolver(peer); };
      peer.once('open', alAbrir);
      peer.once('error', alError);
    });
  }

  // ------------------------------- HOST -----------------------------------
  async crearSala() {
    this._comprobarLibreria();
    // Probamos varios códigos por si alguno ya está en uso
    for (let intento = 0; intento < 5; intento++) {
      const codigo = generarCodigo();
      try {
        this._peer = await this._abrirPeer(PREFIJO + codigo);
        this.codigo = codigo;
        break;
      } catch (err) {
        if (err && err.type === 'unavailable-id') continue;
        throw new Error('No se pudo crear la sala: ' + traducirError(err));
      }
    }
    if (!this._peer) throw new Error('No se encontró un código libre. Inténtalo otra vez.');

    this.esHost = true;
    this.miId = this._peer.id;

    // Cuando alguien se conecta a nuestra sala...
    this._peer.on('connection', (conn) => {
      conn.on('open', () => {
        this._conexiones.set(conn.peer, conn);
        this._alAbrirseConexion(conn.peer);
      });
      conn.on('data', (paquete) => this._alLlegarPaquete(conn.peer, paquete));
      conn.on('close', () => {
        this._conexiones.delete(conn.peer);
        this._alCerrarseConexion(conn.peer);
      });
      conn.on('error', () => {
        this._conexiones.delete(conn.peer);
        this._alCerrarseConexion(conn.peer);
      });
    });

    // Si perdemos el servidor de presentación, intentamos volver
    // (las conexiones ya abiertas siguen funcionando).
    this._peer.on('disconnected', () => {
      if (!this._cerrado && this._peer && !this._peer.destroyed) this._peer.reconnect();
    });
    this._peer.on('error', (err) => console.warn('[red] Error PeerJS (host):', err && err.type));

    this._iniciarLatidos();
    return this.codigo;
  }

  // ------------------------------ JUGADOR ---------------------------------
  async unirseASala(codigoEscrito) {
    this._comprobarLibreria();
    const codigo = normalizarCodigo(codigoEscrito);
    if (codigo.length < 4) throw new Error('El código no es válido.');

    try {
      this._peer = await this._abrirPeer(null);
    } catch (err) {
      throw new Error('No se pudo conectar: ' + traducirError(err));
    }
    this.miId = this._peer.id;
    this.codigo = codigo;

    await new Promise((resolver, rechazar) => {
      const conn = this._peer.connect(PREFIJO + codigo, { reliable: true, serialization: 'json' });
      const temporizador = setTimeout(() => {
        rechazar(new Error('La sala no responde. Revisa el código.'));
      }, TIEMPO_MAX_CONEXION_MS);

      // Si la sala no existe, PeerJS avisa con un error en el peer
      this._peer.on('error', (err) => {
        clearTimeout(temporizador);
        if (!this._conexionHost) rechazar(new Error(traducirError(err)));
      });

      conn.on('open', () => {
        clearTimeout(temporizador);
        this._conexionHost = conn;
        resolver();
      });
      conn.on('data', (paquete) => this._alLlegarPaquete(null, paquete));
      conn.on('close', () => this._alCerrarseHost());
      conn.on('error', () => this._alCerrarseHost());
    });

    this._iniciarLatidos();
  }

  // ------------------------- Transporte concreto --------------------------
  _enviarCrudo(idDestino, paquete) {
    const conn = idDestino === null ? this._conexionHost : this._conexiones.get(idDestino);
    if (conn && conn.open) {
      try { conn.send(paquete); } catch (e) { console.warn('[red] No se pudo enviar', e); }
    }
  }

  _cerrarConexion(id) {
    const conn = this._conexiones.get(id);
    if (conn) { try { conn.close(); } catch (e) { /* da igual */ } }
    this._conexiones.delete(id);
  }

  cerrar() {
    super.cerrar();
    try {
      for (const conn of this._conexiones.values()) conn.close();
      if (this._conexionHost) this._conexionHost.close();
      if (this._peer) this._peer.destroy();
    } catch (e) { /* da igual */ }
    this._conexiones.clear();
  }
}

/** Convierte los errores técnicos de PeerJS en frases entendibles. */
function traducirError(err) {
  const tipo = err && err.type;
  switch (tipo) {
    case 'peer-unavailable': return 'No existe ninguna sala con ese código.';
    case 'network': return 'Problema de red. Revisa tu conexión a internet.';
    case 'server-error': return 'El servidor de PeerJS no responde. Prueba más tarde.';
    case 'browser-incompatible': return 'Tu navegador no es compatible. Usa Chrome, Edge o Firefox.';
    case 'unavailable-id': return 'Ese código ya está en uso.';
    default: return (err && err.message) || 'Error desconocido.';
  }
}
