// =====================================================================
//  pantallas.js — Cambiar de pantalla, avisos y ventanas
// =====================================================================

/** Atajo para buscar un elemento por su id. */
export const $ = (id) => document.getElementById(id);

/** Muestra solo la pantalla indicada: 'inicio' | 'sala' | 'juego'. */
export function mostrarPantalla(nombre) {
  for (const p of document.querySelectorAll('.pantalla')) {
    p.classList.toggle('activa', p.id === 'pantalla-' + nombre);
  }
}

/** Muestra un aviso flotante que desaparece solo. */
export function mostrarAviso(texto, duracionMs = 4000) {
  const caja = $('avisos');
  const div = document.createElement('div');
  div.className = 'aviso';
  div.textContent = texto;
  caja.appendChild(div);
  // Como mucho 4 avisos a la vez
  while (caja.children.length > 4) caja.firstChild.remove();
  setTimeout(() => { div.style.opacity = '0'; }, duracionMs);
  setTimeout(() => div.remove(), duracionMs + 600);
}

/** Ventana importante con un botón (p. ej. "el host se ha ido"). */
export function mostrarModal(titulo, texto, textoBoton, alPulsar) {
  $('modal-titulo').textContent = titulo;
  $('modal-texto').textContent = texto;
  const boton = $('modal-boton');
  boton.textContent = textoBoton || 'Aceptar';
  boton.onclick = () => {
    $('modal').classList.add('oculto');
    if (alPulsar) alPulsar();
  };
  $('modal').classList.remove('oculto');
}

/** Crea un <li> con un puntito de color y un texto. */
export function filaJugador(color, nombre) {
  const li = document.createElement('li');
  const punto = document.createElement('span');
  punto.className = 'punto';
  punto.style.background = color;
  const span = document.createElement('span');
  span.className = 'nombre';
  span.textContent = nombre;
  li.append(punto, span);
  return li;
}

/** Añade una etiqueta pequeña (tipo "HOST" o "TÚ") a una fila. */
export function ponerEtiqueta(li, texto, clase = '') {
  const e = document.createElement('span');
  e.className = 'etiqueta ' + clase;
  e.textContent = texto;
  li.appendChild(e);
}

/** ¿Está el usuario escribiendo en una caja de texto? */
export function escribiendo() {
  const el = document.activeElement;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
}
