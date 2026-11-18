// =====================================================================
//  red-base.js — Lógica común a todas las implementaciones de red
// ---------------------------------------------------------------------
//  Aquí está todo lo que NO depende de la tecnología concreta:
//   - guardar las funciones que escuchan mensajes,
//   - entregar al host sus propios mensajes (como si viajaran por red),
//   - "latidos": mensajes pequeños cada 2 segundos para saber si
//     alguien se ha ido aunque su navegador no avise (cerró la pestaña,
//     se quedó sin internet...).
//
//  Las clases hijas (PeerJS, local...) solo tienen que:
//   - implementar _enviarCrudo(idDestino, paquete) y _cerrarConexion(id)
//   - llamar a _alLlegarPaquete, _alAbrirseConexion, _alCerrarseConexion
//     y _alCerrarseHost cuando pase cada cosa.
// =====================================================================

const INTERVALO_LATIDO_MS = 2000;   // cada cuánto se manda un latido
const LIMITE_SILENCIO_MS = 10000;   // sin noticias en este tiempo = desconectado

// Letras sin caracteres que se confunden (sin O/0, I/1...)
const LETRAS_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Genera un código de sala de 5 caracteres, p. ej. "K7QM2". */
export function generarCodigo() {
  let codigo = '';
  for (let i = 0; i < 5; i++) {
    codigo += LETRAS_CODIGO[Math.floor(Math.random() * LETRAS_CODIGO.length)];
  }
  return codigo;
}

/** Limpia lo que escribe el usuario como código ("k7qm2 " -> "K7QM2"). */
export function normalizarCodigo(texto) {
  return String(texto || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Copia profunda: simula que los datos viajan por la red. */
function copiar(datos) {
  return JSON.parse(JSON.stringify(datos));
}

export class RedBase {
  constructor() {
    this.miId = null;
    this.esHost = false;
    this.codigo = null;

    // Funciones que escuchan (las registra el juego)
    this._fnHost = () => {};
    this._fnJugador = () => {};
    this._fnDesconexion = () => {};
    this._fnHostPerdido = () => {};

    // Host: id del jugador -> momento del último mensaje recibido
    this._ultimoContacto = new Map();
    // Jugador: momento del último mensaje del host
    this._ultimoDelHost = 0;
    this._temporizadorLatidos = null;
    this._cerrado = false;
    this._hostPerdidoAvisado = false;
  }

  // ------------------------- Registro de escuchas -------------------------
  alRecibirComoHost(fn) { this._fnHost = fn; }
  alRecibirComoJugador(fn) { this._fnJugador = fn; }
  alDesconectarseJugador(fn) { this._fnDesconexion = fn; }
  alPerderHost(fn) { this._fnHostPerdido = fn; }

  // ------------------------------ Envío -----------------------------------
  enviarAlHost(datos) {
    if (this._cerrado) return;
    if (this.esHost) {
      // El host se "envía" el mensaje a sí mismo, de forma asíncrona
      // para que se comporte igual que un mensaje real.
      const copia = copiar(datos);
      setTimeout(() => this._fnHost(this.miId, copia), 0);
    } else {
      this._enviarCrudo(null, { k: 'app', d: datos });
    }
  }

  enviarATodos(datos) {
    if (!this.esHost || this._cerrado) return;
    for (const id of this._ultimoContacto.keys()) {
      this._enviarCrudo(id, { k: 'app', d: datos });
    }
    const copia = copiar(datos);
    setTimeout(() => this._fnJugador(copia), 0);
  }

  enviarA(idJugador, datos) {
    if (!this.esHost || this._cerrado) return;
    if (idJugador === this.miId) {
      const copia = copiar(datos);
      setTimeout(() => this._fnJugador(copia), 0);
    } else {
      this._enviarCrudo(idJugador, { k: 'app', d: datos });
    }
  }

  desconectarJugador(id) {
    if (!this.esHost || id === this.miId) return;
    // Esperamos un poco para que le dé tiempo a llegar el último mensaje
    setTimeout(() => {
      this._cerrarConexion(id);
      this._ultimoContacto.delete(id);
    }, 300);
  }

  // ------------------- Avisos que llaman las clases hijas -------------------

  /** Ha llegado un paquete de otro navegador. */
  _alLlegarPaquete(deId, paquete) {
    if (this._cerrado || !paquete) return;
    if (this.esHost) {
      if (!this._ultimoContacto.has(deId)) return; // conexión desconocida
      this._ultimoContacto.set(deId, Date.now());
      if (paquete.k === 'app') this._fnHost(deId, paquete.d);
    } else {
      this._ultimoDelHost = Date.now();
      if (paquete.k === 'latido') this._enviarCrudo(null, { k: 'latido' });
      if (paquete.k === 'app') this._fnJugador(paquete.d);
    }
  }

  /** (Host) Un navegador nuevo se ha conectado. */
  _alAbrirseConexion(id) {
    this._ultimoContacto.set(id, Date.now());
  }

  /** (Host) Se ha cerrado la conexión con un jugador. */
  _alCerrarseConexion(id) {
    if (!this._ultimoContacto.has(id)) return;
    this._ultimoContacto.delete(id);
    if (!this._cerrado) this._fnDesconexion(id);
  }

  /** (Jugador) Se ha perdido la conexión con el host. */
  _alCerrarseHost() {
    if (this._cerrado || this._hostPerdidoAvisado) return;
    this._hostPerdidoAvisado = true;
    this._pararLatidos();
    this._fnHostPerdido();
  }

  // ------------------------------- Latidos --------------------------------
  _iniciarLatidos() {
    this._ultimoDelHost = Date.now();
    this._temporizadorLatidos = setInterval(() => {
      const ahora = Date.now();
      if (this.esHost) {
        for (const [id, ultimo] of [...this._ultimoContacto]) {
          if (ahora - ultimo > LIMITE_SILENCIO_MS) {
            this._cerrarConexion(id);
            this._alCerrarseConexion(id);
          } else {
            this._enviarCrudo(id, { k: 'latido' });
          }
        }
      } else if (ahora - this._ultimoDelHost > LIMITE_SILENCIO_MS) {
        this._alCerrarseHost();
      }
    }, INTERVALO_LATIDO_MS);
  }

  _pararLatidos() {
    clearInterval(this._temporizadorLatidos);
    this._temporizadorLatidos = null;
  }

  /** Marca la red como cerrada (las clases hijas amplían este método). */
  cerrar() {
    this._cerrado = true;
    this._pararLatidos();
  }

  // ------------- Métodos que DEBEN implementar las clases hijas -------------
  // idDestino === null significa "al host".
  _enviarCrudo(idDestino, paquete) { throw new Error('No implementado'); }
  _cerrarConexion(id) { throw new Error('No implementado'); }
}
