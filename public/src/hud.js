// hud.js — 2D HUD chrome, mapped through Screen so it matches the reference at 1.25:1
// and reflows responsively (panels hug viewport edges) on any other aspect.

export class HUD {
  constructor(canvas, layout, screen) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.L = layout;
    this.S = screen;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.locked = 0;
    this.address = [];
    this.resultGlyphPaths = [];
    this.palette = "cyan";
    this.binaryRows = this._genBinary(18);
    this.binaryOffset = 0;
    this.t = 0;
    this.showLayers = {
      header: true, binary: true, checklist: true,
      footer: true, boxes: true, circuit: true,
    };

    this.colors = {
      cyan: { line: "#1d8fcf", lineDim: "#0e466a", glow: "#7fd4ff", text: "#9fdcff",
              textDim: "#3a6a8a", lit: "#cdeaff", binary: "#1aa39c", binaryHi: "#7ff0e8" },
      red:  { line: "#cf3a2a", lineDim: "#6a201a", glow: "#ff9f92", text: "#ffb0a4",
              textDim: "#8a3a30", lit: "#ffd8d2", binary: "#cf5a4a", binaryHi: "#ff9a88" },
    };
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  setPalette(p) { this.palette = p; }
  C() { return this.colors[this.palette] || this.colors.cyan; }

  // The 9 chevron positions (degrees, 0=right, CCW), matching the gate art. The 7 that
  // engage during dialing are the standard SG-1 set; chevron 7 (origin) is the top one.
  // Order here is the lock order 1..7 used to place red indicators as glyphs lock.
  static CHEVRON_DEG = [50, 10, 330, 290, 250, 210, 90]; // 1..6 around, 7 = top

  _genBinary(rows) {
    const out = [];
    for (let r = 0; r < rows; r++) {
      let s = ""; for (let c = 0; c < 11; c++) s += Math.random() < 0.5 ? "0" : "1";
      out.push(s);
    }
    return out;
  }

  resize() {
    const W = window.innerWidth, H = window.innerHeight;
    this.W = W; this.H = H;
    this.canvas.width = Math.round(W * this.dpr);
    this.canvas.height = Math.round(H * this.dpr);
    this.canvas.style.width = W + "px";
    this.canvas.style.height = H + "px";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  update(dt, state) {
    this.t += dt;
    if (state) {
      this.address = state.address ?? this.address;
      this.locked = state.locked ?? this.locked;
      this.palette = state.palette ?? this.palette;
      this.resultGlyphPaths = state.resultGlyphPaths ?? this.resultGlyphPaths;
      this._binarySpeed = state.binarySpeed ?? 1;
      this.phase = state.phase ?? this.phase;
      this.mode = state.mode ?? this.mode;
      this.remainingMs = state.remainingMs ?? this.remainingMs;
      this.addressName = state.addressName ?? this.addressName;
    }
    this.binaryOffset += dt * (this._binarySpeed ?? 1) * 14;
    const rowH = this._lastRowH || 18;
    if (this.binaryOffset > rowH) {
      this.binaryOffset -= rowH;
      this.binaryRows.push(this._genBinary(1)[0]);
      this.binaryRows.shift();
    }
  }

  fpx(refFrac) { return Math.max(8, this.S.rectH * refFrac); }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    // Layer order (back → front). Per spec: header, binary, checklist, footer, boxes,
    // circuit. Each layer owns its TEXT (no separate labels layer). No `frame` layer —
    // the gate routing lives in `circuit`. Chevron-red is on the gate geometry, not here.
    if (this.showLayers.circuit) this._drawCircuit();     // gate→box trace network
    if (this.showLayers.header) this._drawHeader();       // top bar + logo bay + DESTINATION
    if (this.showLayers.binary) this._drawBinary();       // binary panel + frame
    if (this.showLayers.checklist) this._drawChecklist(); // STATUS + 7-row checklist
    if (this.showLayers.boxes) this._drawBoxes();         // 7 result boxes + numbers + glyphs
    if (this.showLayers.footer) this._drawFooter();       // readout box + AUTH + SYS + LST
  }

  // whether the full red "activated" circuit overlay is on (wormhole active)
  isActivated() { return this._activated === true; }
  setActivated(v) { this._activated = v; }

