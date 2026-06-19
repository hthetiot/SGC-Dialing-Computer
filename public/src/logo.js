// logo.js — the rotating 3D point-of-origin emblem in the logo bay (the ONLY Three.js piece).
// Own canvas (#logo), perspective camera. A pyramid (Earth's point-of-origin) + a ring, glowing cyan.

import * as THREE from "three";

let renderer, scene, camera, emblem;

export function initLogo(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 4.2);

  emblem = new THREE.Group();

  // point-of-origin pyramid (triangular prism, apex up)
  const tri = new THREE.Shape();
  tri.moveTo(0, 1); tri.lineTo(-0.9, -0.7); tri.lineTo(0.9, -0.7); tri.closePath();
  const pyr = new THREE.Mesh(
    new THREE.ExtrudeGeometry(tri, { depth: 0.35, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05 }),
    new THREE.MeshStandardMaterial({ color: 0x2f6bff, emissive: 0x123a8a, metalness: 0.6, roughness: 0.3 }),
  );
  pyr.position.z = -0.18;
  emblem.add(pyr);
  // wire overlay for the SGC look
  emblem.add(new THREE.LineSegments(new THREE.EdgesGeometry(pyr.geometry), new THREE.LineBasicMaterial({ color: 0x9fd0ff })));
  // little circle above the apex (the origin dot)
  emblem.add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 8, 24), new THREE.MeshStandardMaterial({ color: 0x9fd0ff, emissive: 0x224488 })).translateY(1.25));

  scene.add(emblem);
  scene.add(new THREE.AmbientLight(0x335577, 1.2));
  const key = new THREE.PointLight(0x9fd0ff, 30); key.position.set(2, 3, 4); scene.add(key);
}

export function resizeLogo(w, h) {
  if (!renderer) return;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}

export function renderLogo(tSec) {
  if (!renderer) return;
  emblem.rotation.y = tSec * 0.9;
  emblem.rotation.x = Math.sin(tSec * 0.5) * 0.15;
  renderer.render(scene, camera);
}
