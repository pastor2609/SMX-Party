// =====================================================================
//  chat.js — Chat de texto de la sala
// ---------------------------------------------------------------------
//  Hay un único chat que se "mueve" entre la sala de espera y la
//  pantalla de partida, así no se pierden los mensajes.
//  Los textos se ponen con textContent (nunca como HTML) para que nadie
//  pueda colar código en el chat.
// =====================================================================

import { $ } from './pantallas.js';

export class Chat {
  /** @param {function(string)} alEnviar  se llama con el texto escrito */
  constructor(alEnviar) {
    this.caja = $('chat');
    this.mensajes = $('chat-mensajes');
    this.input = $('chat-input');

    $('chat-form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const texto = this.input.value.trim();
      if (texto) alEnviar(texto);
      this.input.value = '';
      // En la partida, quitamos el foco para que funcionen las teclas del juego
      if (this.caja.parentElement.id === 'hueco-chat-juego') this.input.blur();
    });
  }

  /** Mueve el chat a otro sitio de la página. */
  moverA(idContenedor) {
    $(idContenedor).appendChild(this.caja);
  }

  /** Añade un mensaje: { nombre, color, texto, sistema }. */
  agregar(msg) {
    const p = document.createElement('p');
    if (msg.sistema) {
      p.className = 'sistema';
      p.textContent = msg.texto;
    } else {
      const autor = document.createElement('strong');
      autor.textContent = msg.nombre + ': ';
      autor.style.color = msg.color;
      autor.style.textShadow = '0 0 1px rgba(0,0,0,0.6)';
      p.append(autor, document.createTextNode(msg.texto));
    }
    this.mensajes.appendChild(p);
    // Guardamos como mucho 100 mensajes
    while (this.mensajes.children.length > 100) this.mensajes.firstChild.remove();
    this.mensajes.scrollTop = this.mensajes.scrollHeight;
  }

  vaciar() { this.mensajes.textContent = ''; }
}