  // HEADER layer — top bar enclosure, logo bay frame, indicator dots, DESTINATION text.
  _drawHeader() {
    const ctx = this.ctx, C = this.C(), S = this.S;
    const lb = S.anchored({ ref: this.L.logo_bay.rect, anchorX: "left" });
    const tbx = lb.x + lb.w + 12;
    this._stroke(C.line, 1.4, 4);
    this._rr(tbx, S.sy(0.022), (this.W - 6) - tbx - 6, S.sy(0.09) - S.sy(0.022), 6);
    ctx.stroke(); ctx.shadowBlur = 0;
    // logo bay frame
    this._stroke(C.line, 1.4, 6);
    this._rr(lb.x + 6, lb.y, lb.w, lb.h, 5); ctx.stroke(); ctx.shadowBlur = 0;
    // dotted indicator cluster in the top bar (decorative)
    ctx.fillStyle = C.line;
    for (let i = 0; i < 14; i++) {
      const dx = tbx + 60 + (i % 7) * 14;
      const dy = S.sy(0.04) + Math.floor(i / 7) * 8;
      if (this._dots?.[i]) { ctx.globalAlpha = this._dots[i]; ctx.fillRect(dx, dy, 4, 4); }
    }
    ctx.globalAlpha = 1;
    // DESTINATION text (header owns its text)
    ctx.fillStyle = C.text;
    ctx.font = `bold ${this.fpx(0.022)}px "Arial Narrow", sans-serif`;
    ctx.textBaseline = "alphabetic";
    const dest = S.anchored({ ref: [[this.L.destination.pos[0], 0], [0.978, 0]], anchorX: "right" });
    ctx.fillText("DESTINATION:", dest.x, S.sy(this.L.destination.pos[1]));
    if (this.addressName) {
      ctx.fillStyle = C.glow;
      ctx.font = `bold ${this.fpx(0.024)}px "Courier New", monospace`;
      const tw = ctx.measureText("DESTINATION:").width;
      ctx.fillText(this.addressName.toUpperCase(), dest.x + tw + 14, S.sy(this.L.destination.pos[1]));
    }
  }

  // CIRCUIT layer — the trace network routing from the gate out to the 7 result boxes,
  // matching the reference diagram (1781780688811_image.png): traces leave the upper-right
  // of the gate, run to a set of nested vertical lanes, then step horizontally into each
  // box. Replaces the old `frame` bracket. Goes red on activation / per locked chevron.
  _drawCircuit() {
    const ctx = this.ctx, C = this.C(), S = this.S;
    const rects = this._resultRects();
    const activated = this.isActivated();
    const cc = this.L.circuit;
    if (!cc) return;
    const railCol = activated ? "#ff3a24" : C.line;

    // TOP RAIL — main conductor from left of gate, up, across, step-down at top-right.
    const railPts = cc.top_rail.map((p, idx) => {
      const anchorX = idx >= 2 ? "right" : "left";
      const a = S.anchored({ ref: [[p[0], p[1]], [p[0], p[1]]], anchorX });
      return { x: a.x, y: a.y };
    });
    this._stroke(railCol, activated ? 2 : 1.5, activated ? 6 : 0);
    ctx.beginPath();
    railPts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke();
    const corner = railPts[railPts.length - 1];

    // CHEVRON LINK — the circuit physically connects to the gate: a diagonal trace from the
    // bottom of the rail's left segment down to the top-left chevron's outer tip (matches the
    // show, where the conductor links to a chevron rather than floating).
    if (cc.chevron_link) {
      const a = S.anchored({ ref: [cc.chevron_link.from, cc.chevron_link.from], anchorX: "left" });
      // chevron tip uses faithful (sx/sy) mapping since it's tied to the gate, not an edge
      const tx = S.sx(cc.chevron_link.to[0]), ty = S.sy(cc.chevron_link.to[1]);
      this._stroke(railCol, activated ? 2 : 1.5, activated ? 6 : 0);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }

    // WRAP-AROUND-RIGHT branches: from the top-right corner each trace runs RIGHT, past the
    // boxes, to a nested vertical lane on the FAR RIGHT, drops down to the box mid-y, then
    // comes back LEFT into the box's RIGHT edge. (This is the real show topology — the traces
    // wrap around the right of the box column, they do NOT cross diagonally in front.)
    rects.forEach((r, i) => {
      const hot = activated || i < this.locked;
      const my = r.y + r.h / 2;
      const boxRight = r.x + r.w;
      const laneRef = cc.lane_x?.[i] ?? 0.985;
      const lane = S.anchored({ ref: [[laneRef, 0], [laneRef, 0]], anchorX: "right" }).x;
      this._stroke(hot ? "#ff3a24" : C.lineDim, hot ? 1.5 : 1.0, hot ? 5 : 0);
      ctx.beginPath();
      ctx.moveTo(corner.x, corner.y);     // top-right corner
      ctx.lineTo(lane, corner.y);          // right to the nested lane
      ctx.lineTo(lane, my);                // down the lane
      ctx.lineTo(boxRight, my);            // back left into the box RIGHT edge
      ctx.stroke();
    });
    ctx.shadowBlur = 0;
  }

