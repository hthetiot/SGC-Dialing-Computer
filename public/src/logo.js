// logo.js — The rotating 3D SGC "point of origin" emblem (top-left of the screen).
//
// Earth point-of-origin glyph: a pyramid (triangle) with a circle (sun) above it, built
// as a thick extruded + beveled badge so it reads clearly as a 3D object catching light
// as it slowly turns. Also the click target that toggles the debug panel.

import * as THREE from "three";

export function buildLogo(palette = 0x7fd4ff) {
  const group = new THREE.Group();
  group.name = "SGCLogo";

  // Pyramid as a chevron-outline shape (triangle with an inner triangular hole).
  const tri = new THREE.Shape();
  tri.moveTo(0, 1.05);
  tri.lineTo(0.92, -0.72);
  tri.lineTo(-0.92, -0.72);
  tri.lineTo(0, 1.05);
  const hole = new THREE.Path();
  hole.moveTo(0, 0.55);
  hole.lineTo(0.46, -0.46);
  hole.lineTo(-0.46, -0.46);
  hole.lineTo(0, 0.55);
  tri.holes.push(hole);

  // Deeper extrusion + stronger bevel → unmistakably 3D at small viewport size.
  const exSettings = {
    depth: 0.55, bevelEnabled: true, bevelThickness: 0.16,
    bevelSize: 0.12, bevelSegments: 3, steps: 1, curveSegments: 8,
  };
  const triGeo = new THREE.ExtrudeGeometry(tri, exSettings);
  triGeo.center();

  // Metallic crystalline look, lightly emissive so it glows like the on-screen emblem.
  const mat = new THREE.MeshStandardMaterial({
    color: palette, metalness: 0.85, roughness: 0.18,
    emissive: palette, emissiveIntensity: 0.28,
    flatShading: false,
  });
  const triMesh = new THREE.Mesh(triGeo, mat);
  group.add(triMesh);

  // Sun ring above the pyramid (also extruded torus for depth).
  const ringGeo = new THREE.TorusGeometry(0.3, 0.1, 16, 40);
  const ring = new THREE.Mesh(ringGeo, mat.clone());
  ring.position.set(0, 1.05, 0);
  group.add(ring);

  group.userData.setColor = (hex) => {
    mat.color.setHex(hex); mat.emissive.setHex(hex);
    ring.material.color.setHex(hex); ring.material.emissive.setHex(hex);
  };
  group.scale.setScalar(0.62);
  return group;
}
