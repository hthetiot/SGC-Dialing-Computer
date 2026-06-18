// hud.js — the entire 2D HUD (everything except the gate), drawn to one canvas.
// All geometry comes from layout.json via the Screen mapper. Rewritten clean.

const TAU = Math.PI * 2;

export class Hud {
  constructor(layout, dialer) {
    this.L = layout;
    this.P = layout.palette;
    this.dialer = dialer;
    this.t = 0;
    this.layers = { frame: true, header: true, left: true, boxes: true, circuit: true, footer: true };
    // scrolling binary rows (top panel + left/bottom fillers)
    this.binTop = this._bits(30, 3);
    this.spark = Array.from({ length: 6 }, (_, i) => this._spark(i));
    this._acc = 0;
  }

  _bits(cols, rows) { return Array.from({ length: rows }, () => Array.from({ length: cols }, () => (Math.random() < 0.3 ? 1 : 0))); }
  _spark(seed) { const a = []; let v = 0.5; for (let i = 0; i < 22; i++) { v += Math.sin(i * 0.9 + seed * 2) * 0.16 + (((i * 7 + seed * 13) % 5) - 2) * 0.03; a.push(Math.max(0.1, Math.min(0.9, v))); } return a; }

  update(dt) { this.t += dt; this._acc += dt; if (this._acc > 150) { this._acc = 0; this.binTop.push(this._bits(30, 1)[0]); this.binTop.shift(); } }

  draw(ctx, screen) {
    this.s = screen; this.c = ctx;
    if (this.layers.frame) { this._outerFrame(); this._rails(); }
    if (this.layers.header) this._header();
    if (this.layers.left) this._left();
    if (this.layers.circuit) this._circuit();
    if (this.layers.boxes) this._boxes();
    if (this.layers.footer) this._footer();
    this._crosshair();
  }

  // ---------- primitives ----------
  _rr(x, y, w, h, r) {
    const c = this.c; r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  _stroke(col, w) { const c = this.c; c.strokeStyle = col; c.lineWidth = this.s.us(w); }
  _frame(r, col = this.P.blue, w = 1.5, rad = 8) { this._rr(r.x, r.y, r.w, r.h, this.s.us(rad)); this._stroke(col, w); this.c.stroke(); }
  _hline(x1, x2, y, col = this.P.blue, w = 1.5) { const c = this.c; c.beginPath(); c.moveTo(x1, y); c.lineTo(x2, y); this._stroke(col, w); c.stroke(); }
  _path(pts, col = this.P.blue, w = 1.5) { const c = this.c; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); this._stroke(col, w); c.stroke(); }
  _text(str, x, y, { size = 12, color = this.P.white, weight = 400, align = "left", spacing = 0 } = {}) {
    const c = this.c; c.font = this.s.font(size, { weight }); c.fillStyle = color; c.textBaseline = "alphabetic";
    if (!spacing) { c.textAlign = align; c.fillText(str, x, y); return; }
    c.textAlign = "left"; const ls = this.s.us(spacing);
    let total = -ls; for (const ch of str) total += c.measureText(ch).width + ls;
    let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
    for (const ch of str) { c.fillText(ch, cx, y); cx += c.measureText(ch).width + ls; }
  }

  // ---------- frame & rails ----------
  _outerFrame() {
    const s = this.s, c = this.c, F = this.L.frame, L = s.rect(this.L.header.logoBay);
    const x0 = s.px(F.left), y0 = s.py(F.top), x1 = s.px(F.right), y1 = s.py(F.bottom), r = s.us(14);
    c.beginPath();
    c.moveTo(L.x + L.w, y0);
    c.lineTo(x1 - r, y0); c.arcTo(x1, y0, x1, y0 + r, r);
    c.lineTo(x1, y1 - r); c.arcTo(x1, y1, x1 - r, y1, r);
    c.lineTo(x0 + r, y1); c.arcTo(x0, y1, x0, y1 - r, r);
    c.lineTo(x0, L.y + L.h); c.lineTo(L.x + L.w, L.y);   // chamfer up to bay top-right
    this._stroke(this.P.blue, 2); c.stroke();
    this._frame(L, this.P.blue, 1.5, 6);                  // logo bay box
  }

  // Inner rail framing the gate+box zone (top + left), drawn behind the circuit.
  _rails() {
    const s = this.s, c = this.c, r = s.us(12);
    const leftX = s.px(0.205), railY = s.py(0.110), bottom = s.py(0.760);
    c.beginPath();
    c.moveTo(leftX, bottom); c.lineTo(leftX, railY + r); c.arcTo(leftX, railY, leftX + r, railY, r);
    c.lineTo(s.px(0.93), railY);
    this._stroke(this.P.blue, 1.5); c.stroke();
  }

