// =====================================================================
//  datos-tablero.js — Cómo es el tablero (sin nada de 3D)
// ---------------------------------------------------------------------
//  El tablero es una lista de casillas. Cada casilla tiene:
//    id          -> número de la casilla
//    x, z        -> posición en el suelo (el eje Y es la altura)
//    tipo        -> 'inicio' | 'azul' | 'roja' | 'evento' | 'tienda'
//    siguientes  -> casillas a las que se puede ir desde aquí.
//                   Si hay más de una, es una BIFURCACIÓN.
//    etiquetas   -> (solo bifurcaciones) texto de cada camino.
//
//  La estrella NO es un tipo fijo: se coloca encima de una casilla azul
//  y cambia de sitio cada vez que alguien la compra.
//
//  Forma del tablero (visto desde arriba):
//
//      26 ─────────── arriba ──────────── 16
//      │                                   │
//      29 ═════ atajo central (32-40) ═════ 13   <- bifurcación en 13
//      │                                   │
//      0 ─(salida)── 3 ─── abajo ── 7 ──── 10
//                     ╲   desvío   ╱              <- bifurcación en 3
//                      41 ─ ... ─ 45
// =====================================================================

const lista = [];

/** Añade una casilla a la lista. */
function casilla(id, x, z, tipo, siguientes, etiquetas) {
  lista[id] = { id, x, z, tipo, siguientes, etiquetas: etiquetas || null };
}

// ---- Borde de abajo (de izquierda a derecha): casillas 0 a 10 ----
const tiposAbajo = ['inicio', 'azul', 'azul', 'azul', 'roja', 'azul', 'evento', 'azul', 'tienda', 'azul', 'roja'];
for (let i = 0; i <= 10; i++) {
  casilla(i, -15 + i * 3, 9, tiposAbajo[i], [i + 1]);
}
// Bifurcación 1: en la casilla 3 se puede seguir recto o tomar el desvío del sur
lista[3].siguientes = [4, 41];
lista[3].etiquetas = { 4: 'Seguir recto', 41: 'Desvío del sur (tienda)' };

// ---- Borde derecho (subiendo): casillas 11 a 15 ----
const tiposDerecha = ['azul', 'evento', 'azul', 'azul', 'roja'];
for (let i = 0; i < 5; i++) {
  casilla(11 + i, 15, 6 - i * 3, tiposDerecha[i], [12 + i]);
}
// Bifurcación 2: en la casilla 13 se puede rodear por arriba o coger el atajo
lista[13].siguientes = [14, 32];
lista[13].etiquetas = { 14: 'Rodear por arriba', 32: 'Atajo central (peligroso)' };

// ---- Borde de arriba (de derecha a izquierda): casillas 16 a 26 ----
const tiposArriba = ['azul', 'azul', 'evento', 'azul', 'tienda', 'azul', 'roja', 'azul', 'azul', 'evento', 'azul'];
for (let i = 0; i <= 10; i++) {
  casilla(16 + i, 15 - i * 3, -9, tiposArriba[i], [17 + i]);
}

// ---- Borde izquierdo (bajando): casillas 27 a 31 ----
const tiposIzquierda = ['roja', 'azul', 'azul', 'evento', 'azul'];
for (let i = 0; i < 5; i++) {
  casilla(27 + i, -15, -6 + i * 3, tiposIzquierda[i], [28 + i]);
}
lista[31].siguientes = [0]; // cerramos la vuelta

// ---- Atajo central (de derecha a izquierda): casillas 32 a 40 -> 29 ----
const tiposAtajo = ['roja', 'evento', 'roja', 'azul', 'evento', 'roja', 'azul', 'roja', 'evento'];
for (let i = 0; i < 9; i++) {
  casilla(32 + i, 12 - i * 3, 0, tiposAtajo[i], [33 + i]);
}
lista[40].siguientes = [29];

// ---- Desvío del sur: casillas 41 a 45 -> 7 ----
const desvio = [[-6, 12.2], [-3, 14.6], [0, 15.4], [3, 14.6], [6, 12.2]];
const tiposDesvio = ['azul', 'azul', 'tienda', 'azul', 'azul'];
desvio.forEach(([x, z], i) => casilla(41 + i, x, z, tiposDesvio[i], [42 + i]));
lista[45].siguientes = [7];

/** Todas las casillas del tablero, indexadas por id. */
export const CASILLAS = lista;

/** Casilla donde empiezan todos. */
export const CASILLA_SALIDA = 0;

/** Casillas donde puede aparecer la estrella (azules, lejos de la salida). */
export const CANDIDATAS_ESTRELLA = CASILLAS
  .filter((c) => c.tipo === 'azul' && c.id > 2)
  .map((c) => c.id);

/** Monumentos de España (solo decoración, no son casillas). */
export const MONUMENTOS = [
  { tipo: 'sagrada', nombre: 'Sagrada Família', x: -25, z: -7 },
  { tipo: 'acueducto', nombre: 'Acueducto de Segovia', x: 0, z: -17 },
  { tipo: 'giralda', nombre: 'La Giralda', x: 24, z: -2 },
  { tipo: 'alcala', nombre: 'Puerta de Alcalá', x: -24, z: 13 },
  { tipo: 'molino', nombre: 'Molino de La Mancha', x: 0, z: -4.5 },
  { tipo: 'molino', nombre: 'Molino de La Mancha', x: 23, z: 12 },
];
