// logo.js — the rotating 3D point-of-origin emblem in the header logo bay.
//
// Its own tiny Three.js scene on canvas#logo (a perspective camera here is fine — this is a
// standalone bay, unlike the main gate which uses ortho to align with the 2D HUD). The
// point-of-origin glyph is a triangle (pyramid) with a small ring above its apex; we extrude
// both and spin them. Degrades gracefully if WebGL is unavailable.

import * as THREE from "three";

export class Logo {
  constructor(canvas) {
    this.canvas = canvas;
    this.ok = false;
  }

  init() {
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
      this.renderer.setClearColor(0x000000, 0);
    } catch (e) {
      console.warn("Logo: WebGL unavailable, emblem disabled.", e);
      this.canvas.style.display = "none";
      return this;
    }
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, 0, 5);

    const group = new THREE.Group();
    this.group = group;

    const mat = new THREE.MeshStandardMaterial({
      color: 0x2f6bff, emissive: 0x163a8a, metalness: 0.6, roughness: 0.3,
    });

    // triangle (point up)
    const tri = new THREE.Shape();
    const r = 1.0;
    tri.moveTo(0, r);
    tri.lineTo(r * 0.92, -r * 0.62);
    tri.lineTo(-r * 0.92, -r * 0.62);
    tri.closePath();
    const triGeo = new THREE.ExtrudeGeometry(tri, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
    triGeo.center();
    const triMesh = new THREE.Mesh(triGeo, mat);
    group.add(triMesh);

    // small ring near the apex (the point-of-origin dot/circle)
    const ringGeo = new THREE.TorusGeometry(0.17, 0.05, 12, 28);
    const ring = new THREE.Mesh(ringGeo, mat);
    ring.position.set(0, 0.52, 0.16);
    group.add(ring);

    group.scale.setScalar(0.9);
    this.scene.add(group);

    this.scene.add(new THREE.AmbientLight(0x4060a0, 0.8));
    const key = new THREE.DirectionalLight(0xbcd8ff, 1.4);
    key.position.set(2, 3, 4); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x3f7bff, 0.9);
    rim.position.set(-3, -1, 2); this.scene.add(rim);

    this.ok = true;
    return this;
  }

  layout(rect, dpr) {
    if (!this.ok) return;
    const { x, y, w, h } = rect;
    this.canvas.style.left = `${x}px`;
    this.canvas.style.top = `${y}px`;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.renderer.setPixelRatio(Math.min(dpr, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    if (!this.ok) return;
    this.group.rotation.y += dt * 0.0011;
    this.group.rotation.x = Math.sin(this.t = (this.t || 0) + dt * 0.0004) * 0.18;
    this.renderer.render(this.scene, this.camera);
  }
}
