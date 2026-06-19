// screen.js — responsive mapper. The design is 1491×1074 (the trace.json frame). The GATE stays
// dead-centre; everything else anchors to the nearest viewport edge, so extra space opens up in the
// gaps (between the side panels and the gate, above the header, below the footer) instead of
// stretching the art. At the design aspect (1491:1074) all anchors coincide → pixel-faithful.

export const DESIGN = { w: 1491, h: 1074, cx: 745.5, cy: 537 };
// gate region bounds (anything inside stays centred; outside anchors to its edge)
const GL = 428, GR = 1060, GT = 162, GB = 988;

export function makeScreen(vw, vh) {
  const s = Math.min(vw / DESIGN.w, vh / DESIGN.h);
  const W = DESIGN.w, H = DESIGN.h;
  // design x -> screen x, auto-anchored by region
  const x = (dx) => dx < GL ? dx * s : dx > GR ? vw - (W - dx) * s : vw / 2 + (dx - W / 2) * s;
  const y = (dy) => dy < GT ? dy * s : dy > GB ? vh - (H - dy) * s : vh / 2 + (dy - H / 2) * s;
  return {
    s, x, y, vw, vh,
    pt: (p) => [x(p[0]), y(p[1])],
    // gate sits at its mapped design centre (743,513 — slightly above geometric centre), radius scaled
    gate: (L) => ({ cx: x(L.gate.cx), cy: y(L.gate.cy), R: L.gate.R * s }),
  };
}