  _stroke(color, w = 1.2, glow = 0) {
    const ctx = this.ctx;
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.shadowColor = glow ? color : "transparent"; ctx.shadowBlur = glow;
  }
  _rr(x, y, w, h, r) {
    const ctx = this.ctx;
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  _drawBinary() {
    const ctx = this.ctx, C = this.C(), S = this.S;
    const r = S.anchored({ ref: this.L.binary.rect, anchorX: "left" });
    const x0 = r.x + 6, y0 = r.y, w = r.w, h = r.h;
    this._stroke(C.line, 1.2, 3);
    this._rr(x0 - 4, y0 - 6, w + 8, h + 12, 6); ctx.stroke(); ctx.shadowBlur = 0;

    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
    const rowH = h / 15; this._lastRowH = rowH;
    const fs = rowH * 0.82;
    ctx.font = `${fs}px "Courier New", monospace`;
    ctx.textBaseline = "top";
    for (let i = 0; i < this.binaryRows.length; i++) {
      const ry = y0 + i * rowH - this.binaryOffset;
      const hot = (i + Math.floor(this.t)) % 7 === 0;
      ctx.fillStyle = hot ? C.binaryHi : C.binary;
      ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin((i + this.t) * 0.6));
      ctx.fillText(this.binaryRows[i].split("").join(" "), x0 + 6, ry);
    }
    ctx.globalAlpha = 1; ctx.restore();
  }

  // Lore-accurate program state text from the dialer phase + mode.
  statusText() {
    const m = (this.mode === "incoming") ? "INCOMING" : "OUTGOING";
    switch (this.phase) {
      case "idle": return "STATUS: STANDBY";
      case "spinning":
      case "locking":
      case "between": return `STATUS: ${m} DIALING SEQUENCE`;
      case "dialed": return "STATUS: CHEVRONS ENCODED";
      case "kawoosh": return "STATUS: WORMHOLE ESTABLISHED";
      case "active": return `STATUS: ${m} WORMHOLE ACTIVE`;
      case "aborting": return "STATUS: DIALING ABORTED";
      default: return "STATUS: ACTIVE";
    }
  }

  _drawChecklist() {
    const ctx = this.ctx, C = this.C(), S = this.S;
    const sp = this.L.status.pos;
    ctx.fillStyle = C.text;
    ctx.font = `bold ${this.fpx(0.018)}px "Arial Narrow", sans-serif`;
    ctx.textBaseline = "alphabetic";
    const statusX = (S.anchored({ ref: [[0.028, 0], [0.15, 0]], anchorX: "left" })).x + 6;
    ctx.fillText(this.statusText(), statusX, S.sy(sp[1]));

    const r = S.anchored({ ref: this.L.checklist.rect, anchorX: "left" });
    const x0 = r.x + 6, y0 = r.y, w = r.w, h = r.h;
    this._stroke(C.line, 1.2, 2);
    this._rr(x0 - 2, y0 - 2, w + 4, h + 4, 5); ctx.stroke(); ctx.shadowBlur = 0;

    const rows = 7, rh = h / rows;
    ctx.font = `${Math.max(9, rh * 0.5)}px "Arial Narrow", sans-serif`;
    for (let i = 0; i < rows; i++) {
      const ry = y0 + i * rh, cw = rh * 0.62, lit = i < this.locked;
      this._stroke(lit ? C.glow : C.lineDim, 1.1, lit ? 6 : 0);
      ctx.strokeRect(x0 + 6, ry + rh * 0.2, cw, rh * 0.55);
      if (lit) { ctx.fillStyle = C.glow; ctx.fillRect(x0 + 6, ry + rh * 0.2, cw, rh * 0.55); }
      ctx.shadowBlur = 0;
      ctx.fillStyle = lit ? C.lit : C.textDim;
      ctx.fillText(`${i + 1}`, x0 + cw + 16, ry + rh * 0.68);
      if (lit) ctx.fillText("OK", x0 + cw + 34, ry + rh * 0.68);
    }
  }

  _resultRects() {
    const S = this.S;
    return this.L.result_boxes.map((ref) => S.anchored({ ref, anchorX: "right" }));
  }

