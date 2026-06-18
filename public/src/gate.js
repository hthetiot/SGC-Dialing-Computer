// gate.js — Builds the TV-accurate Stargate from the authentic vector source.
//
// The base SVG (assets/gate.svg, viewBox 0 0 527.249 526.275) is organized into
// named layers: Main_gate_parts, Inner/Outer_Chevron_Delimiters, Alternative_Detailing,
// Chevron_Locks, and Symbols (the 39 glyphs). We parse each layer with Three's
// SVGLoader, normalize to a centered unit space, and assemble line geometry so the
// gate reads as the cyan HUD wireframe seen on the dialing computer screen.

import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { GLYPH_ORDER } from "./glyphs.js";

// Source viewBox.
const _VB = { w: 527.249, h: 526.275 };
// True gate ring center (from Main_gate_parts circles), NOT the viewBox center. The art is
// offset ~1.6px in Y; recentering on the viewBox center spins the ring off-axis (wobble).
// Recenter on the actual circle center so rotation.z spins the ring perfectly in place.
const CX = 263.691;
const CY = 264.729;
// Scale so the outer ring radius (largest circle r=256.71) maps to ≈ 1.0 world unit.
const GATE_OUTER_R = 256.71;
const WORLD = 1 / GATE_OUTER_R;

const LAYER_IDS = [
  "Main_gate_parts",
  "Inner_Chevron_Delimiters",
  "Outer_Chevron_Delimiters",
  "Alternative_Detailing",
  "Chevron_Locks",
  "Symbols",
];

// Map an SVG-space point to centered, Y-up world space.
function toWorld(x, y) {
  return new THREE.Vector2((x - CX) * WORLD, -(y - CY) * WORLD);
}

// Pull all <path>/<shape> subpaths belonging to a given layer id out of the loaded SVG.
// SVGLoader flattens the tree but preserves each node's id chain on userData via the
// original DOM, so we re-walk the DOM to bucket paths by their ancestor layer.
function bucketByLayer(svgText) {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const buckets = {};
  for (const id of LAYER_IDS) {
    const root = doc.getElementById(id);
    buckets[id] = root ? collectPathStrings(root) : [];
  }
  // Symbols: keep them grouped per-glyph (by constellation id) and in ring order.
  const symbolsRoot = doc.getElementById("Symbols");
  const perGlyph = [];
  if (symbolsRoot) {
    for (const name of GLYPH_ORDER) {
      const g = doc.getElementById(name);
      perGlyph.push({ name, dPaths: g ? collectPathStrings(g) : [] });
    }
  }
  return { buckets, perGlyph };
}

// Recursively gather path 'd' strings (and convert primitive shapes to 'd') under a node.
function collectPathStrings(node) {
  const out = [];
  const walk = (el) => {
    const tag = el.tagName?.toLowerCase();
    if (tag === "path") {
      const d = el.getAttribute("d");
      if (d) out.push(d);
    } else if (tag === "polygon" || tag === "polyline") {
      const pts = (el.getAttribute("points") || "").trim();
      const nums = pts.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
      let d = "";
      for (let i = 0; i + 1 < nums.length; i += 2) {
        d += (i === 0 ? "M" : "L") + nums[i] + "," + nums[i + 1] + " ";
      }
      if (tag === "polygon") d += "Z";
      if (d) out.push(d);
    } else if (tag === "rect") {
      const x = +el.getAttribute("x") || 0, y = +el.getAttribute("y") || 0;
      const w = +el.getAttribute("width"), h = +el.getAttribute("height");
      out.push(`M${x},${y} L${x + w},${y} L${x + w},${y + h} L${x},${y + h} Z`);
    } else if (tag === "line") {
      const x1 = +el.getAttribute("x1") || 0, y1 = +el.getAttribute("y1") || 0;
      const x2 = +el.getAttribute("x2") || 0, y2 = +el.getAttribute("y2") || 0;
      out.push(`M${x1},${y1} L${x2},${y2}`);
    } else if (tag === "circle") {
      const cx = +el.getAttribute("cx") || 0, cy = +el.getAttribute("cy") || 0, r = +el.getAttribute("r");
      // two arcs make a full circle
      out.push(`M${cx - r},${cy} A${r},${r} 0 1,0 ${cx + r},${cy} A${r},${r} 0 1,0 ${cx - r},${cy} Z`);
    } else if (tag === "ellipse") {
      const cx = +el.getAttribute("cx") || 0, cy = +el.getAttribute("cy") || 0;
      const rx = +el.getAttribute("rx"), ry = +el.getAttribute("ry");
      out.push(`M${cx - rx},${cy} A${rx},${ry} 0 1,0 ${cx + rx},${cy} A${rx},${ry} 0 1,0 ${cx - rx},${cy} Z`);
    }
    for (const c of el.children) walk(c);
  };
  walk(node);
  return out;
}

