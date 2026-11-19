// =====================================================================
//  tiempo-real/host.js — Motor de minijuegos en TIEMPO REAL (host)
// ---------------------------------------------------------------------
//  Sirve para TODOS los minijuegos de tiempo real. Solo se ejecuta en
//  el navegador del host, que es la autoridad:
//
//   1. Guarda los últimos controles (teclas) que manda cada jugador.
//   2. 60 veces por segundo avanza la física de la "simulación" del
//      minijuego concreto.
//   3. 20 veces por segundo envía a todos una "instantánea" (foto) del
//      estado: posiciones, quién está eliminado, tiempo...
//   4. Cuando la simulación dice que ha terminado, devuelve los puestos.
//
//  Cada minijuego aporta su propia SIMULACIÓN, que debe tener:
//    paso(dt, entradas)        -> avanza la física "dt" segundos.
//                                 entradas = { idJugador: controles }
//    instantanea()             -> objeto con el estado para enviar.
//                                 Debe incluir "t" (segundos de juego)
//                                 y "hud": { tiempo, texto }.
//    eliminarJugador(id)       -> el jugador se ha desconectado.
//    terminado                 -> true cuando acaba.
//    clasificacion()           -> [{ id, puesto }]
// =====================================================================

import { crearMetronomo } from './reloj.js';
import { CONFIG } from '../../reglas/config.js';

const PASO_FISICA = 1 / 60;      // segundos por paso de física
const MAX_PASOS_SEGUIDOS = 15;   // por si el navegador se atasca un rato

export class SesionTiempoRealHost {
  /**
   * @param {object} opciones
   *   simulacion  -> la simulación del minijuego
   *   enviar      -> fn(instantanea): la manda a todos los jugadores
   */
  constructor({ simulacion, enviar }) {
    this.simulacion = simulacion;
    this.enviar = enviar;
    this.entradas = {};          // idJugador -> últimos controles recibidos
    this._parar = null;
  }

  /** Llegan los controles de un jugador. */
  recibirEntrada(idJugador, entrada) {
    this.entradas[idJugador] = entrada;
  }

  jugadorDesconectado(idJugador) {
    delete this.entradas[idJugador];
    this.simulacion.eliminarJugador(idJugador);
  }

  /** Arranca el minijuego. Devuelve una promesa con los puestos. */
  ejecutar() {
    return new Promise((resolver) => {
      let anterior = performance.now();
      let acumulado = 0;
      let ultimoEnvio = 0;
      const msEntreEnvios = 1000 / CONFIG.TIEMPO_REAL_HZ;

      const tic = () => {
        const ahora = performance.now();
        acumulado += (ahora - anterior) / 1000;
        anterior = ahora;

        // Avanzamos la física en pasos fijos (así es igual en todos los PCs)
        let pasos = 0;
        while (acumulado >= PASO_FISICA && pasos < MAX_PASOS_SEGUIDOS) {
          this.simulacion.paso(PASO_FISICA, this.entradas);
          acumulado -= PASO_FISICA;
          pasos++;
        }
        if (pasos === MAX_PASOS_SEGUIDOS) acumulado = 0;

        const fin = this.simulacion.terminado;
        if (fin || ahora - ultimoEnvio >= msEntreEnvios) {
          // Llevamos la cuenta exacta para que salgan 20 por segundo de media
          ultimoEnvio = Math.max(ultimoEnvio + msEntreEnvios, ahora - msEntreEnvios);
          this.enviar(this.simulacion.instantanea());
        }
        if (fin) {
          this.detener();
          resolver(this.simulacion.clasificacion());
        }
      };

      this._resolver = resolver;
      this._parar = crearMetronomo(Math.round(PASO_FISICA * 1000), tic);
      this.enviar(this.simulacion.instantanea());
    });
  }

  /** Para el bucle (al terminar o si se cancela la partida). */
  detener() {
    if (this._parar) this._parar();
    this._parar = null;
  }

  /** Cancela el minijuego sin resultados. */
  cancelar() {
    this.detener();
    if (this._resolver) this._resolver([]);
  }
}
