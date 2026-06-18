// gate.js — the authentic Stargate vector, mounted as live SVG and split into the parts that
// turn vs. the parts that stay put.
//
// Mechanical truth (GATE.md §1): the symbol ring spins inside fixed chevron housings.
//   ROTATING: Symbols, Main_gate_parts, Inner/Outer_Chevron_Delimiters
//   FIXED:    Alternative_Detailing, Chevron_Locks
// True ring center is (263.691, 264.729) — NOT the viewBox center — and the outer ring radius
// is 256.715. We scale so that radius maps to the screen gate radius R, and rotate the ring
// group about the true center so it spins true (no wobble).

const SVGNS = "http://www.w3.org/2000/svg";
const CENTER = { x: 263.691, y: 264.729 };
const OUTER_R = 256.715;

const ROTATING = ["Symbols", "Main_gate_parts", "Inner_Chevron_Delimiters", "Outer_Chevron_Delimiters"];
const FIXED = ["Alternative_Detailing", "Chevron_Locks"];

async function loadSVGText() {
  if (typeof window !== "undefined" && window.__SGC_GATE_SVG__) return window.__SGC_GATE_SVG__;
  const res = await fetch("./assets/gate.svg");
  return res.text();
}

export class Gate {
  constructor(host) {
    this.host = host;
    this.angle = 0;          // ring rotation, radians
    this.chevrons = [];      // [{angle, els:[...]}]
    this.lit = new Set();    // chevron angles currently reddened
  }

  async init() {
    const text = await loadSVGText();
    const parsed = new DOMParser().parseFromString(text, "image/svg+xml");
    const src = parsed.documentElement;

    // Host svg covers the viewport in 1:1 device pixels (viewBox set on resize).
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.id = "gate-svg";

    const root = document.createElementNS(SVGNS, "g");
    root.id = "gate-root";
    const ring = document.createElementNS(SVGNS, "g");
    ring.id = "ring";
    const fixed = document.createElementNS(SVGNS, "g");
    fixed.id = "fixed";

    for (const id of ROTATING) { const g = src.querySelector("#" + id); if (g) ring.appendChild(g); }
    for (const id of FIXED) { const g = src.querySelector("#" + id); if (g) fixed.appendChild(g); }

    root.appendChild(ring);
    root.appendChild(fixed);
    svg.appendChild(root);
    this.svg = svg; this.root = root; this.ring = ring; this.fixed = fixed;

    this.tagColors(root);
    this.host.appendChild(svg);
    this._splitChevrons(); // needs layout → getBBox; safe now it's in the DOM
    return this;
  }

  // Mark elements so CSS can recolor by role. "fill:none" elements (ring circles, tick lines,
  // housing detail) are strokes → recolored via stroke; filled glyphs/clamps inherit white from
  // #gate-root. The outermost circle becomes the blue rim.
  tagColors(root) {
    root.querySelectorAll("[fill='none']").forEach((el) => el.classList.add("g-stroke"));
    root.querySelectorAll("line").forEach((el) => el.classList.add("g-tick"));
    const circles = [...root.querySelectorAll("#Main_gate_parts circle")];
    circles.sort((a, b) => parseFloat(b.getAttribute("r")) - parseFloat(a.getAttribute("r")));
    if (circles[0]) circles[0].classList.add("g-rim");
  }

  // Bucket Chevron_Locks children into 9 clamps by centroid angle (0=+X, CCW, screen y-down).
  _splitChevrons() {
    const locks = this.fixed.querySelector("#Chevron_Locks");
    if (!locks) return;
    const targets = [90, 50, 10, 330, 290, 250, 210, 170, 130];
    const buckets = new Map(targets.map((a) => [a, []]));
    const kids = [...locks.querySelectorAll("path, polygon, polyline")];
    for (const el of kids) {
      let bb; try { bb = el.getBBox(); } catch { continue; }
      const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
      // angle about true center, CCW with +Y up (SVG y is down → negate)
      let deg = (Math.atan2(-(cy - CENTER.y), cx - CENTER.x) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      let best = targets[0], bd = 999;
      for (const t of targets) {
        let d = Math.abs(((deg - t + 540) % 360) - 180);
        if (d < bd) { bd = d; best = t; }
      }
      buckets.get(best).push(el);
    }
    this.chevrons = targets.map((a) => ({ angle: a, els: buckets.get(a) }));
  }

  setChevronLit(angle, on) {
    const c = this.chevrons.find((c) => c.angle === angle);
    if (!c) return;
    if (on) this.lit.add(angle); else this.lit.delete(angle);
    c.els.forEach((el) => el.classList.toggle("g-lit", on));
  }

  clearLocks() {
    for (const c of this.chevrons) c.els.forEach((el) => el.classList.remove("g-lit"));
    this.lit.clear();
  }

  setRotation(rad) {
    this.angle = rad;
    const deg = (rad * 180) / Math.PI;
    this.ring.setAttribute("transform", `rotate(${deg} ${CENTER.x} ${CENTER.y})`);
  }

  // Place + scale to current screen gate geometry.
  layout(screen) {
    const { vw, vh } = screen;
    const { cx, cy, R } = screen.gate();
    this.R = R;
    this.svg.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
    this.svg.setAttribute("width", vw);
    this.svg.setAttribute("height", vh);
    const k = R / OUTER_R;
    this.root.setAttribute(
      "transform",
      `translate(${cx} ${cy}) scale(${k}) translate(${-CENTER.x} ${-CENTER.y})`
    );
  }
}