  // BOXES layer — just the 7 result boxes + numbers + locked glyphs. No circuit here.
  _drawBoxes() {
    const ctx = this.ctx, C = this.C();
    const rects = this._resultRects();
    const activated = this.isActivated();
    rects.forEach((r, i) => {
      const lit = i < this.locked;
      const hot = activated || lit;
      const my = r.y + r.h / 2;
      this._stroke(hot ? "#ff3a24" : C.line, 1.4, hot ? 6 : 2);
      this._rr(r.x, r.y, r.w, r.h, 4); ctx.stroke(); ctx.shadowBlur = 0;
      // number to the LEFT of the box
      ctx.fillStyle = lit ? C.lit : C.textDim;
      ctx.font = `bold ${this.fpx(0.032)}px "Arial Narrow", sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText(`${i + 1}`, r.x - 28, my);
      ctx.textBaseline = "alphabetic";
      if (lit && this.resultGlyphPaths[i]) {
        this._glyphInBox(this.resultGlyphPaths[i], r, activated ? "#ff8a7a" : C.lit);
      }
    });
  }

  _glyphInBox(paths, r, color) {
    const ctx = this.ctx;
    const pad = Math.min(r.w, r.h) * 0.18;
    const size = Math.min(r.w, r.h) - pad * 2;
    const ox = r.x + (r.w - size) / 2, oy = r.y + (r.h - size) / 2;
    ctx.save();
    ctx.translate(ox, oy); ctx.scale(size / 100, size / 100);
    // bold OUTLINE (stroke) to match the reference's chunky box glyphs, plus a soft fill
    ctx.strokeStyle = color; ctx.lineWidth = 6;
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.shadowColor = color; ctx.shadowBlur = 8;
    for (const d of paths) ctx.stroke(new Path2D(d));
    ctx.restore(); ctx.shadowBlur = 0;
  }

  _drawFooter() {
    const ctx = this.ctx, C = this.C(), S = this.S;
    ctx.textBaseline = "alphabetic";

    ctx.font = `${this.fpx(0.016)}px "Arial Narrow", sans-serif`;
    ctx.fillStyle = C.textDim;
    ctx.fillText("LST CODE #1", S.sx(this.L.lst1.pos[0]), S.sy(this.L.lst1.pos[1]));
    ctx.fillText("LST CODE #2", S.sx(this.L.lst2.pos[0]), S.sy(this.L.lst2.pos[1]));

    const br = this.L.bottom_readout.rect;
    this._stroke(C.line, 1.2, 2);
    this._rr(S.sx(br[0][0]), S.sy(br[0][1]),
      S.sx(br[1][0]) - S.sx(br[0][0]), S.sy(br[1][1]) - S.sy(br[0][1]), 4);
    ctx.stroke(); ctx.shadowBlur = 0;

    ctx.fillStyle = C.textDim;
    ctx.font = `${this.fpx(0.016)}px "Arial Narrow", sans-serif`;
    ctx.fillText("AUTHORIZATION CODE:", S.sx(this.L.auth_label.pos[0]), S.sy(this.L.auth_label.pos[1]));
    ctx.fillStyle = C.glow;
    ctx.font = `bold ${this.fpx(0.026)}px "Courier New", monospace`;
    ctx.fillText("7 7 8 9 2 7  -  5 7 8 9 2 3 8 7", S.sx(this.L.auth_value.pos[0]), S.sy(this.L.auth_value.pos[1]));

    ctx.fillStyle = C.textDim;
    ctx.font = `${this.fpx(0.016)}px "Arial Narrow", sans-serif`;
    const sys = S.anchored({ ref: [[this.L.sys.pos[0], 0], [0.95, 0]], anchorX: "right" });
    ctx.fillText("SYS: NOMINAL", sys.x, S.sy(this.L.sys.pos[1]));

    // 38:00 wormhole-open countdown (counts in ms for the impressive HUD look). Shown only
    // while the wormhole is active; pulses red in the final minute.
    if (this.phase === "active" && this.remainingMs != null) {
      const ms = Math.max(0, this.remainingMs);
      const mm = Math.floor(ms / 60000);
      const ss = Math.floor((ms % 60000) / 1000);
      const mmm = Math.floor(ms % 1000);
      const txt = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(mmm).padStart(3, "0")}`;
      const danger = ms < 60000; // final minute
      const lbl = S.anchored({ ref: [[0.40, 0], [0.62, 0]], anchorX: "right" });
      ctx.fillStyle = danger ? "#ff6a55" : C.textDim;
      ctx.font = `${this.fpx(0.015)}px "Arial Narrow", sans-serif`;
      ctx.fillText("WORMHOLE T-MINUS", lbl.x, S.sy(0.945));
      ctx.fillStyle = danger && Math.floor(this.t * 4) % 2 ? "#ff3a24" : C.glow;
      ctx.font = `bold ${this.fpx(0.03)}px "Courier New", monospace`;
      ctx.fillText(txt, lbl.x, S.sy(0.978));
    }
  }
}
