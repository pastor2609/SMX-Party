// =====================================================================
//  main.js — Punto de entrada: une la red, las reglas y la interfaz
// ---------------------------------------------------------------------
//  Flujo:
//   1. Pantalla de inicio: el jugador escribe su nombre y crea o se une.
//   2. Si CREA la sala, este navegador es el host: se crea un
//      "Anfitrion" que lleva la sala y la partida.
//   3. TODOS (host incluido) se comportan como jugadores: mandan
//      mensajes al host y dibujan lo que el host les devuelve.
// =====================================================================

import { crearRed, nombreTipoRed } from './red/red.js';
import { normalizarCodigo } from './red/red-base.js';
import { Anfitrion, limpiarNombre } from './reglas/anfitrion.js';
import { $, mostrarPantalla, mostrarAviso, mostrarModal, escribiendo } from './interfaz/pantallas.js';
import { Chat } from './interfaz/chat.js';
import { PantallaSala } from './interfaz/sala.js';
import { Hud } from './interfaz/hud.js';
import { ControladorMinijuegos } from './minijuegos/controlador.js';
import { MINIJUEGOS } from './minijuegos/registro.js';

// Estado de ESTE navegador
const app = {
  red: null,          // objeto de red (ver js/red/red.js)
  anfitrion: null,    // solo si soy el host
  unido: false,       // el host ya me ha aceptado
  enPartida: false,
  escena: null,       // escena 3D (se crea al empezar la primera partida)
  estado: null,       // último estado de partida recibido
};

// ---------------------------------------------------------------------
//  Interfaz
// ---------------------------------------------------------------------

const chat = new Chat((texto) => app.red && app.red.enviarAlHost({ t: 'chat', texto }));

const pantallaSala = new PantallaSala({
  alCambiarConfig: (rondas, maxJugadores) => app.red.enviarAlHost({ t: 'config', rondas, maxJugadores }),
  alEmpezar: () => app.red.enviarAlHost({ t: 'empezar' }),
  alSalir: () => reiniciar(),
});

/** Envía una acción de juego al host. */
const accion = (nombre, datos) => app.red && app.red.enviarAlHost({ t: 'accion', accion: nombre, datos });

const hud = new Hud({
  alTirar: () => accion('tirarDado'),
  alSaltar: () => accion('saltar'),
  alElegir: (opcion) => accion('elegir', { opcion }),
  alVolverSala: () => app.red.enviarAlHost({ t: 'volverSala' }),
  alSalir: () => reiniciar(),
});

const minijuegos = new ControladorMinijuegos({
  enviarAlHost: (datos) => app.red && app.red.enviarAlHost(datos),
  alAbrir: () => { if (app.escena) app.escena.pausar(); },
  alCerrar: () => { if (app.escena) app.escena.reanudar(); },
});

// Modo prueba: "?minijuego=plataforma" en la dirección (solo para el host)
const minijuegoDePrueba = MINIJUEGOS[new URLSearchParams(location.search).get('minijuego')] || null;
$('btn-probar-mj').addEventListener('click', () => {
  app.red.enviarAlHost({ t: 'probarMinijuego', id: minijuegoDePrueba.id });
});

/** Cierra la conexión y vuelve a cargar la página (vuelta al inicio limpia). */
function reiniciar() {
  if (app.red) app.red.cerrar();
  location.reload();
}

// ---------------------------------------------------------------------
//  Pantalla de inicio
// ---------------------------------------------------------------------

$('inicio-red').textContent = 'Modo de red: ' + nombreTipoRed();

// Recordar el nombre de la última vez (si el navegador lo permite)
try { $('input-nombre').value = localStorage.getItem('smx-nombre') || ''; } catch { /* sin almacenamiento */ }
// Si la dirección trae "?sala=CODIGO", lo rellenamos
const codigoEnUrl = new URLSearchParams(location.search).get('sala');
if (codigoEnUrl) $('input-codigo').value = normalizarCodigo(codigoEnUrl);

function leerNombre() {
  const nombre = limpiarNombre($('input-nombre').value);
  try { localStorage.setItem('smx-nombre', nombre); } catch { /* da igual */ }
  return nombre;
}

function bloquearInicio(bloquear, texto) {
  $('btn-crear').disabled = bloquear;
  $('btn-unirse').disabled = bloquear;
  $('inicio-error').textContent = texto || '';
  $('inicio-error').style.color = bloquear ? 'var(--gris)' : '';
}

function errorInicio(texto) {
  if (app.red) app.red.cerrar();
  app.red = null;
  app.anfitrion = null;
  bloquearInicio(false, texto);
}

$('btn-crear').addEventListener('click', async () => {
  const nombre = leerNombre();
  bloquearInicio(true, 'Creando sala…');
  app.red = crearRed();
  try {
    await app.red.crearSala();
  } catch (err) {
    return errorInicio(err.message);
  }
  app.anfitrion = new Anfitrion(app.red); // ¡soy el host!
  escucharRed();
  entrarEnSala(nombre);
});

$('btn-unirse').addEventListener('click', unirse);
$('input-codigo').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') unirse(); });

