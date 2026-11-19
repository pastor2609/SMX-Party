// =====================================================================
//  plataforma/vista.js — Dibujo 3D de "Fuera de la plataforma"
// ---------------------------------------------------------------------
//  Solo DIBUJA. Recibe (ya suavizado por el BufferInstantaneas) el
//  estado que calcula el host y lo pinta: plataforma, borde que
//  parpadea, jugadores, chapuzones e indicador de recarga.
//
//  Toda vista de minijuego de tiempo real tiene estos métodos:
//    constructor({ contenedor, jugadores, miId })
//    dibujar(instantanea, dt)
//    destruir()
// =====================================================================

import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { crearFiguraJugador } from '../comun/figura-jugador.js';
import { AJUSTES } from './simulacion.js';

const NIVEL_AGUA = -1;

export class Vista {
  constructor({ contenedor, jugadores, miId }) {
    this.contenedor = contenedor;
    this.miId = miId;
    this.tiempo = 0;
    this.figuras = new Map();    // id -> { grupo, material, yAnterior }
    this.chapuzones = [];
    this._claveAviso = null;

    // --- Motor de dibujo ---
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    contenedor.appendChild(this.renderer.domElement);
    this.etiquetas = new CSS2DRenderer();
    Object.assign(this.etiquetas.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' });
    contenedor.appendChild(this.etiquetas.domElement);

    this.escena = new THREE.Scene();
    this.escena.background = new THREE.Color('#8fd3ff');
    this.escena.fog = new THREE.Fog('#8fd3ff', 40, 90);

    // Cámara fija, desde arriba e inclinada
    this.camara = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    this.camara.position.set(0, 18, 13);
    this.camara.lookAt(0, -0.5, 0.8);

    this.escena.add(new THREE.HemisphereLight('#ffffff', '#3a6ea5', 0.9));
    const sol = new THREE.DirectionalLight('#ffffff', 1.5);
    sol.position.set(8, 20, 10);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    Object.assign(sol.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
    this.escena.add(sol);

    this._crearMar();
    this._crearPlataforma();
    for (const j of jugadores) this._crearFigura(j);
    this._crearInterfaz();

    this._alRedimensionar = () => this.redimensionar();
    window.addEventListener('resize', this._alRedimensionar);
    this.redimensionar();
  }

  // -------------------------------------------------------------------
  _crearMar() {
    this.mar = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220, 40, 40),
      new THREE.MeshStandardMaterial({ color: '#2f86e0', flatShading: true, roughness: 0.4 }),
    );
    this.mar.rotation.x = -Math.PI / 2;
    this.mar.position.y = NIVEL_AGUA;
    this.mar.receiveShadow = true;
    this.escena.add(this.mar);
    this._alturasMar = this.mar.geometry.attributes.position;
  }

