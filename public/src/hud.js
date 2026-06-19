// hud.js — the HUD layers drawn to one 2D canvas, from layout.json (the trace.json design).
// Every coordinate routes through the responsive mapper M (screen.js): the gate stays centred and
// side/top/bottom elements anchor to the viewport edges. The gate disc itself is the SVG (gate.js);
// this canvas draws the frame, panels, boxes, the circuit network, chevron red-V locks, and text.
//
// st = { clockHHMM, date, day, status, lockedCount (0..7), phase, countdown|null }

import { LOCK_ORDER, GLYPHS } from "./addresses.js";
import { getGlyph } from "./gate.js";

// draw a gate-svg glyph (Path2D in svg units) centred at design (cxD,cyD), fitted to sizeD design px
function drawGlyph(g, M, name, cxD, cyD, sizeD, col, strokePx) {
  const gl = getGlyph(name); if (!gl) return;
  const total = (sizeD / Math.max(gl.w, gl.h)) * M.s;
  g.save();
  g.translate(M.x(cxD), M.y(cyD)); g.scale(total, total);
  g.translate(-(gl.x + gl.w / 2), -(gl.y + gl.h / 2));
  g.fillStyle = col; g.strokeStyle = col; g.lineJoin = "round"; g.lineCap = "round";
  g.lineWidth = (strokePx || 2) / total;
  g.stroke(gl.path); g.fill(gl.path);
  g.restore();
}

