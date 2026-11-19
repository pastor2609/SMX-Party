// =====================================================================
//  puntuacion/host.js — Minijuegos de PUNTUACIÓN (host)
// ---------------------------------------------------------------------
//  PREPARADO PARA EL FUTURO (aún no hay ningún minijuego de este tipo).
//
//  En estos minijuegos cada jugador juega en su propia pantalla (no hay
//  física compartida). Al acabar, su navegador envía su puntuación al
//  host con la acción 'puntuacion' { puntos }. El host espera a que
//  todos la manden (o a que se acabe el tiempo) y los ordena.
//
//  Lo que debe aportar un minijuego de puntuación en su definición:
//    tipo: 'puntuacion'
//    duracionMaxima: segundos como máximo (después se cierra solo)
//    cargarVista()  -> su vista, con un método
//        jugar({ alTerminar(puntos) })   que arranca la partida local
// =====================================================================

/** Convierte una lista ordenada en puestos (los empates comparten puesto). */
export function calcularPuestos(lista, valor) {
  // lista ya ordenada de mejor a peor; valor(x) = número para comparar
  return lista.map((x) => ({
    id: x.id,
    puesto: 1 + lista.filter((o) => valor(o) > valor(x)).length,
  }));
}

export class SesionPuntuacionHost {
  /**
   * @param {object} opciones
   *   participantes    -> [ids]
   *   duracionMaxima   -> segundos
   */
  constructor({ participantes, duracionMaxima }) {
    this.pendientes = new Set(participantes);
    this.puntos = {};           // id -> puntos
    this.duracionMs = (duracionMaxima + 5) * 1000; // margen por la red
  }

  recibirPuntuacion(id, puntos) {
    if (!this.pendientes.has(id)) return;
    this.puntos[id] = Math.max(0, Number(puntos) || 0);
    this.pendientes.delete(id);
    this._comprobar();
  }

  jugadorDesconectado(id) {
    this.pendientes.delete(id);
    delete this.puntos[id];
    this._comprobar();
  }

  _comprobar() {
    if (this.pendientes.size === 0 && this._resolver) this._terminar();
  }

  _terminar() {
    clearTimeout(this._temporizador);
    const lista = Object.entries(this.puntos)
      .map(([id, puntos]) => ({ id, puntos }))
      .sort((a, b) => b.puntos - a.puntos);
    const resolver = this._resolver;
    this._resolver = null;
    resolver(calcularPuestos(lista, (x) => x.puntos));
  }

  ejecutar() {
    return new Promise((resolver) => {
      this._resolver = resolver;
      // Quien no haya enviado su puntuación a tiempo, cuenta con 0
      this._temporizador = setTimeout(() => {
        for (const id of this.pendientes) this.puntos[id] = 0;
        this.pendientes.clear();
        this._terminar();
      }, this.duracionMs);
      this._comprobar();
    });
  }

  cancelar() {
    clearTimeout(this._temporizador);
    if (this._resolver) { this._resolver([]); this._resolver = null; }
  }
}
