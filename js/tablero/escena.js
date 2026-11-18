// =====================================================================
//  escena.js — Dibuja el tablero en 3D con Three.js
// ---------------------------------------------------------------------
//  Esta clase NO decide nada del juego: solo recibe el estado que manda
//  el host y lo dibuja (fichas, estrella, cámara...). Las animaciones
//  (saltitos de casilla en casilla) se hacen aquí.
// =====================================================================

import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CASILLAS, MONUMENTOS } from './datos-tablero.js';
import { crearMonumento, crearArbol } from './monumentos.js';

const COLOR_CASILLA = {
  inicio: '#f2f2f2',
  azul: '#2f7bff',
  roja: '#e53935',
  evento: '#2ecc71',
  tienda: '#f39c12',
};
const ICONO_CASILLA = { inicio: 'SALIDA', evento: '?', tienda: '🛒' };

const ALTO_CASILLA = 0.4;           // grosor de los cilindros
const DURACION_SALTO = 0.32;        // segundos de cada saltito
const ALTURA_SALTO = 1.1;
// Dónde se pone la cámara respecto a la ficha que sigue
const OFFSET_CAMARA = new THREE.Vector3(0, 19, 12);
const OFFSET_CAMARA_GENERAL = new THREE.Vector3(0, 32, 30);

/** Posición 3D (encima) de una casilla. */
function posicionCasilla(id) {
  const c = CASILLAS[id];
  return new THREE.Vector3(c.x, ALTO_CASILLA, c.z);
}

function etiquetaHTML(clase, texto, color) {
  const div = document.createElement('div');
  div.className = clase;
  div.textContent = texto;
  if (color) div.style.background = color;
  return new CSS2DObject(div);
}