export function drawHud(g, M, L, st) {
  const S = L.style.schema;
  const P = { bg: S.bg, blue: S.line, cyan: S.text, white: S.white, dim: S.dim, red: S.red, glow: S.glow, panel: S.panel };
  const X = M.x, Y = M.y, sc = M.s, lock = st.lockedCount || 0;
  const engaged = new Set(LOCK_ORDER.slice(0, lock));

  g.textBaseline = "top"; g.textAlign = "left"; g.lineJoin = "round";
  const lw = (w) => Math.max(1, (w || 2) * sc);
  const rrS = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const rect = (dx, dy, dw, dh, dr) => { const x0 = X(dx), y0 = Y(dy); rrS(x0, y0, X(dx + dw) - x0, Y(dy + dh) - y0, (dr || 0) * sc); };
  const line = (a, b, c, d) => { g.beginPath(); g.moveTo(X(a), Y(b)); g.lineTo(X(c), Y(d)); g.stroke(); };
  const polyD = (pts) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); g.stroke(); };
  const arc = (dx, dy, r, a0, a1) => { g.beginPath(); g.arc(X(dx), Y(dy), r * sc, a0 ?? 0, a1 ?? 7); };
  const text = (t, dx, dy, size, col) => { g.font = `${(size || 14) * sc}px "DejaVu Sans Mono","Consolas",monospace`; g.fillStyle = col || P.cyan; g.fillText(t, X(dx), Y(dy)); };
  const stroke = (col, w) => { g.strokeStyle = col; g.lineWidth = lw(w); g.stroke(); };

  // frame (fills the viewport via anchored corners)
  const f = L.frame; g.shadowColor = P.glow; g.shadowBlur = 8 * sc; rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0, f.r); stroke(P.blue, 3); g.shadowBlur = 0;
  // rail divider
  g.strokeStyle = P.blue; g.lineWidth = lw(2); line(L.rail.x, 135, L.rail.x, f.y1 - 20);
  // logo bay
  rect(L.logoBay.x, L.logoBay.y, L.logoBay.w, L.logoBay.h, 8); stroke(P.blue, 2);
  // header panel + transport
  const hd = L.header; rect(hd.panelX0, hd.panelY0, hd.panelX1 - hd.panelX0, hd.panelY1 - hd.panelY0, 10); stroke(P.blue, 2);
  text(hd.transport, hd.transportX, hd.transportY, 16, P.cyan);

  // binary-dot panels — a sparse white/blue field of data dots with a bright cyan scan band that
  // sweeps along the zone's long axis (the "loading"/data-stream look from the source captures).
  for (const z of (L.binaryDots || [])) {
    g.strokeStyle = L.style.layers.binaryDots; g.lineWidth = lw(1.5); const A = 12;
    const cn = (cx, cy, dx, dy) => { g.beginPath(); g.moveTo(X(cx + dx * A), Y(cy)); g.lineTo(X(cx), Y(cy)); g.lineTo(X(cx), Y(cy + dy * A)); g.stroke(); };
    const k = z.corners || [];
    if (k.includes("tl")) cn(z.x, z.y, 1, 1); if (k.includes("tr")) cn(z.x + z.w, z.y, -1, 1);
    if (k.includes("bl")) cn(z.x, z.y + z.h, 1, -1); if (k.includes("br")) cn(z.x + z.w, z.y + z.h, -1, -1);
    const cw = z.w / z.cols, ch = z.h / z.rows, seed = z.seed || 0;
    const horiz = z.cols >= z.rows, span = horiz ? z.cols : z.rows;
    const sweep = ((st.t || 0) / 32) % (span + 8) - 4;       // scan position along the long axis
    for (let j = 0; j < z.rows; j++) for (let i = 0; i < z.cols; i++) {
      if (((i * 7 + j * 13 + seed * 5) % 7) >= 2) continue;  // sparse static field (~28% lit)
      const near = Math.abs((horiz ? i : j) - sweep) < 1.2;
      const blue = ((i * 3 + j * 5 + seed) % 5) === 0;
      g.fillStyle = near ? "#e2f2ff" : blue ? P.blue : "rgba(205,225,255,.5)";
      const d = (near ? 4 : 3) * sc;
      g.fillRect(X(z.x + i * cw + cw / 2) - d / 2, Y(z.y + j * ch + ch / 2) - d / 2, d, d);
    }
  }

  // numbers/timer panel — pinned top-left (below header+logo), fixed height
  M.setY("top");
  // timer arc — a 38-min countdown GAUGE: full ring is the dim track, the blue fill = fraction of
  // time remaining (depletes to zero), turning red in the final minute. clock/date/day sit inside.
  const t = L.timer, a0 = -Math.PI * 0.16, a1 = Math.PI * 1.16, frac = st.timerFrac ?? 1;
  const low = !!(st.countdown && st.countdown.startsWith("00:"));
  g.strokeStyle = "rgba(70,120,210,.22)"; g.lineWidth = lw(8); arc(t.cx, t.cy, t.r, a0, a1); g.stroke();
  if (frac > 0.001) { g.strokeStyle = low ? P.red : P.blue; g.lineWidth = lw(8); if (low) { g.shadowColor = P.red; g.shadowBlur = 8 * sc; } arc(t.cx, t.cy, t.r, a0, a0 + frac * (a1 - a0)); g.stroke(); g.shadowBlur = 0; }
  g.textAlign = "center";
  text(st.clockHHMM, t.cx, t.clockY, 33, P.cyan); text(st.date, t.cx, t.dateY, 24, P.cyan); text(st.day, t.cx, t.dayY, 26, P.cyan);
  g.textAlign = "left";

  // numbers grid + sparklines (wavy line + baseline)
  const n = L.numbers;
  for (let r = 0; r < n.rows; r++) for (let cc = 0; cc < n.cols; cc++) {
    const x = n.x0 + cc * n.colGap, y = n.y0 + r * n.rowGap;
    text(String(n.values[r][cc]), x, y, n.size || 22, P.white);
    const sx = n.sparkX + cc * n.sparkColGap, sy = y + n.sparkDown, sw = n.sparkW, seed = r * 3 + cc;
    g.strokeStyle = P.text; g.lineWidth = lw(1.2); g.beginPath(); g.moveTo(X(sx), Y(sy));
    for (let m = 1; m <= 12; m++) { const tt = seed + m * 5, b = tt % 9 < 2 ? -5 : tt % 5 < 2 ? -2 : 0; g.lineTo(X(sx + m * sw / 12), Y(sy + b)); }
    g.stroke(); g.beginPath(); g.moveTo(X(sx), Y(sy + n.sparkBase)); g.lineTo(X(sx + sw), Y(sy + n.sparkBase)); g.stroke();
  }
  M.setY("auto");

  // checklist — pinned bottom-left, fixed height; 7 rows, red bar for locked/dialing rows, "OK" beside locked
  M.setY("bot");
  const cl = L.checklist; g.fillStyle = P.panel; rect(cl.x, cl.y, cl.w, cl.h, 8); g.fill(); stroke(P.blue, 2);
  g.strokeStyle = P.blue; g.lineWidth = lw(1.5); line(cl.rightTabX, cl.y, cl.rightTabX, cl.y + cl.h);
  const live = st.phase === "dialing" || st.phase === "dialed" || st.phase === "active" || st.phase === "kawoosh";
  for (let i = 0; i < cl.rows; i++) {
    const cy = cl.bar0Y + i * cl.barStepY, litRow = i < lock, d = 16 * sc;
    g.strokeStyle = P.cyan; g.lineWidth = lw(1.5); g.strokeRect(X(cl.sqL) - d / 2, Y(cy) - d / 2, d, d); g.strokeRect(X(cl.sqR) - d / 2, Y(cy) - d / 2, d, d);
    if (litRow || live) { g.fillStyle = P.red; g.shadowColor = "rgba(255,45,54,.8)"; g.shadowBlur = 5 * sc; const x0 = X(cl.barL); rrS(x0, Y(cy) - 8 * sc, X(cl.barR) - x0, 16 * sc, 7 * sc); g.fill(); g.shadowBlur = 0; }
    text(String(i + 1), cl.numX, cy - 8, 14, P.cyan);
    if (litRow) text("OK", cl.sqR + 14, cy - 8, 13, P.white);   // in the right-tab gap, clear of the box
  }

  // footer — readout: 38-min countdown when active, else the live dial clock (sec.ms) while dialing.
  // Numbers are vertically centred in the box (baseline middle), restored to "top" afterwards.
  const ft = L.footer; rect(ft.readout.x, ft.readout.y, ft.readout.w, ft.readout.h, 8); stroke(P.blue, 2);
  const ry = ft.readout.y + ft.readout.h / 2;
  g.textBaseline = "middle";
  if (st.countdown) text(st.countdown, ft.readout.x + 30, ry, 44, st.countdown.startsWith("00:") ? P.red : P.cyan);
  else if (st.dialClock) text(st.dialClock, ft.readout.x + 30, ry, 44, P.cyan);
  g.textBaseline = "top";
  { const a = ft.auth, digits = a.text.replace("-", ""); let di = 0; g.strokeStyle = P.blue; g.lineWidth = lw(1.5);
    const grp = (gx, cnt) => { for (let i = 0; i < cnt; i++) { const cx = gx + i * a.cellW, x0 = X(cx); g.strokeRect(x0, Y(a.cellTop), X(cx + a.cellW) - x0, Y(a.cellTop + a.cellH) - Y(a.cellTop)); text(digits[di++] || "", cx + a.cellW / 2 - a.size * 0.28, a.digitTop, a.size, P.white); } };
    grp(a.g1x, a.g1n); grp(a.g2x, a.g2n); text("-", a.dashX, a.digitTop, a.size, P.white); }
  M.setY("auto");   // end of bottom-pinned panels; boxes/circuits/gate use the centred band

  // boxes — outline + bold number; the locked constellation glyph fills the box (active refs)
  const bx = L.boxes, addr = st.address || [];
  for (let i = 0; i < bx.count; i++) {
    const y = bx.top0 + i * bx.stepY; rect(bx.left, y, bx.right - bx.left, bx.h, 10); stroke(i < lock ? P.red : P.blue, 2);
    text(String(i + 1), bx.left + bx.numDX, y + bx.numDY, bx.numSize || 24, P.white);
    if (i < lock && addr[i] != null) drawGlyph(g, M, GLYPHS[addr[i]], (bx.left + bx.right) / 2, y + bx.h / 2, bx.h * 0.62, P.white, 2);
  }

  // circuit — measured polylines; reddens once its chevron has engaged
  L.circuit.forEach((rt) => {
    const on = engaged.has(rt.chev); g.strokeStyle = on ? P.red : "rgba(90,150,255,.9)"; g.lineWidth = lw(2.2);
    if (on) { g.shadowColor = "rgba(255,45,54,.7)"; g.shadowBlur = 5 * sc; }
    if (rt.pts) polyD(rt.pts); g.shadowBlur = 0;
  });

  // red anchor node — where each engaged circuit plugs into its (now-red) chevron, like the video
  for (const ang of engaged) {
    const tp = L.gate.tips[ang]; if (!tp) continue;
    g.fillStyle = P.red; g.shadowColor = P.red; g.shadowBlur = 7 * sc;
    g.beginPath(); g.arc(X(tp[0]), Y(tp[1]), lw(4.5), 0, 7); g.fill();
    g.fillStyle = "#ffd0cd"; g.beginPath(); g.arc(X(tp[0]), Y(tp[1]), lw(1.6), 0, 7); g.fill();   // hot centre
    g.shadowBlur = 0;
  }

  // gate-centre effects — event-horizon shimmer (active), kawoosh splash, hero glyph (dialing)
  const G = L.gate, scx = X(G.cx), scy = Y(G.cy), sR = G.R * sc;
  if (st.eh > 0) {
    g.save(); g.beginPath(); g.arc(scx, scy, sR * 0.62, 0, 7); g.clip();
    const a = (0.16 + 0.12 * (st.pulse ?? 0.5)) * st.eh, grd = g.createRadialGradient(scx, scy, 0, scx, scy, sR * 0.62);
    grd.addColorStop(0, `rgba(130,195,255,${a})`); grd.addColorStop(0.7, `rgba(40,95,205,${a * 0.7})`); grd.addColorStop(1, "rgba(20,40,90,0)");
    g.fillStyle = grd; g.fillRect(scx - sR, scy - sR, sR * 2, sR * 2);
    g.strokeStyle = `rgba(150,200,255,${0.22 * st.eh})`; g.lineWidth = lw(1.4);
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(scx, scy, sR * (0.28 + 0.32 * k + 0.08 * (st.pulse ?? 0.5)), 0, 7); g.stroke(); }
    g.restore();
  }
  if (st.kawoosh > 0) {
    const r = sR * (0.2 + 0.62 * st.kawoosh);
    g.fillStyle = `rgba(190,225,255,${0.55 * (1 - st.kawoosh)})`; g.beginPath(); g.arc(scx, scy, r, 0, 7); g.fill();
    g.strokeStyle = `rgba(220,240,255,${0.9 * (1 - st.kawoosh)})`; g.lineWidth = lw(4); g.beginPath(); g.arc(scx, scy, r, 0, 7); g.stroke();
  }
  if (st.heroIdx >= 0) {
    g.shadowColor = "rgba(120,190,255,.9)"; g.shadowBlur = 16 * sc;
    drawGlyph(g, M, GLYPHS[st.heroIdx], G.cx, G.cy, G.R * 1.05, P.white, 7);
    g.shadowBlur = 0;
  }

  // manual-entry readout: the address being typed (seq committed + current buffer) — in the footer box
  if (st.phase === "entry") {
    M.setY("bot");
    const seqStr = (st.seq || []).map((i) => i + 1).join(" "), cur = st.buf ? ` [${st.buf}]` : " [_]";
    text("ADDR: " + seqStr + cur, L.footer.readout.x + 20, L.footer.readout.y + L.footer.readout.h / 2 - 12, 26, P.cyan);
    M.setY("auto");
  }

  // texts — clock/date/day/status are live. Left-column labels pin to their panel's edge (top/bottom)
  // so they travel with the numbers/checklist panels; everything else uses the centred band.
  for (const tt of (L.texts || [])) {
    if (tt.id === "clock" || tt.id === "date" || tt.id === "day") continue;   // drawn centred in the timer gauge
    const s = tt.id === "status" ? (st.status || tt.t) : tt.t;
    M.setY(tt.x < 428 ? (tt.y < 537 ? "top" : "bot") : "auto");   // 428 = left column (GL); 537 = design cy
    text(s, tt.x, tt.y, tt.size || 14, P.cyan);
  }
  M.setY("auto");
}
