// =====================================================================
//  sala.js — Pantalla de la sala de espera
// =====================================================================

import { $, filaJugador, ponerEtiqueta } from './pantallas.js';
import { CONFIG } from '../reglas/config.js';

export class PantallaSala {
  /**
   * @param {object} acciones
   *   alCambiarConfig(rondas, maxJugadores)
   *   alEmpezar()
   *   alSalir()
   */
  constructor(acciones) {
    // Rellenar los desplegables
    for (const r of CONFIG.OPCIONES_RONDAS) $('sel-rondas').add(new Option(`${r} rondas`, r));
    for (let n = CONFIG.MIN_JUGADORES; n <= CONFIG.MAX_JUGADORES; n++) $('sel-max').add(new Option(n, n));

    const cambiar = () => acciones.alCambiarConfig(Number($('sel-rondas').value), Number($('sel-max').value));
    $('sel-rondas').addEventListener('change', cambiar);
    $('sel-max').addEventListener('change', cambiar);
    $('btn-empezar').addEventListener('click', () => acciones.alEmpezar());
    $('btn-salir-sala').addEventListener('click', () => acciones.alSalir());

    $('btn-copiar').addEventListener('click', async () => {
      const codigo = $('sala-codigo').textContent;
      try {
        await navigator.clipboard.writeText(codigo);
        $('btn-copiar').textContent = '✅ Copiado';
      } catch {
        $('btn-copiar').textContent = '❌ Cópialo a mano';
      }
      setTimeout(() => { $('btn-copiar').textContent = '📋 Copiar'; }, 1500);
    });
  }

  /** Dibuja la sala con los datos que manda el host. */
  mostrar(sala, miId) {
    const soyHost = sala.idHost === miId;
    $('sala-codigo').textContent = sala.codigo;
    $('sala-contador').textContent = `(${sala.jugadores.length}/${sala.maxJugadores})`;

    const lista = $('sala-jugadores');
    lista.textContent = '';
    for (const j of sala.jugadores) {
      const li = filaJugador(j.color, j.nombre);
      if (j.id === sala.idHost) ponerEtiqueta(li, 'HOST');
      if (j.id === miId) ponerEtiqueta(li, 'TÚ', 'etiqueta-tu');
      lista.appendChild(li);
    }

    $('sel-rondas').value = sala.rondas;
    $('sel-max').value = sala.maxJugadores;
    $('sel-rondas').disabled = !soyHost;
    $('sel-max').disabled = !soyHost;

    const suficientes = sala.jugadores.length >= CONFIG.MIN_JUGADORES;
    $('btn-empezar').classList.toggle('oculto', !soyHost);
    $('btn-empezar').disabled = !suficientes;
    $('btn-empezar').title = suficientes ? '' : `Hacen falta al menos ${CONFIG.MIN_JUGADORES} jugadores`;
    $('sala-espera-host').textContent = soyHost
      ? (suficientes ? 'Cuando estéis todos, pulsa "Empezar".' : 'Esperando a más jugadores…')
      : 'Esperando a que el host empiece la partida…';
  }
}