export class Escena {
  constructor(contenedor) {
    this.contenedor = contenedor;
    this.fichas = new Map();     // id jugador -> datos de la ficha
    this.marcadores = [];        // flechas de bifurcación
    this.idSeguido = null;       // jugador al que sigue la cámara
    this.reloj = new THREE.Clock();
    this.aspas = [];             // aspas de molinos (giran)

    // --- Motor de dibujo ---
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    contenedor.appendChild(this.renderer.domElement);

    // Capa HTML para los nombres encima de las fichas
    this.rendererEtiquetas = new CSS2DRenderer();
    Object.assign(this.rendererEtiquetas.domElement.style, {
      position: 'absolute', top: '0', left: '0', pointerEvents: 'none',
    });
    contenedor.appendChild(this.rendererEtiquetas.domElement);

    // --- Escena, cámara y luces ---
    this.escena = new THREE.Scene();
    this.escena.background = new THREE.Color('#8fd3ff');
    this.escena.fog = new THREE.Fog('#8fd3ff', 60, 120);

    this.camara = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
    this.objetivoCamara = new THREE.Vector3(0, 0, 0);
    this.camara.position.copy(OFFSET_CAMARA_GENERAL);
    this.camara.lookAt(this.objetivoCamara);

    this.escena.add(new THREE.HemisphereLight('#ffffff', '#5a7d4a', 0.9));
    const sol = new THREE.DirectionalLight('#ffffff', 1.6);
    sol.position.set(15, 30, 12);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, far: 100 });
    this.escena.add(sol);

    this._crearSuelo();
    this._crearCaminos();
    this._crearCasillas();
    this._crearEstrella();
    this._crearDecoracion();

    window.addEventListener('resize', () => this.redimensionar());
    this.redimensionar();
    this.renderer.setAnimationLoop(() => this._fotograma());
  }

  // ===================================================================
  //  Construcción del tablero (solo una vez)
  // ===================================================================

  _crearSuelo() {
    // Isla de hierba
    const isla = new THREE.Mesh(
      new THREE.CylinderGeometry(33, 35, 2, 40),
      new THREE.MeshStandardMaterial({ color: '#7ccf6a', flatShading: true }),
    );
    isla.scale.x = 1.15;
    isla.position.y = -1;
    isla.receiveShadow = true;
    this.escena.add(isla);

    // Mar
    const mar = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: '#3a8ee6' }),
    );
    mar.rotation.x = -Math.PI / 2;
    mar.position.y = -1.4;
    this.escena.add(mar);
  }

  _crearCaminos() {
    const material = new THREE.MeshStandardMaterial({ color: '#f3e2b3', flatShading: true });
    for (const c of CASILLAS) {
      for (const s of c.siguientes) {
        const d = CASILLAS[s];
        const dx = d.x - c.x;
        const dz = d.z - c.z;
        const largo = Math.hypot(dx, dz);
        const tramo = new THREE.Mesh(new THREE.BoxGeometry(largo, 0.12, 0.7), material);
        tramo.position.set((c.x + d.x) / 2, 0.06, (c.z + d.z) / 2);
        tramo.rotation.y = -Math.atan2(dz, dx);
        tramo.receiveShadow = true;
        this.escena.add(tramo);
      }
    }
  }

  _crearCasillas() {
    const geometria = new THREE.CylinderGeometry(1.1, 1.2, ALTO_CASILLA, 20);
    for (const c of CASILLAS) {
      const malla = new THREE.Mesh(
        geometria,
        new THREE.MeshStandardMaterial({ color: COLOR_CASILLA[c.tipo], roughness: 0.6 }),
      );
      malla.position.set(c.x, ALTO_CASILLA / 2, c.z);
      malla.castShadow = true;
      malla.receiveShadow = true;
      this.escena.add(malla);

      if (ICONO_CASILLA[c.tipo]) {
        const icono = etiquetaHTML('icono-casilla', ICONO_CASILLA[c.tipo]);
        icono.position.set(c.x, ALTO_CASILLA + 0.05, c.z);
        this.escena.add(icono);
      }
    }
  }

  _crearEstrella() {
    // Forma de estrella de 5 puntas, con volumen
    const forma = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const radio = i % 2 === 0 ? 0.9 : 0.4;
      const angulo = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const x = Math.cos(angulo) * radio;
      const y = Math.sin(angulo) * radio;
      if (i === 0) forma.moveTo(x, y); else forma.lineTo(x, y);
    }
    const geometria = new THREE.ExtrudeGeometry(forma, { depth: 0.25, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06 });
    geometria.center();
    this.estrella = new THREE.Group();
    const malla = new THREE.Mesh(geometria, new THREE.MeshStandardMaterial({
      color: '#ffd23f', emissive: '#b88a00', emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.3,
    }));
    malla.castShadow = true;
    this.estrella.add(malla);

    // Aro dorado en el suelo para que se vea bien la casilla
    const aro = new THREE.Mesh(
      new THREE.TorusGeometry(1.25, 0.12, 8, 32),
      new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#b88a00', emissiveIntensity: 0.6 }),
    );
    aro.rotation.x = Math.PI / 2;
    aro.position.y = -1.4;
    this.estrella.add(aro);
    this.estrella.visible = false;
    this.escena.add(this.estrella);
  }

  _crearDecoracion() {
    for (const m of MONUMENTOS) {
      const { grupo, altura } = crearMonumento(m.tipo);
      grupo.position.set(m.x, 0, m.z);
      this.escena.add(grupo);
      grupo.traverse((o) => { if (o.userData.gira) this.aspas.push(o); });
      const nombre = etiquetaHTML('nombre-monumento', m.nombre);
      nombre.position.set(m.x, altura + 0.8, m.z);
      this.escena.add(nombre);
    }

    // Árboles en sitios "al azar" pero siempre los mismos (semilla fija)
    let semilla = 7;
    const aleatorio = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
    const libres = (x, z) =>
      CASILLAS.every((c) => Math.hypot(c.x - x, c.z - z) > 2.6) &&
      MONUMENTOS.every((m) => Math.hypot(m.x - x, m.z - z) > (m.tipo === 'acueducto' ? 9 : 5));
    let puestos = 0;
    for (let intento = 0; intento < 400 && puestos < 45; intento++) {
      const x = (aleatorio() * 2 - 1) * 34;
      const z = (aleatorio() * 2 - 1) * 28;
      if ((x / 36) ** 2 + (z / 31) ** 2 > 1 || !libres(x, z)) continue;
      const arbol = crearArbol(0.8 + aleatorio() * 0.6);
      arbol.position.set(x, 0, z);
      this.escena.add(arbol);
      puestos++;
    }
  }

  // ===================================================================
  //  Fichas de los jugadores
  // ===================================================================

  _crearFicha(jugador) {
    const grupo = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: jugador.color, roughness: 0.5, transparent: true });
    const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 0.85, 14), mat);
    cuerpo.position.y = 0.43;
    const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), mat);
    cabeza.position.y = 1.1;
    cuerpo.castShadow = cabeza.castShadow = true;
    grupo.add(cuerpo, cabeza);

    const nombre = etiquetaHTML('nombre-ficha', jugador.nombre, jugador.color);
    nombre.position.y = 1.9;
    grupo.add(nombre);

    const pos = posicionCasilla(jugador.casilla);
    grupo.position.copy(pos);
    this.escena.add(grupo);

    const ficha = {
      grupo, material: mat,
      casilla: jugador.casilla,
      desde: pos.clone(), hacia: pos.clone(),
      t: 1, duracion: DURACION_SALTO, salta: false,
    };
    this.fichas.set(jugador.id, ficha);
    return ficha;
  }

  /** Quita todas las fichas (al empezar una partida nueva). */
  limpiarFichas() {
    for (const ficha of this.fichas.values()) {
      ficha.grupo.traverse((o) => { if (o.isCSS2DObject) o.element.remove(); });
      this.escena.remove(ficha.grupo);
    }
    this.fichas.clear();
    this._quitarMarcadores();
  }

  /** Calcula dónde va cada ficha (si hay varias en la misma casilla, en corro). */
  _posicionesDestino(estado) {
    const porCasilla = new Map();
    for (const id of estado.orden) {
      const c = estado.jugadores[id].casilla;
      if (!porCasilla.has(c)) porCasilla.set(c, []);
      porCasilla.get(c).push(id);
    }
    const destinos = new Map();
    for (const [casilla, ids] of porCasilla) {
      ids.forEach((id, i) => {
        const p = posicionCasilla(casilla);
        if (ids.length > 1) {
          const angulo = (i / ids.length) * Math.PI * 2;
          p.x += Math.cos(angulo) * 0.6;
          p.z += Math.sin(angulo) * 0.6;
        }
        destinos.set(id, p);
      });
    }
    return destinos;
  }

  // ===================================================================
  //  Actualizar con el estado que manda el host
  // ===================================================================

  actualizar(estado) {
    const destinos = this._posicionesDestino(estado);

    for (const id of estado.orden) {
      const j = estado.jugadores[id];
      const ficha = this.fichas.get(id) || this._crearFicha(j);
      const destino = destinos.get(id);
      ficha.material.opacity = j.conectado ? 1 : 0.3;

      if (destino.distanceTo(ficha.hacia) < 0.001) continue; // no se mueve

      const anterior = ficha.casilla;
      const esVecina = CASILLAS[anterior].siguientes.includes(j.casilla);
      ficha.casilla = j.casilla;

      if (j.casilla === anterior) {
        // Solo se recoloca dentro de la misma casilla
        this._mover(ficha, destino, 0.2, false);
      } else if (esVecina && !estado.rapido) {
        this._mover(ficha, destino, DURACION_SALTO, true);   // saltito normal
      } else if (esVecina) {
        this._mover(ficha, destino, 0.08, false);            // modo rápido
      } else {
        // Teletransporte (o se saltaron varias casillas de golpe)
        ficha.grupo.position.copy(destino);
        ficha.desde.copy(destino);
        ficha.hacia.copy(destino);
        ficha.t = 1;
      }
    }

    // Estrella
    if (estado.casillaEstrella != null) {
      const p = posicionCasilla(estado.casillaEstrella);
      this.estrella.position.set(p.x, p.y + 1.6, p.z);
      this.estrella.visible = true;
    }

    // ¿A quién sigue la cámara?
    this.idSeguido = estado.fase === 'turno' ? estado.turnoDe : null;

    // Flechas numeradas en las bifurcaciones
    this._quitarMarcadores();
    if (estado.decision && estado.decision.tipo === 'bifurcacion') {
      estado.decision.opciones.forEach((op, i) => {
        const marcador = etiquetaHTML('icono-opcion', String(i + 1));
        const p = posicionCasilla(op.id);
        marcador.position.set(p.x, p.y + 2.4, p.z);
        this.escena.add(marcador);
        this.marcadores.push(marcador);
      });
    }
  }

  _mover(ficha, destino, duracion, salta) {
    ficha.desde.copy(ficha.grupo.position);
    ficha.hacia.copy(destino);
    ficha.t = 0;
    ficha.duracion = duracion;
    ficha.salta = salta;
  }

  _quitarMarcadores() {
    for (const m of this.marcadores) this.escena.remove(m);
    this.marcadores = [];
  }

  // ===================================================================
  //  Bucle de dibujo (unas 60 veces por segundo)
  // ===================================================================

  _fotograma() {
    const dt = Math.min(this.reloj.getDelta(), 0.1);
    const tiempo = this.reloj.elapsedTime;

    // Animar fichas
    for (const ficha of this.fichas.values()) {
      if (ficha.t >= 1) continue;
      ficha.t = Math.min(1, ficha.t + dt / ficha.duracion);
      const k = ficha.t < 0.5 ? 2 * ficha.t * ficha.t : 1 - (-2 * ficha.t + 2) ** 2 / 2; // suavizado
      ficha.grupo.position.lerpVectors(ficha.desde, ficha.hacia, k);
      if (ficha.salta) ficha.grupo.position.y += Math.sin(Math.PI * ficha.t) * ALTURA_SALTO;
    }

    // Estrella girando y flotando
    this.estrella.rotation.y += dt * 1.5;
    this.estrella.children[0].position.y = Math.sin(tiempo * 2) * 0.15;

    for (const a of this.aspas) a.rotation.z += dt * 0.8;

    // Cámara: sigue suavemente al jugador del turno
    const seguida = this.idSeguido && this.fichas.get(this.idSeguido);
    const objetivo = seguida ? seguida.grupo.position : new THREE.Vector3(0, 0, 0);
    const offset = seguida ? OFFSET_CAMARA : OFFSET_CAMARA_GENERAL;
    const suavizado = 1 - Math.exp(-dt * 3.5);
    this.objetivoCamara.lerp(new THREE.Vector3(objetivo.x, 0, objetivo.z), suavizado);
    this.camara.position.lerp(this.objetivoCamara.clone().add(offset), suavizado);
    this.camara.lookAt(this.objetivoCamara);

    this.renderer.render(this.escena, this.camara);
    this.rendererEtiquetas.render(this.escena, this.camara);
  }

  redimensionar() {
    const ancho = this.contenedor.clientWidth || window.innerWidth;
    const alto = this.contenedor.clientHeight || window.innerHeight;
    this.camara.aspect = ancho / alto;
    this.camara.updateProjectionMatrix();
    this.renderer.setSize(ancho, alto);
    this.rendererEtiquetas.setSize(ancho, alto);
  }
}
