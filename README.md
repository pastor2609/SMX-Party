# SMX-Party

Party game estilo Mario Party con el lore de 1r SMX.

Se juega en el navegador del ordenador, online, de 2 a 8 jugadores. Uno crea la sala y los demás se unen con un código.
El diseño completo del juego está en [`docs/DISENO.md`](docs/DISENO.md).

**Estado actual: Fase 1** → base jugable online, sin arte (tablero 3D sencillo, turnos, casillas, estrella, minijuego provisional y resultados).

---

## 🌐 Cómo publicar el juego con GitHub Pages

GitHub Pages convierte este repositorio en una página web gratis. Solo hay que hacerlo **una vez**:

1. Entra en el repositorio en GitHub: `https://github.com/pastor2609/SMX-Party`
2. Arriba, pulsa **Settings** (Configuración).
3. En el menú de la izquierda, pulsa **Pages**.
4. En **Build and deployment** → **Source**, elige **Deploy from a branch**.
5. En **Branch**, elige **main** y la carpeta **/ (root)**. Pulsa **Save**.
6. Espera 1 o 2 minutos y recarga la página de Settings → Pages. Arriba aparecerá la dirección del juego, que será:

   **https://pastor2609.github.io/SMX-Party/**

Cada vez que unas cambios a `main`, la web se actualiza sola en un par de minutos.

> ⚠️ Los cambios tienen que estar en la rama `main` para que se vean en la web. Si están en otra rama, primero crea la Pull Request y únela (merge).

---

## 🧪 Cómo probar el juego tú solo (con dos pestañas)

1. Abre la dirección del juego (`https://pastor2609.github.io/SMX-Party/`) en **Chrome, Edge o Firefox**.
2. **Pestaña 1**: escribe un nombre (por ejemplo "Ana") y pulsa **Crear sala**. Verás un código de 5 letras (por ejemplo `K7QM2`).
3. Abre una **segunda pestaña** con la misma dirección.
4. **Pestaña 2**: escribe otro nombre ("Bruno"), escribe el código en "Código de la sala" y pulsa **Unirse**.
5. Vuelve a la pestaña 1: verás a los dos jugadores. Elige el número de rondas (5 es lo más rápido para probar) y pulsa **Empezar**.
6. Ve cambiando de pestaña para jugar con cada jugador.

**Controles**

| Tecla / ratón | Qué hace |
|---|---|
| `Espacio` (o el botón) | Tirar el dado cuando es tu turno · Saltar la animación |
| `1`, `2`… (o los botones) | Elegir camino en una bifurcación / responder en la tienda |
| `Enter` | Escribir en el chat |

**Cosas que conviene saber al probar**

- Necesitas **conexión a internet**: el juego descarga Three.js y PeerJS, y usa un servidor gratuito de PeerJS para que los navegadores se encuentren.
- Si la otra pestaña está en segundo plano mucho rato, el navegador la "duerme" un poco. Es normal que vaya algo más lenta.
- Si no tiras el dado en 20 segundos, se tira solo. En las bifurcaciones tienes 10 segundos para elegir.
- Para probar una desconexión: cierra la pestaña de un jugador (la partida sigue sin él). Si cierras la pestaña del host, a los demás les sale un aviso.

### Plan B: probar sin internet en el multijugador

Si PeerJS no funciona (por ejemplo, en una red de instituto que lo bloquea), añade `?red=local` al final de la dirección **en las dos pestañas**:

```
https://pastor2609.github.io/SMX-Party/?red=local
```

En este modo las pestañas se hablan directamente dentro del mismo navegador. Solo sirve para probar en un mismo ordenador, no para jugar con amigos.

### Probar en tu ordenador sin GitHub Pages

Los módulos de JavaScript no funcionan abriendo `index.html` con doble clic (el navegador lo bloquea por seguridad). Si quieres probar en local, necesitas un pequeño servidor. Si tienes Python instalado, abre una terminal en la carpeta del proyecto y ejecuta:

```bash
python -m http.server 8000
```

Y abre `http://localhost:8000` en el navegador.

---

## 📁 Cómo está organizado el código

```
index.html              → la página (todas las pantallas)
css/estilos.css         → colores y aspecto
js/main.js              → une todas las piezas
js/red/                 → TODO lo de internet (se puede cambiar a Firebase)
   red.js               → la "interfaz": lo único que usa el resto del juego
   red-base.js          → lógica común (latidos para detectar desconexiones)
   red-peerjs.js        → red online con PeerJS
   red-local.js         → red de pruebas entre pestañas (?red=local)
js/reglas/              → reglas del juego (solo las ejecuta el host)
   config.js            → números del juego (monedas, precios, tiempos)
   anfitrion.js         → sala de espera y mensajes del host
   motor.js             → turnos, dado, movimiento, minijuego, final
   casillas.js          → efectos de casillas y eventos al azar
js/tablero/             → el tablero
   datos-tablero.js     → casillas, caminos y bifurcaciones
   escena.js            → dibujo 3D con Three.js y cámara
   monumentos.js        → monumentos de España (decoración)
js/interfaz/            → pantallas HTML
   pantallas.js, sala.js, hud.js, chat.js
docs/DISENO.md          → documento de diseño
```

¿Quieres cambiar cuántas monedas da una casilla o cuánto cuesta la estrella? Está todo en `js/reglas/config.js`.