async function unirse() {
  const nombre = leerNombre();
  const codigo = normalizarCodigo($('input-codigo').value);
  if (!codigo) return bloquearInicio(false, 'Escribe el código de la sala.');
  bloquearInicio(true, 'Conectando con la sala…');
  app.red = crearRed();
  try {
    await app.red.unirseASala(codigo);
  } catch (err) {
    return errorInicio(err.message);
  }
  escucharRed();
  entrarEnSala(nombre);
}

/** Pide al host entrar. Si no contesta en 8 s, error. */
function entrarEnSala(nombre) {
  app.red.enviarAlHost({ t: 'unirse', nombre });
  setTimeout(() => {
    if (!app.unido && app.red) errorInicio('El host no ha contestado. Inténtalo de nuevo.');
  }, 8000);
}

// ---------------------------------------------------------------------
//  Mensajes que llegan del host
// ---------------------------------------------------------------------

function escucharRed() {
  app.red.alRecibirComoJugador((msg) => alMensaje(msg));
  app.red.alPerderHost(() => {
    mostrarModal(
      '⚠️ El host se ha ido',
      'La persona que creó la sala se ha desconectado. La partida no puede continuar.',
      'Volver al inicio',
      reiniciar,
    );
  });
}

function alMensaje(msg) {
  switch (msg.t) {
    case 'bienvenida':
      app.unido = true;
      break;

    case 'rechazo':
      app.unido = true; // para que no salte también el error de "no contesta"
      mostrarModal('No puedes entrar', msg.motivo, 'Volver al inicio', reiniciar);
      break;

    case 'sala':
      app.enPartida = false;
      app.estado = null;
      minijuegos.cerrar();
      pantallaSala.mostrar(msg.sala, app.red.miId);
      // Botón del modo prueba (solo el host y solo con ?minijuego=...)
      $('btn-probar-mj').classList.toggle('oculto', !(minijuegoDePrueba && app.red.esHost));
      if (minijuegoDePrueba) $('btn-probar-mj').textContent = `🧪 Probar minijuego: ${minijuegoDePrueba.nombre}`;
      chat.moverA('hueco-chat-sala');
      mostrarPantalla('sala');
      break;

    case 'estado':
      alEstado(msg.estado);
      break;

    case 'rt':
      // Foto de un minijuego de tiempo real (unas 20 por segundo)
      minijuegos.alInstantanea(msg.d);
      break;

    case 'aviso':
      mostrarAviso(msg.texto);
      break;

    case 'chat':
      chat.agregar(msg);
      break;

    default:
      break;
  }
}

async function alEstado(estado) {
  app.estado = estado;
  if (!app.enPartida) {
    // Primera vez que llega un estado: pasamos a la pantalla de partida
    app.enPartida = true;
    mostrarPantalla('juego');
    chat.moverA('hueco-chat-juego');
    await prepararEscena();
  }
  // Dibujamos siempre el estado MÁS RECIENTE (puede haber llegado otro
  // mientras se cargaba el 3D)
  if (app.escena) app.escena.actualizar(app.estado);
  hud.actualizar(app.estado, app.red.miId, app.red.esHost);
  // Minijuego: se abre, avanza de etapa o se cierra
  if (app.estado.fase === 'minijuego' && app.estado.minijuego) {
    minijuegos.actualizar(app.estado, app.red.miId, app.red.esHost);
  } else {
    minijuegos.cerrar();
  }
}

/** Carga la parte 3D (Three.js) solo cuando hace falta. */
async function prepararEscena() {
  if (app.escena) {
    app.escena.limpiarFichas();
    app.escena.redimensionar();
    return;
  }
  if (app._cargandoEscena) return app._cargandoEscena;
  app._cargandoEscena = (async () => {
    try {
      const { Escena } = await import('./tablero/escena.js');
      app.escena = new Escena($('escena'));
      if (minijuegos.abierto) app.escena.pausar(); // por si ya empezó un minijuego
    } catch (err) {
      console.error(err);
      mostrarModal('No se pudo cargar el 3D',
        'No se ha podido cargar Three.js. Revisa tu conexión a internet y recarga la página.', 'Vale');
    }
  })();
  return app._cargandoEscena;
}

// ---------------------------------------------------------------------
//  Teclado
// ---------------------------------------------------------------------

document.addEventListener('keydown', (ev) => {
  if (!app.enPartida) return;
  if (ev.key === 'Enter' && !escribiendo()) {
    $('chat-input').focus();   // Enter: escribir en el chat
    ev.preventDefault();
    return;
  }
  if (escribiendo()) return;
  if (minijuegos.abierto) {
    // En los minijuegos, las teclas las lee el propio minijuego
    if (ev.code === 'Space') { ev.preventDefault(); minijuegos.teclaEspacio(); }
    return;
  }
  if (ev.code === 'Space') {
    ev.preventDefault();
    hud.teclaEspacio();
  } else if (/^[1-9]$/.test(ev.key)) {
    hud.teclaNumero(Number(ev.key));
  }
});

// Al cerrar la pestaña, avisamos a los demás
window.addEventListener('beforeunload', () => { if (app.red) app.red.cerrar(); });

// Todo ha cargado bien: avisamos a index.html para que no muestre el
// aviso de "El juego no ha podido arrancar".
window.__smxArrancado = true;
