// screen.js — responsive coordinate mapper.
//
// The HUD is authored in a normalized frame (fractions of the viewport) measured at the
// canonical 1.25:1 aspect (1000x800). Two scales:
//   px(nx) = nx * vw   — x positions / widths track the viewport width
//   py(ny) = ny * vh   — y positions / heights track the viewport height
// At 1.25:1 this is pixel-faithful to the reference. On other aspects the side panels stay
// anchored to the true viewport edges (their nx are near 0 / near 1) and only spread apart,
// while square things (radii, strokes, fonts) use the uniform unit u so they never distort.
//
// The gate is a circle, so its radius comes from width but is clamped to fit the height.

export const DESIGN = { w: 1000, h: 800 };
const MONO = '"DejaVu Sans Mono", "Consolas", "Courier New", monospace';

export class Screen {
  constructor(layout) {
    this.layout = layout;
    this.vw = 1;
    this.vh = 1;
    this.dpr = 1;
    this.u = 1;           // uniform unit: vh / 800
    this.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
  }

  resize(vw, vh, dpr) {
    this.vw = vw;
    this.vh = vh;
    this.dpr = Math.min(dpr || 1, 2);
    this.u = vh / DESIGN.h;
    return this;
  }

  // normalized fraction -> device pixels
  px(nx) { return nx * this.vw; }
  py(ny) { return ny * this.vh; }
  // square-preserving size from a value expressed in 800-tall design units
  us(designUnits) { return designUnits * this.u; }

  rect(r) {
    return { x: this.px(r.x), y: this.py(r.y), w: this.px(r.w), h: this.py(r.h) };
  }

  // Gate geometry in device pixels. R from width, clamped so the ring + chevrons fit vertically.
  gate() {
    const g = this.layout.gate;
    const cx = this.px(g.center.x);
    const cy = this.py(g.center.y);
    // chevrons reach to 0.93*R outward + clamp size; keep the whole thing inside the viewport.
    const maxByHeight = Math.min(cy, this.vh - cy) / 1.04;
    const R = Math.min(g.outerR * this.vw, maxByHeight);
    return { cx, cy, R };
  }

  // font helper -> canvas font string sized in design units. NB: canvas ctx.font does not
  // resolve CSS custom properties, so use a concrete monospace stack here.
  font(designPx, { weight = 400, family = MONO } = {}) {
    return `${weight} ${Math.max(1, Math.round(this.us(designPx)))}px ${family}`;
  }
}
