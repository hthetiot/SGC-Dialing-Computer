// hud.js — the HUD layers drawn to one 2D canvas, from layout.json (the trace.json design).
// Every coordinate routes through the responsive mapper M (screen.js): the gate stays centred and
// side/top/bottom elements anchor to the viewport edges. The gate disc itself is the SVG (gate.js);
// this canvas draws the frame, panels, boxes, the circuit network, chevron red-V locks, and text.
//
// st = { clockHHMM, date, day, status, lockedCount (0..7), phase, countdown|null }

import { LOCK_ORDER, GLYPHS, ADDRESSES } from "./addresses.js";
import { getGlyph } from "./gate.js";

// DESTINATION value (line 2): WAITING when idle; for an INCOMING wormhole show the detected glyph
// NUMBERS; for OUTGOING show the known gate NAME, or "404 UNKNOWN ADDRESS" if it matches none.
function destinationText(st) {
  if (st.rawPhase === "idle" || st.rawPhase === "aborting") return "WAITING";
  const a = st.address || [];
  if (st.mode === "incoming") return a.map((i) => i + 1).join(" ");
  for (const name in ADDRESSES) { const ad = ADDRESSES[name]; if (ad.length === a.length && ad.every((v, k) => v === a[k])) return name.toUpperCase(); }
  return "404 UNKNOWN ADDRESS";
}

// the 3 header transport buttons (◀◀ reset/step-back · play/pause · ▶▶ skip/step) — exported so
// main.js can hit-test the same rects it sees drawn. Design-space rects (mapped through M).
export function transportRects(L) {
  const h = L.header, x = h.transportX ?? 200, y = (h.transportY ?? 116) - 6, w = 30, ht = 28, gap = 40;
  return [{ id: "back", x, y, w, h: ht }, { id: "play", x: x + gap, y, w, h: ht }, { id: "fwd", x: x + 2 * gap, y, w, h: ht }];
}

// rolling history for the sidebar telemetry mini-charts (persists across frames)
const HIST = { fps: [], render: [], spd: [], dps: [], hud: [], gate: [] };

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