  // ---------- header ----------
  _header() {
    const s = this.s, H = this.L.header;
    this._text("David Arnold  arr. Joel Gold...", s.px(H.musicLine1.x), s.py(H.musicLine1.y), { size: 11 });
    this._text("Stargate SG-1: Main Title", s.px(H.musicLine2.x), s.py(H.musicLine2.y), { size: 11 });
    this._transport(s.px(H.transport.x), s.py(H.transport.y));
    this._binary(s.rect(H.binary), this.binTop);
    this._text("DESTINATION", s.px(H.destination.x), s.py(H.destination.y), { size: 14, weight: 500, spacing: 2 });
  }
  _transport(x, y) {
    const s = this.s, c = this.c, sz = s.us(7), g = s.us(10); c.fillStyle = this.P.cyan;
    const tri = (tx, dir) => { c.beginPath(); c.moveTo(tx, y - sz); c.lineTo(tx + dir, y); c.lineTo(tx, y + sz); c.closePath(); c.fill(); };
    tri(x, -sz); tri(x + sz, -sz); tri(x + g + sz * 2, sz); tri(x + g * 2 + sz * 3, sz); tri(x + g * 2 + sz * 4, sz);
  }
  _binary(r, bits) {
    const c = this.c, cw = r.w / bits[0].length, ch = r.h / bits.length, d = Math.min(cw, ch) * 0.36;
    for (let y = 0; y < bits.length; y++) for (let x = 0; x < bits[0].length; x++) {
      if (!bits[y][x]) continue;
      c.fillStyle = (x * 7 + y * 3) % 5 === 0 ? "#3a6ae0" : "#1b3f8c";
      c.fillRect(r.x + x * cw + (cw - d) / 2, r.y + y * ch + (ch - d) / 2, d, d);
    }
  }

  // ---------- left column ----------
  _left() {
    const s = this.s, L = this.L.left, c = this.c, d = this.dialer;
    // timer arc (open bottom-right) + centered clock
    const cx = s.px(L.timerArc.cx), cy = s.py(L.timerArc.cy), R = s.us(L.timerArc.r * 800);
    c.beginPath(); c.arc(cx, cy, R, TAU * 0.22, TAU * 1.08, false); this._stroke(this.P.blueBright, 4); c.lineCap = "round"; c.stroke(); c.lineCap = "butt";
    this._text(`${d.clock.hh}:${d.clock.mm}`, s.px(L.timeText.x), s.py(L.timeText.y), { size: 34, weight: 500, align: "center" });
    this._text(d.clock.date, s.px(L.dateText.x), s.py(L.dateText.y), { size: 21, align: "center" });
    this._text(d.clock.day, s.px(L.dayText.x), s.py(L.dayText.y), { size: 27, align: "center" });
    // numbers grid + sparklines
    let k = 0;
    for (let row = 0; row < L.numbers.rowY.length; row++) for (let col = 0; col < L.numbers.colX.length; col++) {
      const x = s.px(L.numbers.colX[col]), y = s.py(L.numbers.rowY[row]);
      this._text(String(L.numbers.values[row][col]), x, y, { size: 18, align: "center" });
      this._sparkline(x - s.us(30), y + s.us(8), s.us(60), s.us(15), this.spark[k++ % 6]);
    }
    // STATUS box + checklist
    const sb = s.rect(L.status); this._frame(sb, this.P.blue, 1.5, 4);
    this._text(`STATUS: ${d.status}`, sb.x + sb.w / 2, sb.y + sb.h / 2 + s.us(4), { size: 11, color: this.P.cyan, weight: 600, align: "center", spacing: 0.5 });
    this._checklist();
  }
  _sparkline(x, y, w, h, data) {
    const c = this.c; c.beginPath();
    data.forEach((v, i) => { const px = x + (i / (data.length - 1)) * w, py = y + (1 - v) * h; i ? c.lineTo(px, py) : c.moveTo(px, py); });
    this._stroke(this.P.blueBright, 1.2); c.stroke();
  }
  _checklist() {
    const s = this.s, L = this.L.left, c = this.c, locked = this.dialer.locked;
    const box = s.rect(L.checklist), W = box.w, pad = s.us(8);
    this._rr(box.x, box.y, box.w, box.h, s.us(8)); c.fillStyle = "#081326"; c.fill();
    this._frame(box, this.P.blueBright, 1.5, 8);
    const rows = L.checklist.rows, rowH = (box.h - pad * 2) / rows, sq = rowH * 0.4;
    const divX = box.x + W * 0.86;
    c.beginPath(); c.moveTo(divX, box.y + pad); c.lineTo(divX, box.y + box.h - pad); this._stroke(this.P.blue, 1.2); c.stroke();
    const active = ["active", "dialed", "kawoosh"].includes(this.dialer.phase);
    for (let i = 0; i < rows; i++) {
      const ry = box.y + pad + i * rowH + rowH / 2, lit = i < locked || active;
      this._stroke(this.P.blueBright, 1.4); c.strokeRect(box.x + W * 0.04, ry - sq / 2, sq, sq);
      const barX = box.x + W * 0.20, barW = W * 0.25;
      this._rr(barX, ry - sq / 2, barW, sq, s.us(sq / 2)); c.fillStyle = lit ? this.P.red : this.P.redDim; c.fill();
      this._text(String(i + 1), box.x + W * 0.51, ry + s.us(5), { size: 13, color: this.P.cyan, weight: 600, align: "center" });
      this._stroke(this.P.blueBright, 1.4); c.strokeRect(box.x + W * 0.62, ry - sq / 2, sq, sq);
      if (lit) this._text("OK", box.x + W * 0.70, ry + s.us(4), { size: 9, color: this.P.cyan, weight: 600 });
    }
  }

