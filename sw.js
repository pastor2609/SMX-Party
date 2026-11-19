// =====================================================================
//  sw.js — "Service worker": evita que el navegador use archivos viejos
// ---------------------------------------------------------------------
//  PROBLEMA QUE ARREGLA:
//  GitHub Pages deja que el navegador guarde los archivos (caché) unos
//  minutos. Tras publicar una versión nueva, el navegador podía mezclar
//  el index.html nuevo con archivos .js viejos (o usarlo todo viejo), y
//  el juego no arrancaba o salía la versión anterior. Ctrl+F5 no
//  siempre renueva los módulos de JavaScript.
//
//  QUÉ HACE:
//  Cada vez que el juego pide un archivo propio (html, css, js), este
//  ayudante le pregunta antes a GitHub "¿ha cambiado?". Si no ha
//  cambiado, GitHub contesta "sigue igual" (rapidísimo) y se usa el que
//  ya había. Si ha cambiado, se descarga el nuevo. Así nunca se mezclan
//  versiones.
//
//  No toca las librerías externas (Three.js, PeerJS), que ya llevan su
//  número de versión en la dirección y nunca cambian.
// =====================================================================

// Activarse en cuanto se instala (sin esperar a cerrar las pestañas)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  const esNuestro = new URL(peticion.url).origin === self.location.origin;
  if (peticion.method !== 'GET' || !esNuestro) return; // lo demás, como siempre

  evento.respondWith(
    // 'no-cache' = usa la copia guardada SOLO si el servidor confirma que sigue igual
    fetch(peticion, { cache: 'no-cache' }).catch(() => fetch(peticion)),
  );
});
