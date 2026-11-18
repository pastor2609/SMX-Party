// =====================================================================
//  config.js — Números del juego en un solo sitio
// ---------------------------------------------------------------------
//  Si quieres cambiar cuántas monedas da una casilla, cuánto cuesta la
//  estrella o los tiempos límite, cámbialo aquí.
// =====================================================================

export const CONFIG = {
  // Jugadores
  MIN_JUGADORES: 2,
  MAX_JUGADORES: 8,            // máximo absoluto (el host puede elegir menos)
  MAX_LARGO_NOMBRE: 16,

  // Rondas que puede elegir el host
  OPCIONES_RONDAS: [5, 10, 15, 20],

  // Economía
  MONEDAS_INICIALES: 10,
  MONEDAS_AZUL: 3,
  MONEDAS_ROJA: 3,
  PRECIO_ESTRELLA: 20,
  PRECIO_DADO_DOBLE: 8,
  MINIJUEGO_PREMIO_MIN: 1,     // monedas al azar del minijuego provisional
  MINIJUEGO_PREMIO_MAX: 10,

  // Tiempos (milisegundos)
  TIEMPO_TIRAR_DADO: 20000,    // si no tira en este tiempo, se tira solo
  TIEMPO_BIFURCACION: 10000,   // tiempo para elegir camino
  TIEMPO_TIENDA: 10000,        // tiempo para decidir en la tienda
  TIEMPO_MINIJUEGO: 10000,     // la pantalla provisional se cierra sola
  DURACION_DADO: 1200,         // animación del dado
  DURACION_PASO: 420,          // tiempo entre casilla y casilla
  DURACION_EFECTO: 1400,       // pausa para leer el efecto de la casilla
  DURACION_ESTRELLA: 1800,     // pausa al comprar la estrella

  // Chat
  MAX_LARGO_CHAT: 200,
};

/** Colores de las fichas (uno por jugador, en orden de llegada). */
export const COLORES_JUGADOR = [
  '#ff4d4d', // rojo
  '#4d9dff', // azul
  '#4ddb6a', // verde
  '#ffd23f', // amarillo
  '#c86bff', // morado
  '#ff9f43', // naranja
  '#3fe0d0', // turquesa
  '#ff7ac6', // rosa
];
