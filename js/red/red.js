// =====================================================================
//  red.js — PUNTO DE ENTRADA DE TODA LA PARTE DE RED
// ---------------------------------------------------------------------
//  El resto del juego SOLO habla con la red a través del objeto que
//  devuelve crearRed(). Así, si algún día queremos usar Firebase en vez
//  de PeerJS, basta con escribir otra implementación con los mismos
//  métodos (por ejemplo red-firebase.js) y elegirla aquí.
//
//  INTERFAZ (lo que cualquier implementación debe ofrecer):
//
//    Propiedades
//      miId      -> identificador único de este navegador en la sala
//      esHost    -> true si este navegador creó la sala
//      codigo    -> código de la sala (p. ej. "K7QM2")
//
//    Conexión
//      crearSala()            -> Promise<codigo>  (me convierto en host)
//      unirseASala(codigo)    -> Promise<void>    (me uno como jugador)
//      cerrar()               -> me voy de la sala
//
//    Enviar
//      enviarAlHost(datos)          -> cualquiera. Si YO soy el host,
//                                      el mensaje me llega a mí mismo.
//      enviarATodos(datos)          -> solo host. Incluye al propio host.
//      enviarA(idJugador, datos)    -> solo host.
//      desconectarJugador(id)       -> solo host. Echa a un jugador.
//
//    Escuchar
//      alRecibirComoHost(fn(idRemitente, datos))  -> solo host
//      alRecibirComoJugador(fn(datos))            -> todos (host incluido)
//      alDesconectarseJugador(fn(id))             -> solo host
//      alPerderHost(fn())                         -> solo jugadores
//
//  "datos" es siempre un objeto sencillo (se convierte a JSON).
// =====================================================================

import { RedPeerJS } from './red-peerjs.js';
import { RedLocal } from './red-local.js';

/**
 * Crea el objeto de red adecuado.
 * Por defecto usa PeerJS (online). Si la dirección termina en
 * "?red=local" usa un canal entre pestañas del mismo navegador
 * (sirve para probar sin internet).
 */
export function crearRed() {
  const tipo = new URLSearchParams(location.search).get('red');
  if (tipo === 'local') return new RedLocal();
  return new RedPeerJS();
}

/** Indica qué tipo de red se está usando (para mostrarlo en pantalla). */
export function nombreTipoRed() {
  const tipo = new URLSearchParams(location.search).get('red');
  return tipo === 'local' ? 'local (misma máquina)' : 'online (PeerJS)';
}
