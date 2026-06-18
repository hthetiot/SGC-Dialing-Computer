// hud.js — the six toggleable HUD layers, drawn to one 2D canvas above the gate.
//   header · binary · checklist · footer · boxes · circuit  (each owns its own text)
// Authored to match the canonical SGC cyan/blue frame capture. All geometry comes from
// layout.json via the Screen mapper, so it stays anchored on any aspect.

const TAU = Math.PI * 2;

export class Hud {
  constructor(layout, dialer) {
    this.L = layout;
    this.P = layout.palette;
    this.dialer = dialer;
    this.t = 0;
    this.layers = { header: true, binary: true, checklist: true, footer: true, boxes: true, circuit: true };
    // binary panel grid (cols x rows of bits), scrolled over time
    this.binCols = 30; this.binRows = 3;
    this.bits = Array.from({ length: this.binRows }, () => this._randRow());
    this._binAcc = 0;
    // static-ish sparkline samples per number cell
    this.spark = Array.from({ length: 6 }, (_, i) => this._sparkData(i));
  }

  _randRow() { return Array.from({ length: this.binCols }, () => (Math.random() < 0.32 ? 1 : 0)); }
  _sparkData(seed) {
    const n = 22, a = [];
    let v = 0.5;
    for (let i = 0; i < n; i++) { v += (Math.sin(i * 0.9 + seed * 2.1) * 0.18) + (((i * 7 + seed * 13) % 5) - 2) * 0.04; a.push(Math.max(0.1, Math.min(0.9, v))); }
    return a;
  }

  update(dt) {
    this.t += dt;
    this._binAcc += dt;
    if (this._binAcc > 140) { this._binAcc = 0; this.bits.push(this._randRow()); this.bits.shift(); }
  }

  draw(ctx, screen) {
    this.s = screen; this.ctx = ctx;
    this._outerFrame();
    if (this.layers.circuit) this._circuit();
    if (this.layers.header) this._header();
    if (this.layers.binary) this._binary();
    if (this.layers.checklist) this._left();
    if (this.layers.boxes) this._boxes();
    if (this.layers.footer) this._footer();
    this._crosshair();
  }

