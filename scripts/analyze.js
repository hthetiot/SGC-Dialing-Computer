// analyze.js — measure all structural HUD anchors on target + a render and print the deltas.
// One call replaces dozens of probe calls. Pure Node (node:zlib). Usage:
//   node scripts/analyze.js                      # target.png vs shot_idle.png
//   node scripts/analyze.js target.png shot_idle.png
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const TMP = fileURLToPath(new URL("../tmp/", import.meta.url));
const W = 1491, H = 1074;

function decode(path) {
  const buf = readFileSync(path);
  let p = 8, width = 0, height = 0, colorType = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString("ascii", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9]; }
    else if (type === "IDAT") idat.push(data); else if (type === "IEND") break;
    p += 12 + len;
  }
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * ch, out = Buffer.alloc(height * stride); let rp = 0;
  const pae = (a, b, c) => { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < height; y++) {
    const f = raw[rp++];
    for (let i = 0; i < stride; i++) {
      const x = raw[rp++], a = i >= ch ? out[y * stride + i - ch] : 0, b = y > 0 ? out[(y - 1) * stride + i] : 0, c = y > 0 && i >= ch ? out[(y - 1) * stride + i - ch] : 0;
      let v = x; if (f === 1) v = x + a; else if (f === 2) v = x + b; else if (f === 3) v = x + ((a + b) >> 1); else if (f === 4) v = x + pae(a, b, c);
      out[y * stride + i] = v & 255;
    }
  }
  return { width, height, ch, data: out };
}

const px = (im, x, y) => { const o = (y * im.width + x) * im.ch; return [im.data[o], im.data[o + 1], im.data[o + 2]]; };
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const isOn = (im, x, y) => lum(...px(im, x, y)) > 55;            // any bright structure
const isBlue = (im, x, y) => { const [r, g, b] = px(im, x, y); return b > 70 && b > r + 18; };

function rowRuns(im, y, x0, x1, test) { const r = []; let s = -1; for (let x = x0; x <= x1; x++) { const on = test(im, x, y); if (on && s < 0) s = x; else if (!on && s >= 0) { r.push([s, x - 1]); s = -1; } } if (s >= 0) r.push([s, x1]); return r; }
function colRuns(im, x, y0, y1, test) { const r = []; let s = -1; for (let y = y0; y <= y1; y++) { const on = test(im, x, y); if (on && s < 0) s = y; else if (!on && s >= 0) { r.push([s, y - 1]); s = -1; } } if (s >= 0) r.push([s, y1]); return r; }
const mid = (run) => (run[0] + run[1]) / 2;

function measure(im) {
  const m = {};
  // outer frame
  const top = colRuns(im, 40, 4, 60, isBlue)[0];
  const bot = colRuns(im, 40, 1000, im.height - 1, isBlue).pop();
  const hb = rowRuns(im, 60, 4, im.width - 1, isBlue);
  m.frame = { left: hb[0] ? hb[0][0] : 0, right: hb.length ? hb[hb.length - 1][1] : 0, top: top ? top[0] : 0, bottom: bot ? bot[1] : 0 };
  // gate via white ring band at vertical center
  const rowG = rowRuns(im, 513, 380, 1110, isOn);
  if (rowG.length) { const L = rowG[0][0], R = rowG[rowG.length - 1][1]; m.gate = { cx: (L + R) / 2, R: (R - L) / 2 }; }
  const colG = colRuns(im, 743, 180, 870, isOn);
  if (colG.length) { const T = colG[0][0], B = colG[colG.length - 1][1]; m.gate.cy = (T + B) / 2; m.gate.Rv = (B - T) / 2; }
  // result boxes: vertical edges along a column through them
  const colB = colRuns(im, 1300, 140, 1010, isOn).filter((r) => r[1] - r[0] <= 8);
  const tops = colB.filter((_, i) => i % 2 === 0).map((r) => mid(r));
  m.boxes = { edges: colB.length, top0: colB[0] ? mid(colB[0]) : 0, stepY: tops.length > 1 ? tops[1] - tops[0] : 0, h: colB.length > 1 ? mid(colB[1]) - mid(colB[0]) : 0 };
  const rowB = rowRuns(im, m.boxes.top0 + 50, 1180, 1420, isOn);
  if (rowB.length) { m.boxes.left = rowB[0][0]; m.boxes.right = rowB[rowB.length - 1][1]; }
  // checklist panel (blue) bottom-left
  const rowC = rowRuns(im, 850, 20, 320, isBlue);
  if (rowC.length) { m.checklist = { left: rowC[0][0], right: rowC[rowC.length - 1][1] }; const cc = colRuns(im, (rowC[0][0] + rowC[rowC.length - 1][1]) / 2 | 0, 660, 960, isBlue); m.checklist.top = cc[0] ? cc[0][0] : 0; m.checklist.bottom = cc.length ? cc[cc.length - 1][1] : 0; }
  // readout box
  const rowR = rowRuns(im, 900, 150, 1200, isBlue);
  if (rowR.length) { m.readout = { left: rowR[0][0], right: rowR[rowR.length - 1][1] }; const cr = colRuns(im, 320, 820, 1030, isBlue); m.readout.top = cr[0] ? cr[0][0] : 0; m.readout.bottom = cr.length ? cr[cr.length - 1][1] : 0; }
  return m;
}

const [fa = "target.png", fb = "shot_idle.png"] = process.argv.slice(2);
const A = measure(decode(TMP + fa)), B = measure(decode(TMP + fb));
const fx = (v) => (v / W).toFixed(4), fy = (v) => (v / H).toFixed(4);

function line(label, a, b, axis) {
  const f = axis === "x" ? fx : fy;
  const d = Math.round(b - a);
  console.log(`  ${label.padEnd(18)} target ${String(Math.round(a)).padStart(5)} (${f(a)})   mine ${String(Math.round(b)).padStart(5)}   Δ${d > 0 ? "+" : ""}${d}`);
}
console.log(`\n== ${fa}  vs  ${fb} ==`);
console.log("FRAME"); line("left", A.frame.left, B.frame.left, "x"); line("right", A.frame.right, B.frame.right, "x"); line("top", A.frame.top, B.frame.top, "y"); line("bottom", A.frame.bottom, B.frame.bottom, "y");
console.log("GATE"); line("cx", A.gate.cx, B.gate.cx, "x"); line("cy", A.gate.cy, B.gate.cy, "y"); line("R(horiz)", A.gate.R, B.gate.R, "x"); line("R(vert)", A.gate.Rv, B.gate.Rv, "y");
console.log("BOXES"); line("left", A.boxes.left, B.boxes.left, "x"); line("right", A.boxes.right, B.boxes.right, "x"); line("top0", A.boxes.top0, B.boxes.top0, "y"); line("stepY", A.boxes.stepY, B.boxes.stepY, "y"); line("height", A.boxes.h, B.boxes.h, "y"); console.log(`  (edges found: target ${A.boxes.edges}, mine ${B.boxes.edges})`);
if (A.checklist && B.checklist) { console.log("CHECKLIST"); line("left", A.checklist.left, B.checklist.left, "x"); line("right", A.checklist.right, B.checklist.right, "x"); line("top", A.checklist.top, B.checklist.top, "y"); line("bottom", A.checklist.bottom, B.checklist.bottom, "y"); }
if (A.readout && B.readout) { console.log("READOUT"); line("left", A.readout.left, B.readout.left, "x"); line("right", A.readout.right, B.readout.right, "x"); line("top", A.readout.top, B.readout.top, "y"); line("bottom", A.readout.bottom, B.readout.bottom, "y"); }
console.log("");