export function drawHud(g, M, L, st, metrics = {}) {
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
  // rounded-corner polyline — the real circuit rails are rounded rectangles (per the mask/target)
  const polyRound = (pts, r) => {
    if (!pts || pts.length < 3) return polyD(pts);
    g.beginPath(); g.moveTo(X(pts[0][0]), Y(pts[0][1]));
    for (let i = 1; i < pts.length - 1; i++) g.arcTo(X(pts[i][0]), Y(pts[i][1]), X(pts[i + 1][0]), Y(pts[i + 1][1]), r * sc);
    g.lineTo(X(pts[pts.length - 1][0]), Y(pts[pts.length - 1][1])); g.stroke();
  };
  const arc = (dx, dy, r, a0, a1) => { g.beginPath(); g.arc(X(dx), Y(dy), r * sc, a0 ?? 0, a1 ?? 7); };
  const text = (t, dx, dy, size, col) => { g.font = `${(size || 14) * sc}px "DejaVu Sans Mono","Consolas",monospace`; g.fillStyle = col || P.cyan; g.fillText(t, X(dx), Y(dy)); };
  const stroke = (col, w) => { g.strokeStyle = col; g.lineWidth = lw(w); g.stroke(); };

  // frame (fills the viewport via anchored corners)
  const f = L.frame; g.shadowColor = P.glow; g.shadowBlur = 8 * sc; rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0, f.r); stroke(P.blue, 3); g.shadowBlur = 0;
  // rail divider
  g.strokeStyle = P.blue; g.lineWidth = lw(2); line(L.rail.x, 156, L.rail.x, f.y1 - 20);   // start below the header (y150) so it doesn't collide
  // logo bay
  rect(L.logoBay.x, L.logoBay.y, L.logoBay.w, L.logoBay.h, 8); stroke(P.blue, 2);
  // header panel + functional transport buttons (◀◀ reset/back · play/pause · ▶▶ skip/step)
  const hd = L.header; rect(hd.panelX0, hd.panelY0, hd.panelX1 - hd.panelX0, hd.panelY1 - hd.panelY0, 10); stroke(P.blue, 2);
  for (const b of transportRects(L)) {
    rect(b.x, b.y, b.w, b.h, 5); stroke(P.blue, 1.5);
    g.fillStyle = P.cyan; const cx = X(b.x + b.w / 2), cy = Y(b.y + b.h / 2), s2 = 5 * sc;
    const tri = (px, dir) => { g.beginPath(); g.moveTo(px - dir * s2, cy - s2); g.lineTo(px + dir * s2, cy); g.lineTo(px - dir * s2, cy + s2); g.closePath(); g.fill(); };
    if (b.id === "play") {
      if (metrics.paused) tri(cx, 1);                                            // ▶ centred
      else { g.fillRect(cx - s2 * 0.85, cy - s2, s2 * 0.55, s2 * 2); g.fillRect(cx + s2 * 0.3, cy - s2, s2 * 0.55, s2 * 2); }  // ▌▌ centred
    } else if (b.id === "back") { tri(cx - s2 * 0.6, -1); tri(cx + s2 * 0.6, -1); }  // ◀◀ centred
    else { tri(cx - s2 * 0.6, 1); tri(cx + s2 * 0.6, 1); }                          // ▶▶ centred
  }

  // binary-dot panels — a sparse white/blue field of data dots with a bright cyan scan band that
  // sweeps along the zone's long axis (the "loading"/data-stream look from the source captures).
  for (const z of (L.binaryDots || [])) {
    M.setY(z.y > 537 ? "bot" : "auto");   // footer dot zones pin to the bottom WITH the footer (same height/position)
    g.strokeStyle = L.style.layers.binaryDots; g.lineWidth = lw(1.5); const A = 12;
    const cn = (cx, cy, dx, dy) => { g.beginPath(); g.moveTo(X(cx + dx * A), Y(cy)); g.lineTo(X(cx), Y(cy)); g.lineTo(X(cx), Y(cy + dy * A)); g.stroke(); };
    const k = z.corners || [];
    if (k.includes("tl")) cn(z.x, z.y, 1, 1); if (k.includes("tr")) cn(z.x + z.w, z.y, -1, 1);
    if (k.includes("bl")) cn(z.x, z.y + z.h, 1, -1); if (k.includes("br")) cn(z.x + z.w, z.y + z.h, -1, -1);
    const cw = z.w / z.cols, ch = z.h / z.rows, seed = z.seed || 0;
    const horiz = z.cols >= z.rows, span = horiz ? z.cols : z.rows;
    const sweep = ((st.t || 0) / 32) % (span + 8) - 4;       // scan position along the long axis
    const dense = z.cols <= 2;                                // narrow columns read as a near-full stack
    for (let j = 0; j < z.rows; j++) for (let i = 0; i < z.cols; i++) {
      if (((i * 5 + j * 11 + seed * 3) % (dense ? 5 : 9)) >= (dense ? 4 : 2)) continue;
      const near = Math.abs((horiz ? i : j) - sweep) < 1.2;
      const blue = ((i * 3 + j * 7 + seed) % 5) === 0;
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
  // remainingTime counter bar sitting BEHIND the date (depletes with the 38-min gauge)
  { const bw = 132, bh = 24, bx0 = t.cx - bw / 2, x0 = X(bx0), yb = Y(t.dateY - 3);
    g.fillStyle = "rgba(50,110,200,.16)"; rrS(x0, yb, X(bx0 + bw) - x0, bh * sc, 4 * sc); g.fill();
    g.fillStyle = low ? "rgba(255,70,64,.34)" : "rgba(40,140,235,.34)"; rrS(x0, yb, (X(bx0 + bw) - x0) * frac, bh * sc, 4 * sc); g.fill(); }
  g.textAlign = "center";
  text(st.clockHMS || st.clockHHMM, t.cx, t.clockY, 27, P.cyan); text(st.date, t.cx, t.dateY, 24, P.cyan); text(st.day, t.cx, t.dayY, 26, P.cyan);
  g.textAlign = "left";

  // live telemetry — 6 metrics, each a label + value + a rolling history mini-chart (replaces the
  // old static numbers grid). Laid out in the same 2×3 grid anchors from layout.json.
  const n = L.numbers, m = metrics || {};
  const dps = (m.gateSpeed || 0) * (m.fps || 0);   // live rotation speed (deg/sec) — reads during idle/active spin too
  const ROWS = [
    ["fps", "FPS", `fps ${(m.fps | 0)}`], ["render", "RENDER ms", `${(m.renderMs || 0).toFixed(1)}`],
    ["spd", "GATE °/f", `${(m.gateSpeed || 0).toFixed(2)}°`], ["dps", "GATE °/s", `${Math.round(dps)}°`],
    ["hud", "HUD ms", `${(m.hudMs || 0).toFixed(2)}`], ["gate", "GATE ms", `${(m.gateMs || 0).toFixed(2)}`],
  ];
  const sparkHist = (h, sx, sy, sw, ht) => {
    if (!h || h.length < 2) return; const mn = Math.min(...h), mx = Math.max(...h), rng = (mx - mn) || 1;
    g.strokeStyle = P.text; g.lineWidth = lw(1.2); g.beginPath();
    h.forEach((v, k) => { const px = X(sx + (k / (h.length - 1)) * sw), py = Y(sy - ((v - mn) / rng) * ht); k ? g.lineTo(px, py) : g.moveTo(px, py); });
    g.stroke();
  };
  for (let i = 0; i < 6; i++) {
    const col = i % 2, row = (i / 2) | 0, x = n.x0 + col * n.colGap, y = n.y0 + row * n.rowGap;
    const [key, label, val] = ROWS[i], raw = [m.fps, m.renderMs, m.gateSpeed, dps, m.hudMs, m.gateMs][i] || 0;
    const buf = HIST[key]; buf.push(raw); if (buf.length > 30) buf.shift();
    text(label, x, y - 13, 10, "rgba(150,190,255,.65)");
    text(val, x, y, 17, P.white);
    sparkHist(buf, n.sparkX + col * n.sparkColGap, y + n.sparkDown, n.sparkW, 13);
    g.strokeStyle = "rgba(120,160,230,.35)"; g.lineWidth = lw(1); line(n.sparkX + col * n.sparkColGap, y + n.sparkDown + 3, n.sparkX + col * n.sparkColGap + n.sparkW, y + n.sparkDown + 3);
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
  // auth block — ONE fixed unit below the footer, centred on the console mid-line: the LABEL sits to
  // the LEFT of the code cells and USER/SYS stack to the RIGHT (flanking the number, like the target).
  // A force-centred X map (cxs) keeps the whole block scaling as a unit so it never stretches.
  { const a = ft.auth, cx = 745.5, cw = a.cellW, n1 = a.g1n, n2 = a.g2n, digits = a.text.replace("-", "");
    const totalW = (n1 + n2 + 1) * cw, startX = cx - totalW / 2, cyB = 1016, chB = 28, midY = cyB + chB / 2;
    const cxs = (dx) => M.vw / 2 + (dx - cx + 22) * sc;   // +22: shift the block right so the LABEL clears the sidebar rail
    const ctext = (s, dx, dy, size, col, al, base) => { g.textAlign = al || "left"; g.textBaseline = base || "top"; g.font = `${size * sc}px "DejaVu Sans Mono","Consolas",monospace`; g.fillStyle = col; g.fillText(s, cxs(dx), Y(dy)); };
    g.strokeStyle = P.blue; g.lineWidth = lw(1.5);
    let di = 0;
    for (let i = 0; i < n1 + n2; i++) {                       // centred code cells
      const slot = i < n1 ? i : i + 1, cxx = startX + slot * cw, x0 = cxs(cxx);
      rrS(x0, Y(cyB), cxs(cxx + cw) - x0, chB * sc, 3 * sc); g.stroke();
      ctext(digits[di++] || "", cxx + cw / 2, midY, 19, P.white, "center", "middle");
    }
    ctext("-", startX + (n1 + 0.5) * cw, midY, 19, P.cyan, "center", "middle");
    ctext("AUTHORIZATION CODE:", startX - 16, midY, 15, "rgba(150,190,255,.85)", "right", "middle");   // LEFT of cells
    ctext("USER: SGT. W HARRIMAN", startX + totalW + 16, cyB + 9, 13, P.cyan, "left", "middle");        // RIGHT of cells
    ctext("SYS: NOMINAL", startX + totalW + 16, cyB + 24, 13, P.cyan, "left", "middle");
    g.textAlign = "left"; g.textBaseline = "top"; }
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
    if (rt.pts) polyRound(rt.pts, 16); g.shadowBlur = 0;
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
  const SKIP = new Set(["clock", "date", "day", "authLabel", "user", "sys"]);   // drawn in the gauge / auth block
  const FOOTER = new Set(["lst1", "lst2"]);                                      // footer labels share ONE anchor → same row
  for (const tt of (L.texts || [])) {
    if (SKIP.has(tt.id)) continue;
    M.setY(FOOTER.has(tt.id) ? "bot" : tt.x < 428 ? (tt.y < 537 ? "top" : "bot") : "auto");   // 428 = left column (GL); 537 = design cy
    // LST codes sit above the footer's two corners — anchor each to its corner so they track the
    // (left/right-anchored) readout box instead of drifting on non-design aspects.
    if (tt.id === "lst1") { g.textAlign = "left"; text(tt.t, L.footer.readout.x, tt.y, tt.size || 14, P.cyan); continue; }
    if (tt.id === "lst2") { g.textAlign = "right"; text(tt.t, L.footer.readout.x + L.footer.readout.w, tt.y, tt.size || 14, P.cyan); g.textAlign = "left"; continue; }
    if (tt.id === "destination") {   // two lines like STATUS: label (cyan) + value (white); sits just after the header binary dots, inside the header
      text("DESTINATION:", tt.x, tt.y - 10, 18, P.cyan);
      text(destinationText(st), tt.x, tt.y + 12, 16, P.white);
      continue;
    }
    if (tt.id === "status") {   // two lines: "STATUS:" then the phase description, so long values don't overlap
      const val = (st.status || tt.t).replace(/^STATUS:\s*/, ""), sz = 15;
      text("STATUS:", tt.x, tt.y - 9, sz, P.cyan);
      text(val, tt.x, tt.y + 10, sz, P.white);
      continue;
    }
    text(tt.t, tt.x, tt.y, tt.size || 14, P.cyan);
  }
  M.setY("auto");
}
