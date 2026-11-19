// =====================================================================
//  registro.js — Lista de TODOS los minijuegos del juego
// ---------------------------------------------------------------------
//  CÓMO AÑADIR UN MINIJUEGO NUEVO:
//   1. Crea una carpeta en js/minijuegos/ (por ejemplo "carrera/") con
//      un index.js parecido a plataforma/index.js.
//   2. Impórtalo aquí abajo y añádelo a la lista LISTA.
//  ¡Y ya está! Al final de cada ronda se elegirá uno al azar.
//
//  También se puede probar uno directamente añadiendo a la dirección:
//   ?minijuego=<id>   (por ejemplo ?minijuego=plataforma)
// =====================================================================

import plataforma from './plataforma/index.js';

const LISTA = [
  plataforma,
  // carrera,   <- así se añadirían los siguientes
];

/** Minijuegos por id: MINIJUEGOS.plataforma, ... */
export const MINIJUEGOS = Object.fromEntries(LISTA.map((m) => [m.id, m]));

/**
 * Elige un minijuego al azar. Si hay más de uno, intenta no repetir
 * el anterior.
 */
export function elegirMinijuegoAlAzar(idAnterior) {
  const opciones = LISTA.length > 1 ? LISTA.filter((m) => m.id !== idAnterior) : LISTA;
  return opciones[Math.floor(Math.random() * opciones.length)];
}
