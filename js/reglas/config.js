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

  // Minijuegos: monedas según el puesto (1.º, 2.º, 3.º...)
  MONEDAS_POR_PUESTO: [10, 6, 3],
  MONEDAS_RESTO_PUESTOS: 1,    // del 4.º puesto en adelante

  // Tiempos (milisegundos)
  TIEMPO_TIRAR_DADO: 20000,    // si no tira en este tiempo, se tira solo
  TIEMPO_BIFURCACION: 10000,   // tiempo para elegir camino
  TIEMPO_TIENDA: 10000,        // tiempo para decidir en la tienda
  MINIJUEGO_INSTRUCCIONES: 5000, // pantalla de instrucciones
  MINIJUEGO_CUENTA_ATRAS: 3000,  // 3, 2, 1...
  MINIJUEGO_RESULTADOS: 10000,   // la pantalla de resultados se cierra sola
  TIEMPO_REAL_HZ: 20,            // veces por segundo que el host envía el estado
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