  // ---- primitives ---------------------------------------------------------
  _stroke(color, w) { const c = this.ctx; c.strokeStyle = color; c.lineWidth = this.s.us(w); }
  _rrect(x, y, w, h, r) {
    const c = this.ctx; r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  _frame(rect, color = this.P.blue, w = 2, r = 8) {
    this._rrect(rect.x, rect.y, rect.w, rect.h, this.s.us(r));
    this._stroke(color, w); this.ctx.stroke();
  }
  _text(str, x, y, { size = 16, color = this.P.white, weight = 400, align = "left", base = "alphabetic", spacing = 0, family } = {}) {
    const c = this.ctx;
    c.font = this.s.font(size, family ? { weight, family } : { weight });
    c.fillStyle = color; c.textAlign = spacing ? "left" : align; c.textBaseline = base;
    if (!spacing) { c.fillText(str, x, y); return; }
    // letter-spaced (for the tracked-out caps the SGC UI uses)
    const ls = this.s.us(spacing);
    let total = 0; for (const ch of str) total += c.measureText(ch).width + ls;
    total -= ls;
    let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
    for (const ch of str) { c.fillText(ch, cx, y); cx += c.measureText(ch).width + ls; }
  }

  // ---- outer frame --------------------------------------------------------
  // The big rounded border that encloses the whole console, with the logo bay notched into
  // the top-left corner via a short diagonal (the signature SGC chamfer).
  _outerFrame() {
    const s = this.s, c = this.ctx;
    const x0 = s.px(0.016), y0 = s.py(0.016), x1 = s.px(0.987), y1 = s.py(0.967);
    const r = s.us(16);
    const L = s.rect(this.L.header.logoBay);
    const notchX = L.x + L.w, notchY = L.y;            // logo bay top-right
    c.beginPath();
    c.moveTo(notchX, y0);                                // top edge starts right of the bay
    c.lineTo(x1 - r, y0);
    c.arcTo(x1, y0, x1, y0 + r, r);                      // top-right
    c.lineTo(x1, y1 - r);
    c.arcTo(x1, y1, x1 - r, y1, r);                      // bottom-right
    c.lineTo(x0 + r, y1);
    c.arcTo(x0, y1, x0, y1 - r, r);                      // bottom-left
    c.lineTo(x0, notchY + L.h);                          // up to bay bottom
    c.lineTo(notchX, notchY);                            // diagonal chamfer to bay top-right
    this._stroke(this.P.blue, 2); c.stroke();
    // the logo bay box itself
    this._frame(L, this.P.blue, 2, 8);
  }

  // ---- header -------------------------------------------------------------
  _header() {
    const s = this.s, H = this.L.header;
    // inner rail enclosure (frames the gate + boxes region), nested inside the outer frame
    const rail = { x: s.px(H.topRail.x), y: s.py(H.topRail.y) };
    rail.w = s.px(0.958) - rail.x; rail.h = s.py(0.925) - rail.y;
    this._frame({ x: rail.x, y: rail.y, w: rail.w, h: rail.h }, this.P.blue, 1.5, 14);

    // music player text + transport (small, tracked)
    this._text("David Arnold  arr. Joel Gold...", s.px(H.musicLine1.x), s.py(H.musicLine1.y), { size: 14, color: this.P.white });
    this._text("Stargate SG-1: Main Title", s.px(H.musicLine2.x), s.py(H.musicLine2.y), { size: 14, color: this.P.white });
    this._transport(s.px(H.transport.x), s.py(H.transport.y));

    // DESTINATION
    this._text("DESTINATION", s.px(H.destination.x), s.py(H.destination.y), { size: 17, color: this.P.white, weight: 700, spacing: 2 });
  }

  _transport(x, y) {
    const s = this.s, c = this.ctx, sz = s.us(9), gap = s.us(13);
    c.fillStyle = this.P.cyan;
    // rewind ◀◀
    this._tri(x, y, -sz, sz); this._tri(x + sz, y, -sz, sz);
    // play ▶
    this._tri(x + gap + sz * 2, y, sz, sz);
    // ffwd ▶▶
    this._tri(x + gap * 2 + sz * 3, y, sz, sz); this._tri(x + gap * 2 + sz * 4, y, sz, sz);
  }
  _tri(x, y, dir, sz) {
    const c = this.ctx;
    c.beginPath();
    if (dir > 0) { c.moveTo(x, y - sz); c.lineTo(x + dir, y); c.lineTo(x, y + sz); }
    else { c.moveTo(x, y - sz); c.lineTo(x + dir, y); c.lineTo(x, y + sz); }
    c.closePath(); c.fill();
  }

  // ---- binary panel -------------------------------------------------------
  _binary() {
    const s = this.s, b = this.L.header.binary, r = s.rect(b);
    const cw = r.w / this.binCols, ch = r.h / this.binRows;
    const dot = Math.min(cw, ch) * 0.36;
    for (let row = 0; row < this.binRows; row++) {
      for (let col = 0; col < this.binCols; col++) {
        if (!this.bits[row][col]) continue;
        const cx = r.x + col * cw + cw / 2, cy = r.y + row * ch + ch / 2;
        this.ctx.fillStyle = (col * 7 + row * 3) % 5 === 0 ? "#3a6ae0" : "#1b3f8c";
        this.ctx.fillRect(cx - dot / 2, cy - dot / 2, dot, dot);
      }
    }
  }

  // ---- left column: timer arc, numbers, status, checklist -----------------
  _left() {
    const s = this.s, L = this.L.left, c = this.ctx, d = this.dialer;

    // timer arc — ~3/4 ring hugging the top-left, open at the bottom-right (matches the SGC frame)
    const cx = s.px(L.timerArc.cx), cy = s.py(L.timerArc.cy), R = s.us(L.timerArc.r * 800);
    c.beginPath(); c.arc(cx, cy, R, TAU * 0.222, TAU * 1.083, false);
    this._stroke(this.P.blueBright, 5); c.lineCap = "round"; c.stroke(); c.lineCap = "butt";

    this._text(`${d.clock.hh}:${d.clock.mm}`, s.px(L.timeText.x), s.py(L.timeText.y), { size: 38, color: this.P.white, weight: 600 });
    this._text(d.clock.date, s.px(L.dateText.x), s.py(L.dateText.y), { size: 24, color: this.P.white });
    this._text(d.clock.day, s.px(L.dayText.x), s.py(L.dayText.y), { size: 30, color: this.P.white });

    // numbers grid with sparklines
    let k = 0;
    for (let r = 0; r < L.numbers.rowY.length; r++) {
      for (let col = 0; col < L.numbers.colX.length; col++) {
        const x = s.px(L.numbers.colX[col]), y = s.py(L.numbers.rowY[r]);
        this._text(String(L.numbers.values[r][col]), x, y, { size: 28, color: this.P.white, align: "center" });
        this._sparkline(x - s.us(34), y + s.us(10), s.us(68), s.us(20), this.spark[k++ % 6]);
      }
    }

    // STATUS line
    this._text(`STATUS: ${d.status}`, s.px(L.status.x), s.py(L.status.y), { size: 16, color: this.P.cyan, weight: 600, spacing: 1 });

    // checklist
    this._checklist();
  }

  _sparkline(x, y, w, h, data) {
    const c = this.ctx;
    c.beginPath();
    for (let i = 0; i < data.length; i++) {
      const px = x + (i / (data.length - 1)) * w, py = y + (1 - data[i]) * h;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    this._stroke(this.P.blueBright, 1.2); c.stroke();
  }

  _checklist() {
    const s = this.s, L = this.L.left, c = this.ctx, locked = this.dialer.locked;
    const box = s.rect(L.checklist);
    // beveled panel: dark fill, bright border, left highlight
    this._rrect(box.x, box.y, box.w, box.h, s.us(8));
    c.fillStyle = "#081326"; c.fill();
    this._frame(box, this.P.blueBright, 2, 8);
    c.beginPath(); c.moveTo(box.x + s.us(3), box.y + s.us(6)); c.lineTo(box.x + s.us(3), box.y + box.h - s.us(6));
    this._stroke("#4f86ff", 1.5); c.stroke();

    const rows = L.checklist.rows;
    const pad = s.us(9);
    const rowH = (box.h - pad * 2) / rows;
    const sq = rowH * 0.46;
    for (let i = 0; i < rows; i++) {
      const ry = box.y + pad + i * rowH + rowH / 2;
      const lit = i < locked || this.dialer.phase === "active" || this.dialer.phase === "dialed" || this.dialer.phase === "kawoosh";
      // left indicator square
      this._stroke(this.P.blueBright, 1.4);
      c.strokeRect(box.x + pad, ry - sq / 2, sq, sq);
      // red bar (rounded)
      const barX = box.x + pad * 2 + sq, barW = box.w - (pad * 4 + sq * 2) - s.us(20);
      this._rrect(barX, ry - sq / 2, barW, sq, s.us(sq / 2));
      if (lit) { c.save(); c.shadowColor = this.P.red; c.shadowBlur = s.us(5); c.fillStyle = this.P.red; c.fill(); c.restore(); }
      else { c.fillStyle = this.P.redDim; c.fill(); }
      // number (blue)
      this._text(String(i + 1), barX + barW + s.us(10), ry + s.us(5), { size: 15, color: this.P.cyan, align: "center", weight: 600 });
      // right indicator square
      this._stroke(this.P.blueBright, 1.4);
      c.strokeRect(box.x + box.w - pad - sq, ry - sq / 2, sq, sq);
    }
  }

  // ---- result boxes -------------------------------------------------------
  _boxes() {
    const s = this.s, B = this.L.boxes;
    for (let i = 0; i < B.count; i++) {
      const rect = { x: B.first.x, y: B.first.y + i * B.stepY, w: B.first.w, h: B.first.h };
      const r = s.rect(rect);
      this._frame(r, this.P.blue, 2, 6);
      this._text(String(i + 1), s.px(rect.x + B.numberDX), r.y + r.h / 2 + s.us(8), { size: 26, color: this.P.white, align: "center" });
    }
  }

  // ---- circuit ------------------------------------------------------------
  _circuit() {
    const s = this.s, B = this.L.boxes, C = this.L.circuit, c = this.ctx;
    const hot = this.dialer.phase === "active" || this.dialer.phase === "kawoosh";
    const col = hot ? this.P.red : this.P.blue;
    this._stroke(col, 1.6);
    if (hot) { c.save(); c.shadowColor = this.P.red; c.shadowBlur = s.us(4); }

    // nested vertical lanes on the far right + per-box returns into the right edge
    for (let i = 0; i < B.count; i++) {
      const r = s.rect({ x: B.first.x, y: B.first.y + i * B.stepY, w: B.first.w, h: B.first.h });
      const laneX = s.px(C.laneX0 + i * C.laneStep);
      const midY = r.y + r.h / 2;
      const railY = s.py(C.railY) + s.us(i * 3);
      c.beginPath();
      c.moveTo(r.x + r.w, midY);      // box right edge
      c.lineTo(laneX, midY);          // out to its lane
      c.lineTo(laneX, railY);         // up the lane
      c.lineTo(s.px(0.965), railY);   // back to the top rail (right corner)
      c.stroke();
    }

    // diagonal tap from the rail down to the top-left gate chevron (~130°)
    const g = s.gate();
    const ang = (C.chevronTap * Math.PI) / 180;
    const gx = g.cx + Math.cos(-ang) * g.R * 0.93;
    const gy = g.cy + Math.sin(-ang) * g.R * 0.93;
    c.beginPath();
    c.moveTo(s.px(0.205), s.py(0.14));
    c.lineTo(s.px(0.32), s.py(0.14));
    c.lineTo(gx, gy);
    c.stroke();
    if (hot) c.restore();
  }

  // ---- footer -------------------------------------------------------------
  _footer() {
    const s = this.s, F = this.L.footer, d = this.dialer;
    this._text("LST CODE # 1", s.px(F.lstCode1.x), s.py(F.lstCode1.y), { size: 15, color: this.P.white, weight: 700, spacing: 1 });
    this._text("LST CODE # 2", s.px(F.lstCode2.x), s.py(F.lstCode2.y), { size: 15, color: this.P.white, weight: 700, spacing: 1 });
    this._countdownIcon(s.px(0.495), s.py(0.748));

    // readout box with 3 status dots on its right
    const r = s.rect(F.readout);
    this._frame(r, this.P.blue, 2, 6);
    this._dots(r.x + r.w + s.us(12), r.y + r.h * 0.5, s.us(11), this.P.blueBright);
    // wormhole countdown shown inside the readout when active
    if (d.phase === "active") {
      const crit = d.countdownCritical && Math.floor(this.t / 350) % 2 === 0;
      this._text(d.countdownText, r.x + r.w / 2, r.y + r.h / 2 + s.us(14), { size: 42, color: crit ? this.P.red : this.P.cyan, weight: 600, align: "center" });
    }

    this._text("AUTHORIZATION CODE:", s.px(F.authLabel.x), s.py(F.authLabel.y), { size: 15, color: this.P.cyan, weight: 700, spacing: 1, align: "right" });
    this._authCells(0.418, 0.792, F.authDigits.y, F.authDigits.value);

    this._text(F.user.value, s.px(F.user.x), s.py(F.user.y), { size: 12, color: this.P.white, align: "right", spacing: 1 });
    this._text(F.sys.value, s.px(F.sys.x), s.py(F.sys.y), { size: 12, color: this.P.cyan, align: "right", spacing: 1 });
  }

  // segmented authorization-code cells between two x fractions
  _authCells(x0f, x1f, yf, str) {
    const s = this.s, c = this.ctx;
    const x0 = s.px(x0f), x1 = s.px(x1f), y = s.py(yf);
    const n = str.length, cw = (x1 - x0) / n;
    const h = s.us(34), top = y - h * 0.78;
    for (let i = 0; i < n; i++) {
      const cx = x0 + i * cw;
      if (i > 0) { c.beginPath(); c.moveTo(cx, top); c.lineTo(cx, top + h); this._stroke("#1a3a8a", 1); c.stroke(); }
      this._text(str[i], cx + cw / 2, y, { size: 26, color: this.P.white, weight: 700, align: "center" });
    }
  }

  _dots(cx, cy, spacing, color) {
    const c = this.ctx, r = this.s.us(1.6);
    c.fillStyle = color;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.arc(cx, cy + i * spacing, r, 0, TAU); c.fill(); }
  }

  _countdownIcon(cx, cy) {
    const s = this.s, c = this.ctx, w = s.us(26), h = s.us(20);
    this._rrect(cx - w / 2, cy - h / 2, w, h, s.us(2));
    this._stroke(this.P.cyan, 1.4); c.stroke();
    for (let i = 1; i <= 3; i++) {
      const ly = cy - h / 2 + (h * i) / 4;
      c.beginPath(); c.moveTo(cx - w / 2 + s.us(4), ly); c.lineTo(cx + w / 2 - s.us(4), ly);
      this._stroke(this.P.cyan, 1); c.stroke();
    }
  }

  // ---- gate crosshair -----------------------------------------------------
  _crosshair() {
    const s = this.s, g = s.gate(), c = this.ctx, k = s.us(7);
    this._stroke(this.P.cyan, 1.4);
    c.beginPath();
    c.moveTo(g.cx - k, g.cy); c.lineTo(g.cx + k, g.cy);
    c.moveTo(g.cx, g.cy - k); c.lineTo(g.cx, g.cy + k);
    c.stroke();
  }
}
