// =====================================================================
//  plataforma/index.js — Ficha del minijuego "Fuera de la plataforma"
// ---------------------------------------------------------------------
//  Cada minijuego tiene un archivo así con:
//   - sus datos (id, nombre, tipo, objetivo, controles),
//   - cómo crear su simulación (la física que corre en el host),
//   - cómo cargar su vista (el dibujo 3D, solo cuando hace falta).
// =====================================================================

import { SimulacionPlataforma, AJUSTES } from './simulacion.js';

export default {
  id: 'plataforma',
  nombre: 'Fuera de la plataforma',
  tipo: 'tiempoReal',          // 'tiempoReal' | 'puntuacion'
  objetivo: '¡Empuja a los demás al agua y sé el último en pie! La plataforma encoge cada 10 segundos: cuando el borde parpadea en rojo, apártate.',
  controles: [
    ['WASD / Flechas', 'Moverse'],
    ['Espacio', 'Empujón (se recarga en 1,5 s)'],
  ],
  duracionMaxima: AJUSTES.DURACION,

  /** (Host) Crea la física para estos jugadores [{ id, nombre, color }]. */
  crearSimulacion(jugadores) {
    return new SimulacionPlataforma(jugadores);
  },

  /** (Todos) Carga el dibujo 3D. Se importa solo cuando hace falta. */
  cargarVista() {
    return import('./vista.js');
  },
};
