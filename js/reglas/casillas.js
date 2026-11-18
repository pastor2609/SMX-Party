// =====================================================================
//  casillas.js — Qué pasa al caer en cada casilla
// ---------------------------------------------------------------------
//  Son funciones "puras": reciben el estado de la partida, lo modifican
//  y devuelven un texto que se muestra a todos.
//  (La tienda no está aquí porque necesita preguntar al jugador; eso lo
//  hace motor.js.)
// =====================================================================

import { CONFIG } from './config.js';
import { CASILLAS } from '../tablero/datos-tablero.js';

/** Número entero al azar entre min y max (ambos incluidos). */
export function azar(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Elemento al azar de una lista. */
export function elegirAlAzar(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

/** Suma (o resta) monedas sin bajar de 0. Devuelve cuánto cambió de verdad. */
export function cambiarMonedas(jugador, cantidad) {
  const antes = jugador.monedas;
  jugador.monedas = Math.max(0, jugador.monedas + cantidad);
  return jugador.monedas - antes;
}

/** Ids de los jugadores que siguen conectados. */
export function jugadoresActivos(estado) {
  return estado.orden.filter((id) => estado.jugadores[id].conectado);
}

// ---------------------------------------------------------------------
//  Casillas simples
// ---------------------------------------------------------------------

export function efectoAzul(estado, id) {
  const j = estado.jugadores[id];
  cambiarMonedas(j, CONFIG.MONEDAS_AZUL);
  return `🔵 ${j.nombre} gana ${CONFIG.MONEDAS_AZUL} monedas.`;
}

export function efectoRoja(estado, id) {
  const j = estado.jugadores[id];
  const perdidas = -cambiarMonedas(j, -CONFIG.MONEDAS_ROJA);
  return `🔴 ${j.nombre} pierde ${perdidas} monedas.`;
}

// ---------------------------------------------------------------------
//  Eventos (casilla verde "?"): se elige uno al azar
// ---------------------------------------------------------------------

const EVENTOS = [
  function cartera(estado, id) {
    const j = estado.jugadores[id];
    cambiarMonedas(j, 5);
    return `👛 ¡${j.nombre} encuentra una cartera en el patio! +5 monedas.`;
  },
  function cena(estado, id) {
    const j = estado.jugadores[id];
    const p = -cambiarMonedas(j, -4);
    return `🍕 ${j.nombre} paga las pizzas de la clase. −${p} monedas.`;
  },
  function solidario(estado) {
    for (const otro of jugadoresActivos(estado)) cambiarMonedas(estado.jugadores[otro], 2);
    return '🤝 Reparto solidario: ¡todos ganan 2 monedas!';
  },
  function lluvia(estado, id) {
    const j = estado.jugadores[id];
    const n = azar(1, 10);
    cambiarMonedas(j, n);
    return `🌧️ ¡Lluvia de monedas sobre ${j.nombre}! +${n} monedas.`;
  },
  function intercambio(estado, id) {
    const otros = jugadoresActivos(estado).filter((o) => o !== id);
    const j = estado.jugadores[id];
    if (otros.length === 0) return `🤷 ${j.nombre} no tiene con quién intercambiar.`;
    const o = estado.jugadores[elegirAlAzar(otros)];
    [j.monedas, o.monedas] = [o.monedas, j.monedas];
    return `🔄 ¡${j.nombre} y ${o.nombre} intercambian sus monedas!`;
  },
  function teletransporte(estado, id) {
    const j = estado.jugadores[id];
    const destinos = CASILLAS.filter((c) => c.id !== j.casilla).map((c) => c.id);
    j.casilla = elegirAlAzar(destinos);
    return `🌀 ¡${j.nombre} es teletransportado a otra parte del tablero!`;
  },
  function examen(estado, id) {
    const j = estado.jugadores[id];
    const p = -cambiarMonedas(j, -Math.floor(j.monedas / 2));
    return `📝 Examen sorpresa: ${j.nombre} pierde la mitad de sus monedas (−${p}).`;
  },
];

export function efectoEvento(estado, id) {
  return elegirAlAzar(EVENTOS)(estado, id);
}
