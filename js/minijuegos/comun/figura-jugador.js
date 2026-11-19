// =====================================================================
//  figura-jugador.js — Muñeco simple de un jugador (para minijuegos)
// ---------------------------------------------------------------------
//  Cuerpo + cabeza de su color, una "nariz" que indica hacia dónde
//  mira y su nombre encima. Cuando haya personajes .glb, se cambiará
//  solo este archivo.
// =====================================================================

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/**
 * Crea la figura. Devuelve { grupo, material, etiqueta }.
 * El grupo mira hacia +z cuando rotation.y = 0.
 */
export function crearFiguraJugador(jugador, esMio) {
  const grupo = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: jugador.color, roughness: 0.5 });

  const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 1, 16), material);
  cuerpo.position.y = 0.5;
  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), material);
  cabeza.position.y = 1.3;
  const nariz = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: '#ffffff' }),
  );
  nariz.rotation.x = Math.PI / 2;
  nariz.position.set(0, 1.3, 0.45);
  for (const m of [cuerpo, cabeza, nariz]) m.castShadow = true;
  grupo.add(cuerpo, cabeza, nariz);

  const div = document.createElement('div');
  div.className = 'nombre-ficha' + (esMio ? ' nombre-mio' : '');
  div.textContent = esMio ? `${jugador.nombre} (tú)` : jugador.nombre;
  div.style.background = jugador.color;
  const etiqueta = new CSS2DObject(div);
  etiqueta.position.y = 2.2;
  grupo.add(etiqueta);

  return { grupo, material, etiqueta };
}
