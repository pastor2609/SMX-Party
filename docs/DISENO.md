# SMX Party — Documento de diseño

Documento de referencia del juego. Si algo cambia en el diseño, se actualiza aquí.

## Concepto

- Party game estilo Mario Party.
- Estética 3D low-poly / cartoon.
- Vista desde arriba inclinada, con una cámara que sigue al jugador del turno.
- Se juega en el navegador, **solo ordenador** (teclado y ratón).

## Multijugador

- Online: un jugador crea una sala y hace de **host**; los demás se unen con un **código**.
- Sin servidor de pago (conexión peer-to-peer; el navegador del host es la "autoridad" de la partida).
- De **2 a 8 jugadores** (el máximo es configurable).
- Chat de texto en la sala.

## Tablero

- Tablero propio con casillas, caminos y **bifurcaciones**.
- **Monumentos de España** como decoración alrededor (no son casillas).

## Desarrollo de la partida

- Se elige el número de rondas.
- Cada ronda: todos tiran el dado por turnos y avanzan; al final de la ronda, un **minijuego**.

## Casillas

| Casilla  | Efecto |
|----------|--------|
| Azul     | +3 monedas |
| Roja     | −3 monedas |
| Evento   | Pasa algo al azar |
| Tienda   | Se pueden comprar objetos |
| Estrella | Comprar una estrella por 20 monedas; después la estrella cambia de sitio |

## Victoria

- Gana quien tenga **más estrellas**.
- Desempate por **monedas**.

## Para más adelante (NO entra en la fase 1)

- Minijuegos en tiempo real (todos en el mismo escenario).
- Minijuegos de puntuación simultánea.
- Personajes 3D en formato `.glb`.
- Un **boss final doble**.

---

## Fases

### Fase 1 — Base jugable online, sin arte (hecha)

1. Pantalla de inicio: nombre, "Crear sala" o "Unirse con código".
2. Sala de espera: lista de jugadores, código visible, chat, el host elige rondas (5, 10, 15, 20) y pulsa "Empezar".
3. Tablero 3D sencillo con Three.js: casillas como cilindros de colores, bifurcaciones, fichas simples de colores con su nombre encima.
4. Turnos: tirar dado (1-6), la ficha avanza casilla a casilla con animación, la cámara la sigue y se aplica el efecto.
5. Final de ronda: pantalla provisional "Aquí irá un minijuego" que reparte monedas al azar.
6. Marcador con estrellas y monedas. Pantalla de resultados al final.
7. Animaciones que se pueden saltar y tiempo límite en las bifurcaciones.

Decisiones tomadas en la fase 1:

- La estrella se compra **automáticamente** al pasar (o caer) por su casilla si tienes 20 monedas o más.
- La tienda vende un único objeto provisional: **Dado doble** (en tu siguiente turno tiras 2 dados).
- Si nadie tira el dado en 20 segundos, se tira solo (así un jugador ausente no bloquea la partida).
- Si quedan menos de 2 jugadores conectados, la partida termina y se muestran los resultados.

### Arquitectura técnica

- Sin compilación: HTML + CSS + módulos de JavaScript. Three.js y PeerJS desde CDN.
- Carpetas:
  - `js/red/` — toda la comunicación. Interfaz común en `red.js`; implementaciones `red-peerjs.js` (online) y `red-local.js` (pestañas del mismo navegador, para pruebas). Para pasar a Firebase basta con crear `red-firebase.js` con los mismos métodos.
  - `js/reglas/` — lógica de la partida (solo la ejecuta el host): sala de espera, turnos, casillas, eventos.
  - `js/tablero/` — datos del tablero y escena 3D.
  - `js/interfaz/` — pantallas HTML, marcador, chat, avisos.
