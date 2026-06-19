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

  // binary-dot panels
  for (const z of (L.binaryDots || [])) {
    g.strokeStyle = L.style.layers.binaryDots; g.lineWidth = lw(1.5); const A = 12;
    const cn = (cx, cy, dx, dy) => { g.beginPath(); g.moveTo(X(cx + dx * A), Y(cy)); g.lineTo(X(cx), Y(cy)); g.lineTo(X(cx), Y(cy + dy * A)); g.stroke(); };
    const k = z.corners || [];
    if (k.includes("tl")) cn(z.x, z.y, 1, 1); if (k.includes("tr")) cn(z.x + z.w, z.y, -1, 1);
    if (k.includes("bl")) cn(z.x, z.y + z.h, 1, -1); if (k.includes("br")) cn(z.x + z.w, z.y + z.h, -1, -1);
    g.fillStyle = P.white; const cw = z.w / z.cols, ch = z.h / z.rows;
    for (let j = 0; j < z.rows; j++) for (let i = 0; i < z.cols; i++) if (((i * 7 + j * 13 + (z.seed || 0) * 5) % 5) < 2) { const d = 3 * sc; g.fillRect(X(z.x + i * cw + cw / 2) - d / 2, Y(z.y + j * ch + ch / 2) - d / 2, d, d); }
  }

  // timer arc
  const t = L.timer; g.strokeStyle = P.blue; g.lineWidth = lw(8); arc(t.cx, t.cy, t.r, -Math.PI * 0.16, Math.PI * 1.16); g.stroke();

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

  // checklist — panel + 7 rows; red bar for locked/dialing rows, "OK" beside locked
  const cl = L.checklist; g.fillStyle = P.panel; rect(cl.x, cl.y, cl.w, cl.h, 8); g.fill(); stroke(P.blue, 2);
  g.strokeStyle = P.blue; g.lineWidth = lw(1.5); line(cl.rightTabX, cl.y, cl.rightTabX, cl.y + cl.h);
  const live = st.phase === "dialing" || st.phase === "dialed" || st.phase === "active" || st.phase === "kawoosh";
  for (let i = 0; i < cl.rows; i++) {
    const cy = cl.bar0Y + i * cl.barStepY, litRow = i < lock, d = 16 * sc;
    g.strokeStyle = P.cyan; g.lineWidth = lw(1.5); g.strokeRect(X(cl.sqL) - d / 2, Y(cy) - d / 2, d, d); g.strokeRect(X(cl.sqR) - d / 2, Y(cy) - d / 2, d, d);
    if (litRow || live) { g.fillStyle = P.red; g.shadowColor = "rgba(255,45,54,.8)"; g.shadowBlur = 5 * sc; const x0 = X(cl.barL); rrS(x0, Y(cy) - 8 * sc, X(cl.barR) - x0, 16 * sc, 7 * sc); g.fill(); g.shadowBlur = 0; }
    text(String(i + 1), cl.numX, cy - 8, 14, P.cyan);
    if (litRow) text("OK", cl.numX + 16, cy - 8, 13, P.white);
  }

  // footer — readout (countdown when active) + segmented auth cells
  const ft = L.footer; rect(ft.readout.x, ft.readout.y, ft.readout.w, ft.readout.h, 8); stroke(P.blue, 2);
  if (st.countdown) text(st.countdown, ft.readout.x + 24, ft.readout.y + ft.readout.h / 2 - 18, 40, st.countdown.startsWith("00:") ? P.red : P.cyan);
  { const a = ft.auth, digits = a.text.replace("-", ""); let di = 0; g.strokeStyle = P.blue; g.lineWidth = lw(1.5);
    const grp = (gx, cnt) => { for (let i = 0; i < cnt; i++) { const cx = gx + i * a.cellW, x0 = X(cx); g.strokeRect(x0, Y(a.cellTop), X(cx + a.cellW) - x0, Y(a.cellTop + a.cellH) - Y(a.cellTop)); text(digits[di++] || "", cx + a.cellW / 2 - a.size * 0.28, a.digitTop, a.size, P.white); } };
    grp(a.g1x, a.g1n); grp(a.g2x, a.g2n); text("-", a.dashX, a.digitTop, a.size, P.white); }

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

  // chevron red-V lock indicators
  for (const ang of engaged) {
    const tp = L.gate.tips[ang]; if (!tp) continue;
    const a = ang * Math.PI / 180, ux = Math.cos(a), uy = -Math.sin(a), px = -uy, py = ux, S2 = sc;
    g.strokeStyle = P.red; g.lineWidth = lw(3); g.shadowColor = P.red; g.shadowBlur = 6 * sc;
    g.beginPath();
    g.moveTo(X(tp[0] - px * 15 - ux * 11), Y(tp[1] - py * 15 - uy * 11));
    g.lineTo(X(tp[0] + ux * 7), Y(tp[1] + uy * 7));
    g.lineTo(X(tp[0] + px * 15 - ux * 11), Y(tp[1] + py * 15 - uy * 11));
    g.stroke(); g.shadowBlur = 0; void S2;
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

  // manual-entry readout: the address being typed (seq committed + current buffer)
  if (st.phase === "entry") {
    const seqStr = (st.seq || []).map((i) => i + 1).join(" "), cur = st.buf ? ` [${st.buf}]` : " [_]";
    text("ADDR: " + seqStr + cur, L.footer.readout.x + 20, L.footer.readout.y + L.footer.readout.h / 2 - 12, 26, P.cyan);
  }

  // texts — clock/date/day/status are live
  for (const tt of (L.texts || [])) {
    let s = tt.t;
    if (tt.id === "clock") s = st.clockHHMM || s; else if (tt.id === "date") s = st.date || s;
    else if (tt.id === "day") s = st.day || s; else if (tt.id === "status") s = st.status || s;
    text(s, tt.x, tt.y, tt.size || 14, P.cyan);
  }
}