  // ---------- result boxes ----------
  _boxes() {
    const s = this.s, B = this.L.boxes;
    for (let i = 0; i < B.count; i++) {
      const r = s.rect({ x: B.first.x, y: B.first.y + i * B.stepY, w: B.first.w, h: B.first.h });
      this._frame(r, this.P.blue, 1.5, 6);
      this._text(String(i + 1), s.px(B.first.x + B.numberDX), r.y + r.h - s.us(2), { size: 14, weight: 600, align: "center" });
    }
  }

  // ---------- circuit ----------
  _circuit() {
    const s = this.s, B = this.L.boxes, c = this.c, g = s.gate();
    const hot = ["active", "kawoosh"].includes(this.dialer.phase);
    const col = hot ? this.P.red : this.P.blue;
    if (hot) { c.save(); c.shadowColor = this.P.red; c.shadowBlur = s.us(3); }
    const boxes = []; for (let i = 0; i < B.count; i++) boxes.push(s.rect({ x: B.first.x, y: B.first.y + i * B.stepY, w: B.first.w, h: B.first.h }));
    const mid = (r) => r.y + r.h / 2, tip = (a) => { const t = (a * Math.PI) / 180; return [g.cx + Math.cos(t) * g.R, g.cy - Math.sin(t) * g.R]; };
    const railY = s.py(0.110), leftX = s.px(0.205), rr = s.us(12), order = this.L.gate.lockOrder;
    this._stroke(col, 1.5);
    // top chevron drop + left chevron taps into the rail
    const [tx9, ty9] = tip(90); this._path([[tx9, railY], [tx9, ty9]], col);
    for (const a of [130, 170, 210]) { const [tx, ty] = tip(a); this._path([[tx, ty], [leftX, ty]], col); }
    // boxes 4-7 -> far-right lanes -> top rail
    for (let i = 3; i < B.count; i++) { const b = boxes[i], j = i - 3, lx = s.px(0.945) + s.us(6 * j), ty = railY - s.us(6 * (j + 1)); this._path([[b.x + b.w, mid(b)], [lx, mid(b)], [lx, ty], [leftX + rr, ty]], col); }
    // boxes 1-3 -> diagonal to right chevrons (lock order), red once engaged
    for (let i = 0; i < 3; i++) { const b = boxes[i]; const [tx, ty] = tip(order[i]); this._path([[b.x, mid(b)], [tx, ty]], hot || i < this.dialer.locked ? this.P.red : col); }
    if (hot) c.restore();
  }

  // ---------- footer ----------
  _footer() {
    const s = this.s, F = this.L.footer, d = this.dialer;
    this._text("LST CODE # 1", s.px(F.lstCode1.x), s.py(F.lstCode1.y), { size: 11, weight: 500, spacing: 1 });
    this._text("LST CODE # 2", s.px(F.lstCode2.x), s.py(F.lstCode2.y), { size: 11, weight: 500, spacing: 1 });
    const r = s.rect(F.readout); this._frame(r, this.P.blue, 1.5, 6);
    if (d.phase === "active") this._text(d.countdownText, r.x + r.w / 2, r.y + r.h / 2 + s.us(13), { size: 38, color: d.countdownCritical && Math.floor(this.t / 350) % 2 ? this.P.red : this.P.cyan, weight: 600, align: "center" });
    this._text("AUTHORIZATION CODE:", s.px(F.authLabel.x), s.py(F.authLabel.y), { size: 11, color: this.P.cyan, weight: 500, spacing: 1 });
    this._authCells(F.authDigits.x0, F.authDigits.x1, s.py(F.authDigits.y), F.authDigits.value);
    this._text(F.user.value, s.px(F.user.x), s.py(F.user.y), { size: 11, align: "right", spacing: 1 });
    this._text(F.sys.value, s.px(F.sys.x), s.py(F.sys.y), { size: 11, color: this.P.cyan, align: "right", spacing: 1 });
  }
  _authCells(x0f, x1f, y, str) {
    const s = this.s, c = this.c, x0 = s.px(x0f), x1 = s.px(x1f), cw = (x1 - x0) / str.length, h = s.us(30), top = y - h * 0.78;
    for (let i = 0; i < str.length; i++) {
      const cx = x0 + i * cw;
      if (i) { c.beginPath(); c.moveTo(cx, top); c.lineTo(cx, top + h); this._stroke("#1a3a8a", 1); c.stroke(); }
      this._text(str[i], cx + cw / 2, y, { size: 18, weight: 600, align: "center" });
    }
  }

  _crosshair() {
    const s = this.s, g = s.gate(), c = this.c, k = s.us(7);
    this._stroke(this.P.cyan, 1.4);
    c.beginPath(); c.moveTo(g.cx - k, g.cy); c.lineTo(g.cx + k, g.cy); c.moveTo(g.cx, g.cy - k); c.lineTo(g.cx, g.cy + k); c.stroke();
  }
}
