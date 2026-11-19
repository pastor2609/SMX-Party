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

## Minijuegos

Al final de cada ronda se juega un minijuego elegido al azar. Hay dos tipos:

- **Tiempo real**: todos en el mismo escenario a la vez (el host calcula la física).
- **Puntuación**: cada uno juega en su pantalla y al final se comparan los puntos.

Flujo de cada minijuego: **instrucciones** (5 s) → **3, 2, 1** → **partida** → **resultados** (puestos y monedas) → vuelta al tablero.

Monedas por puesto (configurable): **1.º 10 · 2.º 6 · 3.º 3 · resto 1**. Si varios comparten puesto, todos se llevan las monedas de ese puesto (y el siguiente puesto se salta: 1.º, 1.º, 3.º...).

### Lista de minijuegos

| Id | Nombre | Tipo | Resumen |
|----|--------|------|---------|
| `plataforma` | Fuera de la plataforma | Tiempo real | Empujar a los demás al agua. La plataforma encoge cada 10 s. Gana el último en pie (máx. 60 s). |

## Para más adelante

- Más minijuegos (de tiempo real y de puntuación).
- Personajes 3D en formato `.glb`.
- Un **boss final doble**.

---

## Fases

### Fase 1 — Base jugable online, sin arte (hecha)

1. Pantalla de inicio: nombre, "Crear sala" o "Unirse con código".
2. Sala de espera: lista de jugadores, código visible, chat, el host elige rondas (5, 10, 15, 20) y pulsa "Empezar".
3. Tablero 3D sencillo con Three.js: casillas como cilindros de colores, bifurcaciones, fichas simples de colores con su nombre encima.
4. Turnos: tirar dado (1-6), la ficha avanza casilla a casilla con animación, la cámara la sigue y se aplica el efecto.
5. Final de ronda: pantalla provisional "Aquí irá un minijuego" que reparte monedas al azar. *(Sustituida en la fase 2 por el sistema de minijuegos.)*
6. Marcador con estrellas y monedas. Pantalla de resultados al final.
7. Animaciones que se pueden saltar y tiempo límite en las bifurcaciones.

Decisiones tomadas en la fase 1:

- La estrella se compra **automáticamente** al pasar (o caer) por su casilla si tienes 20 monedas o más.
- La tienda vende un único objeto provisional: **Dado doble** (en tu siguiente turno tiras 2 dados).
- Si nadie tira el dado en 20 segundos, se tira solo (así un jugador ausente no bloquea la partida).
- Si quedan menos de 2 jugadores conectados, la partida termina y se muestran los resultados.

### Fase 2, parte 1 — Sistema de minijuegos + "Fuera de la plataforma" (hecha)

1. Sistema de minijuegos reutilizable (registro, etapas, monedas por puesto, tipos "tiempo real" y "puntuación").
2. Minijuego 1 "Fuera de la plataforma" (tiempo real).
3. Red en tiempo real: el host es la autoridad; los demás envían sus teclas y reciben ~20 "fotos" por segundo que se suavizan (interpolación).
4. Modo prueba: `?minijuego=plataforma` en la dirección del host para jugar solo ese minijuego (vale con 1 jugador).

Detalles de "Fuera de la plataforma":

- Plataforma redonda en el mar, cámara fija desde arriba e inclinada. Jugadores repartidos en círculo.
- WASD / flechas para moverse; Espacio = empujón (embestida corta hacia donde miras, recarga de 1,5 s con barra visible).
- Choques entre jugadores; el empujón lanza al rival hacia atrás y lo deja unos instantes casi sin control.
- Encoge cada 10 s (radios 9 → 7,4 → 5,9 → 4,6 → 3,4 → 2,4). El borde que va a desaparecer parpadea en rojo 2 s antes.
- Quien cae al agua (con chapuzón) queda eliminado y mira como espectador.
- Termina cuando queda 1 jugador o a los 60 s. Los que siguen en pie comparten el 1.er puesto; los demás, por orden de caída (quien cae más tarde, mejor puesto).
- Si alguien se desconecta en mitad del minijuego, cuenta como eliminado y no recibe monedas.

Decisiones tomadas en la fase 2:

- El tipo "puntuación" está preparado (host y cliente) pero aún no hay ningún minijuego de ese tipo, así que no se ha probado con uno real.
- La física del host avanza con un "metrónomo" en un Web Worker para que no se ralentice si la pestaña del host está en segundo plano.
- Los demás ven el juego unos 110 ms "en diferido" a cambio de que el movimiento sea suave.
- Los ajustes de cada minijuego (velocidad, fuerza del empujón, tiempos...) están en su propio archivo (`AJUSTES` en `js/minijuegos/plataforma/simulacion.js`).

### Arquitectura técnica

- Sin compilación: HTML + CSS + módulos de JavaScript. Three.js y PeerJS desde CDN.
- Carpetas:
  - `js/red/` — toda la comunicación. Interfaz común en `red.js`; implementaciones `red-peerjs.js` (online) y `red-local.js` (pestañas del mismo navegador, para pruebas). Para pasar a Firebase basta con crear `red-firebase.js` con los mismos métodos.
  - `js/reglas/` — lógica de la partida (solo la ejecuta el host): sala de espera, turnos, casillas, eventos.
  - `js/tablero/` — datos del tablero y escena 3D.
  - `js/interfaz/` — pantallas HTML, marcador, chat, avisos.
  - `js/minijuegos/` — sistema de minijuegos:
    - `registro.js` — lista de minijuegos (para añadir uno nuevo: crear su carpeta y registrarlo aquí).
    - `controlador.js` — pantallas de cada etapa (instrucciones, 3-2-1, partida, resultados) en cada navegador.
    - `tiempo-real/` — base reutilizable: `host.js` (bucle de física + envío de fotos), `cliente.js` (teclado + interpolación), `reloj.js` (metrónomo).
    - `puntuacion/` — base para minijuegos de puntuación (host).
    - `comun/` — piezas compartidas (figura del jugador).
    - `plataforma/` — "Fuera de la plataforma": `index.js` (ficha), `simulacion.js` (física, solo host), `vista.js` (3D).

### Cómo se hace un minijuego nuevo

Cada minijuego es una carpeta en `js/minijuegos/` con un `index.js` que exporta:

```js
export default {
  id: 'carrera',                 // se usa en ?minijuego=carrera
  nombre: 'La gran carrera',
  tipo: 'tiempoReal',            // o 'puntuacion'
  objetivo: 'Texto de las instrucciones',
  controles: [['WASD', 'Moverse']],
  duracionMaxima: 60,            // segundos
  crearSimulacion(jugadores) {}, // solo tiempo real: física (ver tiempo-real/host.js)
  cargarVista() { return import('./vista.js'); },
};
```

- **Tiempo real**: la *simulación* tiene `paso(dt, entradas)`, `instantanea()`, `eliminarJugador(id)`, `terminado` y `clasificacion()`. La *vista* tiene `dibujar(instantanea, dt)` y `destruir()`.
- **Puntuación**: la *vista* tiene además `jugar({ alTerminar(puntos) })`.

Después se añade a la lista de `js/minijuegos/registro.js`.