  _crearPlataforma() {
    const R = AJUSTES.RADIO_INICIAL;
    this.plataforma = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(R, R * 0.85, 3, 48),
      new THREE.MeshStandardMaterial({ color: '#b98d5f', flatShading: true }),
    );
    base.position.y = -1.6; // un poco por debajo de la tapa (para que no "parpadeen")
    const tapa = new THREE.Mesh(
      new THREE.CylinderGeometry(R, R, 0.2, 48),
      new THREE.MeshStandardMaterial({ color: '#f1dfae' }),
    );
    tapa.position.y = -0.1;
    tapa.receiveShadow = true;
    // Dibujo de diana en el centro (decoración)
    const diana = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.6, 40),
      new THREE.MeshStandardMaterial({ color: '#e6c77f' }),
    );
    diana.rotation.x = -Math.PI / 2;
    diana.position.y = 0.01;
    this.plataforma.add(base, tapa, diana);
    this.escena.add(this.plataforma);

    // Anillo rojo que avisa de la parte que va a desaparecer
    this.anilloAviso = new THREE.Mesh(
      new THREE.RingGeometry(1, 2, 64),
      new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    this.anilloAviso.rotation.x = -Math.PI / 2;
    this.anilloAviso.position.y = 0.03;
    this.anilloAviso.visible = false;
    this.escena.add(this.anilloAviso);
  }

  _crearFigura(jugador) {
    const esMio = jugador.id === this.miId;
    const figura = crearFiguraJugador(jugador, esMio);
    if (esMio) {
      // Aro blanco bajo mis pies para encontrarme rápido
      const aro = new THREE.Mesh(
        new THREE.TorusGeometry(0.75, 0.06, 8, 32),
        new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      );
      aro.rotation.x = Math.PI / 2;
      aro.position.y = 0.05;
      figura.grupo.add(aro);
    }
    this.escena.add(figura.grupo);
    this.figuras.set(jugador.id, { ...figura, yAnterior: 0, visible: true });
  }

  /** Indicador de recarga del empujón y aviso de espectador (HTML). */
  _crearInterfaz() {
    this.uiRecarga = document.createElement('div');
    this.uiRecarga.className = 'mj-recarga oculto';
    this.uiRecarga.innerHTML = '<span class="mj-recarga-texto"></span><div class="mj-barra"><div class="mj-relleno"></div></div>';
    this.uiEspectador = document.createElement('div');
    this.uiEspectador.className = 'mj-espectador oculto';
    this.uiEspectador.textContent = '💦 ¡Al agua! Ahora miras como espectador.';
    this.contenedor.append(this.uiRecarga, this.uiEspectador);
  }

  // -------------------------------------------------------------------
  //  Dibujar
  // -------------------------------------------------------------------
  dibujar(s, dt) {
    this.tiempo += dt;
    this._animarMar();

    if (s) {
      // Plataforma (encoge escalándola)
      const escala = s.radio / AJUSTES.RADIO_INICIAL;
      this.plataforma.scale.set(escala, 1, escala);
      this._pintarAviso(s);

      for (const [id, p] of Object.entries(s.j)) {
        const f = this.figuras.get(id);
        if (f) this._pintarJugador(f, p);
      }
      this._pintarInterfaz(s.j[this.miId]);
    }

    this._animarChapuzones(dt);
    this.renderer.render(this.escena, this.camara);
    this.etiquetas.render(this.escena, this.camara);
  }

  _pintarAviso(s) {
    if (s.aviso === null || s.aviso === undefined) {
      this.anilloAviso.visible = false;
      return;
    }
    const clave = `${s.aviso}|${s.radio.toFixed(2)}`;
    if (clave !== this._claveAviso) {
      this._claveAviso = clave;
      this.anilloAviso.geometry.dispose();
      this.anilloAviso.geometry = new THREE.RingGeometry(s.aviso, s.radio, 64);
    }
    this.anilloAviso.visible = true;
    // Parpadeo: encendido / apagado unas 4 veces por segundo
    this.anilloAviso.material.opacity = Math.sin(this.tiempo * 25) > 0 ? 0.85 : 0.2;
  }

  _pintarJugador(f, p) {
    const visible = p.est !== 'fuera';
    f.grupo.visible = visible;
    f.etiqueta.visible = visible; // el nombre (HTML) hay que ocultarlo aparte
    if (!visible) return;
    f.grupo.position.set(p.x, p.y, p.z);
    f.grupo.rotation.y = p.ang;
    // Al embestir, brilla un poco y se estira hacia delante
    f.material.emissive.set(p.emb ? '#ffffff' : '#000000');
    f.material.emissiveIntensity = p.emb ? 0.35 : 0;
    f.grupo.scale.set(1, 1, p.emb ? 1.25 : 1);
    // ¿Acaba de tocar el agua? -> ¡chapuzón!
    if (p.est !== 'vivo' && f.yAnterior > NIVEL_AGUA && p.y <= NIVEL_AGUA) this._chapuzon(p.x, p.z);
    f.yAnterior = p.y;
  }

  _pintarInterfaz(yo) {
    const juego = !!yo;
    this.uiRecarga.classList.toggle('oculto', !juego || yo.est !== 'vivo');
    this.uiEspectador.classList.toggle('oculto', !juego || yo.est === 'vivo');
    if (!juego || yo.est !== 'vivo') return;
    const listo = yo.rec <= 0.001;
    this.uiRecarga.classList.toggle('listo', listo);
    this.uiRecarga.querySelector('.mj-recarga-texto').textContent = listo ? '💥 Empujón listo (Espacio)' : '⏳ Recargando…';
    this.uiRecarga.querySelector('.mj-relleno').style.width = `${Math.round((1 - yo.rec) * 100)}%`;
  }

  // -------------------------------------------------------------------
  //  Efectos
  // -------------------------------------------------------------------
  _animarMar() {
    // Pequeñas olas moviendo los vértices del mar
    const pos = this._alturasMar;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(i, Math.sin(x * 0.3 + this.tiempo * 1.5) * 0.12 + Math.cos(y * 0.25 + this.tiempo) * 0.12);
    }
    pos.needsUpdate = true;
  }

  _chapuzon(x, z) {
    const grupo = new THREE.Group();
    grupo.position.set(x, NIVEL_AGUA + 0.1, z);
    const material = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 });
    const gotas = [];
    for (let i = 0; i < 16; i++) {
      const gota = new THREE.Mesh(new THREE.SphereGeometry(0.12 + Math.random() * 0.1, 6, 4), material);
      const angulo = Math.random() * Math.PI * 2;
      const fuerza = 2 + Math.random() * 3;
      gota.userData.v = new THREE.Vector3(Math.cos(angulo) * fuerza, 5 + Math.random() * 4, Math.sin(angulo) * fuerza);
      gotas.push(gota);
      grupo.add(gota);
    }
    const ola = new THREE.Mesh(
      new THREE.TorusGeometry(0.6, 0.12, 6, 24),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }),
    );
    ola.rotation.x = Math.PI / 2;
    grupo.add(ola);
    this.escena.add(grupo);
    this.chapuzones.push({ grupo, gotas, ola, material, vida: 0 });
  }

  _animarChapuzones(dt) {
    for (const c of [...this.chapuzones]) {
      c.vida += dt;
      for (const g of c.gotas) {
        g.userData.v.y -= 18 * dt;
        g.position.addScaledVector(g.userData.v, dt);
      }
      c.ola.scale.setScalar(1 + c.vida * 4);
      const opacidad = Math.max(0, 1 - c.vida / 1.2);
      c.material.opacity = opacidad;
      c.ola.material.opacity = opacidad;
      if (c.vida > 1.2) {
        this.escena.remove(c.grupo);
        this.chapuzones.splice(this.chapuzones.indexOf(c), 1);
      }
    }
  }

  // -------------------------------------------------------------------
  redimensionar() {
    const ancho = this.contenedor.clientWidth || window.innerWidth;
    const alto = this.contenedor.clientHeight || window.innerHeight;
    this.camara.aspect = ancho / alto;
    // En pantallas estrechas alejamos la cámara para que quepa la plataforma
    this.camara.position.set(0, 18 / Math.min(1, this.camara.aspect), 13 / Math.min(1, this.camara.aspect));
    this.camara.lookAt(0, -0.5, 0.8);
    this.camara.updateProjectionMatrix();
    this.renderer.setSize(ancho, alto);
    this.etiquetas.setSize(ancho, alto);
  }

  destruir() {
    window.removeEventListener('resize', this._alRedimensionar);
    this.escena.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
      if (o.isCSS2DObject) o.element.remove();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.contenedor.textContent = '';
  }
}
