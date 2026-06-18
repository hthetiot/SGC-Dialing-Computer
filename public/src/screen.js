// screen.js — Maps the reference layout (designed at 1.25:1, 1000×800) into the actual
// viewport so it stays screen-accurate at 1.25:1 and degrades gracefully on any other
// aspect (ultra-wide desktop, tall mobile).
//
// Strategy: a "screen rect" is fit inside the viewport. We never stretch — we letterbox
// the *design space* but then let panels anchor to the true viewport edges so wide/tall
// windows fill naturally instead of leaving dead bands. Concretely:
//   - The gate lives in a region whose size tracks the smaller fitting dimension, and it
//     is centered in the left/main area (as in the reference, slightly left of center).
//   - Left panels anchor to the left viewport edge; the result-box column anchors to the
//     right viewport edge; top bar and footers anchor to top/bottom.
//   - At exactly 1.25:1 every mapped point equals the reference position.
//
// Two coordinate helpers:
//   sx(nx), sy(ny)   — map a reference-normalized point to viewport px using the fitted
//                      screen rect (faithful at 1.25:1).
//   anchored(spec)   — resolve an element rect with edge anchoring for responsiveness.

export class Screen {
  constructor(refAspect = 1.25) {
    this.refAspect = refAspect;
    this.resize();
  }

  resize(W = window.innerWidth, H = window.innerHeight) {
    this.W = W; this.H = H;
    this.aspect = W / H;
    // Fit a refAspect rect inside the viewport (contain).
    if (this.aspect > this.refAspect) {
      // viewport wider than design → full height, narrower design width, centered band
      this.rectH = H;
      this.rectW = H * this.refAspect;
    } else {
      this.rectW = W;
      this.rectH = W / this.refAspect;
    }
    this.rectX = (W - this.rectW) / 2;
    this.rectY = (H - this.rectH) / 2;
    // A unit used for radii/line widths so things scale with the screen, not the window.
    this.unit = this.rectW; // 1.0 ref-x == rectW px
    return this;
  }

  // faithful mapping (reference space → viewport px), used for the gate + things that
  // must stay locked to the reference composition.
  sx(nx) { return this.rectX + nx * this.rectW; }
  sy(ny) { return this.rectY + ny * this.rectH; }
  sr(nr) { return nr * this.rectW; } // radius / length in ref-x units

  // Anchored rect resolution for responsive panels. spec = {ref:[[x0,y0],[x1,y1]],
  // anchorX:'left'|'right'|'center', anchorY:'top'|'bottom'|'center'}.
  // On non-1.25 aspects, left-anchored elements hug the true viewport left, right-anchored
  // hug the true right, so the middle (gate) gets the slack instead of dead bands.
  anchored(spec) {
    const [[x0, y0], [x1, y1]] = spec.ref;
    // base (faithful) rect
    let X0 = this.sx(x0), X1 = this.sx(x1);
    const Y0 = this.sy(y0), Y1 = this.sy(y1);
    // horizontal re-anchor to real viewport edges when wider than design
    if (this.aspect > this.refAspect) {
      if (spec.anchorX === "left") {
        const off = this.rectX; // shift left to true edge
        X0 -= off; X1 -= off;
      } else if (spec.anchorX === "right") {
        const off = this.W - (this.rectX + this.rectW);
        X0 += off; X1 += off;
      }
    }
    return { x: X0, y: Y0, w: X1 - X0, h: Y1 - Y0 };
  }

  // gate placement: center point mapped faithfully, radius from ref but clamped so it
  // always fits the visible area on extreme aspects.
  gate(center, rOuter) {
    const cx = this.sx(center[0]);
    const cy = this.sy(center[1]);
    let R = this.sr(rOuter);
    // clamp so the gate never exceeds ~46% of the smaller viewport dim
    const maxR = Math.min(this.W, this.H) * 0.46;
    if (R > maxR) R = maxR;
    return { cx, cy, R };
  }
}