// Convert an array of SVG path 'd' strings into a single THREE line-segments geometry,
// sampling each subpath into points. This gives the crisp wireframe look (not filled).
function pathsToLineGeometry(dPaths, divisions = 24) {
  const positions = [];
  const loader = new SVGLoader();
  for (const d of dPaths) {
    // SVGLoader parses a full <path>; wrap the d string.
    const node = loader.parse(
      `<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`
    );
    for (const path of node.paths) {
      for (const sub of path.subPaths) {
        const pts = sub.getPoints(divisions);
        for (let i = 0; i + 1 < pts.length; i++) {
          const a = toWorld(pts[i].x, pts[i].y);
          const b = toWorld(pts[i + 1].x, pts[i + 1].y);
          positions.push(a.x, a.y, 0, b.x, b.y, 0);
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

// Angle (deg, 0=+X CCW) of a path 'd' string's centroid relative to the gate center,
// for clustering Chevron_Locks paths into the 9 chevrons.
function pathCentroidAngle(d) {
  const nums = d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!nums || nums.length < 2) return 0;
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i + 1 < nums.length; i += 2) { sx += +nums[i]; sy += +nums[i + 1]; n++; }
  const cx = sx / n, cy = sy / n;
  // gate center in SVG space is (CX, CY)
  let a = Math.atan2(-(cy - CY), cx - CX) * 180 / Math.PI;
  if (a < 0) a += 360;
  return a;
}

// Split chevron path strings into 9 buckets keyed by nearest chevron center angle.
const CHEVRON_CENTERS = [90, 50, 10, 330, 290, 250, 210, 170, 130];
function splitChevronPaths(dPaths) {
  const buckets = {};
  for (const c of CHEVRON_CENTERS) buckets[c] = [];
  for (const d of dPaths) {
    const a = pathCentroidAngle(d);
    let best = CHEVRON_CENTERS[0], bestDist = 999;
    for (const c of CHEVRON_CENTERS) {
      const dist = Math.min(Math.abs(a - c), 360 - Math.abs(a - c));
      if (dist < bestDist) { bestDist = dist; best = c; }
    }
    buckets[best].push(d);
  }
  return buckets;
}

// Convert glyph paths to FILLED shapes (glyphs render as solid cyan strokes on the ring).
function pathsToFillGeometry(dPaths) {
  const loader = new SVGLoader();
  const geos = [];
  for (const d of dPaths) {
    const node = loader.parse(
      `<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`
    );
    for (const path of node.paths) {
      const shapes = SVGLoader.createShapes(path);
      for (const shape of shapes) {
        const g = new THREE.ShapeGeometry(shape);
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const w = toWorld(pos.getX(i), pos.getY(i));
          pos.setXYZ(i, w.x, w.y, 0);
        }
        pos.needsUpdate = true;
        geos.push(g);
      }
    }
  }
  return geos;
}

export const GATE_PALETTE = {
  cyan: {
    main: 0x7fd4ff,
    innerDelim: 0x3a7fa8,
    outerDelim: 0x2f6a8a,
    detail: 0x1f4a66,
    chevron: 0xaef0ff,
    glyph: 0xeaf8ff,
    glyphLit: 0xffffff,
    lock: 0xff4530,
  },
  red: {
    main: 0xff5a44,
    innerDelim: 0xa83a30,
    outerDelim: 0x8a2f2a,
    detail: 0x661f1c,
    chevron: 0xffb0a4,
    glyph: 0xffd8d2,
    glyphLit: 0xff9f92,
    lock: 0xff2a18,
  },
};

// Build the full gate object3D. Returns { group, layers, glyphMeshes, setPalette }.
export async function buildGate(svgUrlOrText, opts = {}) {
  // Accept either an inlined SVG string (starts with '<') or a URL to fetch.
  const svgText = (typeof svgUrlOrText === "string" && svgUrlOrText.trim().startsWith("<"))
    ? svgUrlOrText
    : await (await fetch(svgUrlOrText)).text();
  const { buckets, perGlyph } = bucketByLayer(svgText);
  const pal = GATE_PALETTE[opts.palette || "cyan"];

  const group = new THREE.Group();
  group.name = "Stargate";
  const layers = {};

  // Two sub-groups: the ring (glyphs + delimiters + ring circles) ROTATES during dialing;
  // the chevron clamps + housing plates STAY FIXED. This matches the real gate mechanism —
  // the symbol ring spins inside the fixed chevron housings.
  const ringGroup = new THREE.Group(); ringGroup.name = "RingGroup";
  const staticGroup = new THREE.Group(); staticGroup.name = "StaticGroup";
  group.add(staticGroup);
  group.add(ringGroup);

  const mkLines = (id, color, parent, lw = 1) => {
    const geo = pathsToLineGeometry(buckets[id] || []);
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
    });
    const obj = new THREE.LineSegments(geo, mat);
    obj.name = id;
    layers[id] = obj;
    parent.add(obj);
    return obj;
  };

  // STATIC: chevron housings + clamps
  mkLines("Alternative_Detailing", pal.detail, staticGroup);
  // Chevron_Locks split into 9 per-chevron meshes so each can turn red when its glyph locks.
  const chevronBuckets = splitChevronPaths(buckets["Chevron_Locks"] || []);
  const chevronMeshes = {}; // angleDeg → LineSegments
  for (const angle of CHEVRON_CENTERS) {
    const geo = pathsToLineGeometry(chevronBuckets[angle] || []);
    const mat = new THREE.LineBasicMaterial({ color: pal.chevron, transparent: true, opacity: 0.95 });
    const obj = new THREE.LineSegments(geo, mat);
    obj.name = "Chevron_" + angle;
    obj.userData = { angle, red: false };
    chevronMeshes[angle] = obj;
    staticGroup.add(obj);
  }
  layers["Chevron_Locks"] = staticGroup; // keep layer key for toggling
  // ROTATING: ring band + delimiters + main circles
  mkLines("Outer_Chevron_Delimiters", pal.outerDelim, ringGroup);
  mkLines("Inner_Chevron_Delimiters", pal.innerDelim, ringGroup);
  mkLines("Main_gate_parts", pal.main, ringGroup);

  // Glyphs: filled, one mesh per constellation — part of the ROTATING ring.
  const glyphGroup = new THREE.Group();
  glyphGroup.name = "Glyphs";
  const glyphMeshes = [];
  perGlyph.forEach(({ name, dPaths }, idx) => {
    const geos = pathsToFillGeometry(dPaths);
    const mat = new THREE.MeshBasicMaterial({
      color: pal.glyph,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Group();
    m.name = "glyph_" + name;
    for (const g of geos) m.add(new THREE.Mesh(g, mat));
    // centroid (in world units) so the lock flip can pivot around the glyph's own center
    const bb = new THREE.Box3();
    for (const g of geos) { g.computeBoundingBox(); bb.union(g.boundingBox); }
    const center = new THREE.Vector3();
    bb.getCenter(center);
    // Pivot setup: place the group AT the centroid and offset children back by -centroid,
    // so the group's local origin is the glyph's center. Rotation/scale now happen in place.
    m.position.set(center.x, center.y, 0);
    for (const child of m.children) child.position.set(-center.x, -center.y, 0);
    m.userData = {
      index: idx, name, mat, lit: false,
      center: center.clone(), anim: null,
    };
    glyphMeshes.push(m);
    glyphGroup.add(m);
  });
  layers["Symbols"] = glyphGroup;
  ringGroup.add(glyphGroup);

  // CENTER EMBLEM — the persistent point-of-origin glyph (Earth symbol, glyph index 0) shown
  // big and bold in the gate's empty center whenever the gate is engaged. Cyan outline + glow.
  // Lives in the fixed group (does NOT rotate). NOT a flying glyph.
  const heroGroup = new THREE.Group();
  heroGroup.name = "CenterEmblem";
  heroGroup.visible = false;
  staticGroup.add(heroGroup);
  const heroMat = new THREE.MeshBasicMaterial({
    color: 0x6fe0ff, transparent: true, opacity: 1, side: THREE.DoubleSide,
  });
  const _heroGeoCache = {};
  let _heroAnim = null; // fade/pop-in only

  function _heroGeoFor(idx) {
    if (_heroGeoCache[idx]) return _heroGeoCache[idx];
    // The point-of-origin (and glyphs generally) are FILLED shapes in the source. Use the
    // real fill geometry (NOT stroke-to-ribbon, which collapses filled shapes into a blob),
    // then recenter on the glyph centroid so it sits at the gate center.
    const { dPaths } = perGlyph[idx];
    const geos = pathsToFillGeometry(dPaths);
    // recenter on centroid
    const bb = new THREE.Box3();
    for (const g of geos) { g.computeBoundingBox(); bb.union(g.boundingBox); }
    const c = new THREE.Vector3(); bb.getCenter(c);
    for (const g of geos) g.translate(-c.x, -c.y, 0);
    _heroGeoCache[idx] = geos;
    return geos;
  }

  const ORIGIN_INDEX = 0; // point-of-origin glyph

  // Show the point-of-origin emblem big in the center (persistent while engaged).
  function showCenterEmblem(idx = ORIGIN_INDEX) {
    while (heroGroup.children.length) heroGroup.remove(heroGroup.children[0]);
    const geos = _heroGeoFor(idx);
    for (const g of geos) heroGroup.add(new THREE.Mesh(g, heroMat));
    heroGroup.position.set(0, 0, 0.02);
    heroGroup.scale.setScalar(1.8); // fills a good part of the inner void (filled emblem)
    heroGroup.visible = true;
    heroMat.opacity = 0;
    _heroAnim = { t: 0, dur: 0.5 }; // fade/pop in
  }

  function hideCenterEmblem() { heroGroup.visible = false; _heroAnim = null; }

  function updateHeroGlyph(dt) {
    if (!_heroAnim || !heroGroup.visible) return;
    const a = _heroAnim;
    a.t += dt;
    const u = Math.min(a.t / a.dur, 1);
    const e = 1 - Math.pow(1 - u, 3);
    heroMat.opacity = e;
    heroGroup.scale.setScalar(1.8 * (0.85 + 0.15 * e)); // gentle pop
    if (u >= 1) _heroAnim = null;
  }

  // keep emblem color in sync with palette
  function setEmblemColor(hex) { heroMat.color.setHex(hex); }

  let _curPal = pal;
  function setPalette(key) {
    const p = GATE_PALETTE[key] || GATE_PALETTE.cyan;
    _curPal = p;
    layers["Alternative_Detailing"].material.color.setHex(p.detail);
    layers["Outer_Chevron_Delimiters"].material.color.setHex(p.outerDelim);
    layers["Inner_Chevron_Delimiters"].material.color.setHex(p.innerDelim);
    layers["Main_gate_parts"].material.color.setHex(p.main);
    // per-chevron meshes: keep red ones red, recolor the rest
    for (const angle of CHEVRON_CENTERS) {
      const o = chevronMeshes[angle];
      o.material.color.setHex(o.userData.red ? 0xff3a24 : p.chevron);
    }
    for (const m of glyphMeshes) {
      m.userData.mat.color.setHex(m.userData.lit ? p.glyphLit : p.glyph);
    }
  }

  // Set a chevron (by lock-order index 0..6) red, or reset. Lock order → angle:
  // 1..7 = [50,10,330,290,250,210,90] (7th/origin = top 90).
  const LOCK_ORDER_ANGLES = [50, 10, 330, 290, 250, 210, 90];
  const RED = 0xff3a24;
  function setChevronRed(lockIndex, on) {
    const angle = LOCK_ORDER_ANGLES[lockIndex];
    const obj = chevronMeshes[angle];
    if (!obj) return;
    obj.userData.red = on;
    obj.material.color.setHex(on ? RED : (palette() ? palette().chevron : pal.chevron));
  }
  function resetChevrons() {
    for (const angle of CHEVRON_CENTERS) {
      const o = chevronMeshes[angle];
      o.userData.red = false;
      o.material.color.setHex(pal.chevron);
    }
  }
  function palette() { return _curPal; }

  return {
    group, ringGroup, staticGroup, layers, glyphMeshes,
    chevronMeshes, setChevronRed, resetChevrons,
    setPalette, updateGlyphAnims, palette: pal,
    showCenterEmblem, hideCenterEmblem, updateHeroGlyph, setEmblemColor,
  };

  // Per-frame driver for the lock animation: illuminate-and-flip. For any glyph with an
  // active anim, over its duration: scale up then settle, Y-axis flip (rotation.y 0→2π),
  // and brighten toward white at the peak, settling on the lit color. Pivot is the glyph's
  // own centroid (position offset by ±center so the flip spins in place, not around the gate).
  function updateGlyphAnims(dt, palette) {
    const pal2 = palette || pal;
    const white = new THREE.Color(0xffffff);
    for (const m of glyphMeshes) {
      const a = m.userData.anim;
      if (!a) continue;
      a.t += dt;
      const u = Math.min(a.t / a.dur, 1);
      // Single clean flip read under the ORTHOGRAPHIC camera. rotation.y shows no perspective
      // in ortho, so the flip is driven by scale.x: the glyph turns edge-on once (xFlip→0 at
      // u=0.5) and faces back. Gentle scale lift + a bright glow pulse sell the "engage".
      const eased = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; // ease in-out
      // map to a signed flip so it actually crosses zero (edge-on) cleanly
      const face = Math.cos(eased * Math.PI * 2);              // 1 → -1 → 1
      const lift = 1 + 0.18 * Math.sin(Math.PI * u);           // subtle scale lift
      m.scale.set(face * lift, lift, 1);                       // negative x = back face (flip)
      // brightness: white-hot at edge-on (mid), settling on lit
      const peak = Math.sin(Math.PI * u);
      m.userData.mat.color.copy(new THREE.Color(pal2.glyphLit).lerp(white, peak));
      m.userData.mat.opacity = 1;
      if (u >= 1) {
        m.scale.set(1, 1, 1);
        m.userData.mat.color.setHex(pal2.glyphLit);
        m.userData.anim = null;
      }
    }
  }
}

// The angular position (radians, 0 at +X, CCW) of glyph slot i for ring rotation math.
// Glyph 0 (Origin) sits at top in the source; 39 slots evenly spaced.
export const GLYPH_COUNT = GLYPH_ORDER.length; // 39
export function glyphAngle(i) {
  // Top of gate is +Y. Origin is centered at top in the source art.
  return Math.PI / 2 - (i / GLYPH_COUNT) * Math.PI * 2;
}
