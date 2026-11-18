// =====================================================================
//  monumentos.js — Monumentos de España hechos con figuras simples
// ---------------------------------------------------------------------
//  Son solo DECORACIÓN (no son casillas). Están hechos con cajas,
//  cilindros y conos, estilo low-poly. En fases futuras se podrán
//  cambiar por modelos 3D de verdad (.glb).
// =====================================================================

import * as THREE from 'three';

/** Material "low-poly" (caras planas) de un color. */
function material(color) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 });
}

/** Crea una pieza, la coloca y la añade al grupo. */
function pieza(grupo, geometria, color, x, y, z) {
  const malla = new THREE.Mesh(geometria, material(color));
  malla.position.set(x, y, z);
  malla.castShadow = true;
  malla.receiveShadow = true;
  grupo.add(malla);
  return malla;
}

// ---------------------------- Sagrada Família ----------------------------
function sagradaFamilia() {
  const g = new THREE.Group();
  const piedra = '#d8c19a';
  pieza(g, new THREE.BoxGeometry(6, 2.5, 4), piedra, 0, 1.25, 0);
  // Torres: cilindro + cono encima
  const torres = [[-2.2, 7], [-0.8, 9], [0.8, 9], [2.2, 7], [0, 11]];
  torres.forEach(([x, alto], i) => {
    const z = i === 4 ? 0 : 1.2;
    pieza(g, new THREE.CylinderGeometry(0.45, 0.6, alto, 7), piedra, x, alto / 2, z);
    pieza(g, new THREE.ConeGeometry(0.5, 1.6, 7), '#b89c6e', x, alto + 0.8, z);
    pieza(g, new THREE.SphereGeometry(0.22, 6, 4), '#ff9f43', x, alto + 1.7, z);
  });
  return g;
}

// -------------------------- Acueducto de Segovia --------------------------
function acueducto() {
  const g = new THREE.Group();
  const piedra = '#b8977e';
  const arcos = 7;
  const ancho = 2;
  for (let i = 0; i <= arcos; i++) {
    const x = (i - arcos / 2) * ancho;
    pieza(g, new THREE.BoxGeometry(0.6, 3, 0.9), piedra, x, 1.5, 0);   // pilar de abajo
    pieza(g, new THREE.BoxGeometry(0.5, 2, 0.8), piedra, x, 4, 0);     // pilar de arriba
  }
  pieza(g, new THREE.BoxGeometry(arcos * ancho + 0.6, 0.5, 1), piedra, 0, 3.2, 0);
  pieza(g, new THREE.BoxGeometry(arcos * ancho + 0.6, 0.6, 1.1), piedra, 0, 5.2, 0);
  return g;
}

// -------------------------------- Giralda --------------------------------
function giralda() {
  const g = new THREE.Group();
  pieza(g, new THREE.BoxGeometry(2.4, 9, 2.4), '#d9a066', 0, 4.5, 0);
  pieza(g, new THREE.BoxGeometry(1.8, 2, 1.8), '#f2e3c6', 0, 10, 0);
  pieza(g, new THREE.BoxGeometry(1.2, 1.4, 1.2), '#d9a066', 0, 11.7, 0);
  pieza(g, new THREE.ConeGeometry(0.6, 1.4, 6), '#7fb069', 0, 13.1, 0);
  pieza(g, new THREE.SphereGeometry(0.3, 6, 4), '#ffc93c', 0, 14.1, 0);
  return g;
}

// ---------------------------- Puerta de Alcalá ----------------------------
function puertaAlcala() {
  const g = new THREE.Group();
  const piedra = '#eadfcb';
  // 4 pilares (dejan 3 huecos a modo de arcos)
  [-3.3, -1.1, 1.1, 3.3].forEach((x) => pieza(g, new THREE.BoxGeometry(1.2, 3.5, 1.4), piedra, x, 1.75, 0));
  pieza(g, new THREE.BoxGeometry(8, 1.2, 1.6), piedra, 0, 4.1, 0);
  pieza(g, new THREE.BoxGeometry(3, 1.2, 1.4), piedra, 0, 5.3, 0);
  // Frontón triangular (un "cilindro" de 3 lados tumbado)
  const fronton = pieza(g, new THREE.CylinderGeometry(1.2, 1.2, 1.3, 3), '#d6c7ad', 0, 6.2, 0);
  fronton.rotation.x = Math.PI / 2;
  fronton.rotation.y = Math.PI / 2;
  return g;
}

// --------------------------- Molino de La Mancha ---------------------------
function molino() {
  const g = new THREE.Group();
  pieza(g, new THREE.CylinderGeometry(0.9, 1.2, 3.2, 8), '#ffffff', 0, 1.6, 0);
  pieza(g, new THREE.ConeGeometry(1.1, 1.2, 8), '#5a4636', 0, 3.8, 0);
  // Aspas: un grupo que gira (lo anima la escena)
  const aspas = new THREE.Group();
  aspas.position.set(0, 3, 1.1);
  for (let i = 0; i < 4; i++) {
    const aspa = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.6, 0.05), material('#8b6b4a'));
    aspa.position.y = 1.3;
    const brazo = new THREE.Group();
    brazo.rotation.z = (i * Math.PI) / 2;
    brazo.add(aspa);
    aspas.add(brazo);
  }
  aspas.userData.gira = true;
  g.add(aspas);
  return g;
}

const FABRICAS = {
  sagrada: sagradaFamilia,
  acueducto,
  giralda,
  alcala: puertaAlcala,
  molino,
};

/** Crea el monumento indicado. Devuelve { grupo, altura }. */
export function crearMonumento(tipo) {
  const fabrica = FABRICAS[tipo] || molino;
  const grupo = fabrica();
  const caja = new THREE.Box3().setFromObject(grupo);
  return { grupo, altura: caja.max.y };
}

/** Arbolito low-poly (también decoración). */
export function crearArbol(escala = 1) {
  const g = new THREE.Group();
  pieza(g, new THREE.CylinderGeometry(0.15, 0.2, 0.8, 5), '#7a5233', 0, 0.4, 0);
  pieza(g, new THREE.ConeGeometry(0.8, 1.8, 6), '#3f9b4f', 0, 1.6, 0);
  g.scale.setScalar(escala);
  return g;
}
