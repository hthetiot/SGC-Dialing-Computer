// probe.js — decode a tmp/ PNG and report exact pixel coordinates for measurement.
// Pure Node (node:zlib), no deps. Used to set layout.json from real target pixels.
//
// Usage:
//   node scripts/probe.js row <y> [file]        # bright-pixel runs along a row  -> x edges
//   node scripts/probe.js col <x> [file]        # bright-pixel runs along a column -> y edges
//   node scripts/probe.js px  <x> <y> [file]    # RGBA at a pixel
//   node scripts/probe.js blue-row <y> [file]   # runs where BLUE frame dominates
// file defaults to target.png. Coordinates are in image pixels (target is 1491x1074).

import { readFileSync, existsSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

// Resolve a probe target by name: prefer source/ (target.png, mask.png, mask_inv.png, vector mask),
// then fall back to tmp/ (a script output, possibly in a subfolder given as "trace/trace.png").
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const resolve = (name) => {
  for (const base of [ROOT + "source/", ROOT + "tmp/"]) if (existsSync(base + name)) return base + name;
  return ROOT + "source/" + name; // default; will throw on read if truly missing
};
const [mode, ...rest] = process.argv.slice(2);

function decodePNG(path) {
  const buf = readFileSync(path);
  let p = 8, width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString("ascii", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (bitDepth !== 8) throw new Error("only 8-bit supported");
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 4;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  const out = Buffer.alloc(height * stride);
  let rp = 0;
  const paeth = (a, b, c) => { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < height; y++) {
    const f = raw[rp++];
    for (let i = 0; i < stride; i++) {
      const x = raw[rp++];
      const a = i >= ch ? out[y * stride + i - ch] : 0;
      const b = y > 0 ? out[(y - 1) * stride + i] : 0;
      const c = y > 0 && i >= ch ? out[(y - 1) * stride + i - ch] : 0;
      let v = x;
      if (f === 1) v = x + a; else if (f === 2) v = x + b; else if (f === 3) v = x + ((a + b) >> 1); else if (f === 4) v = x + paeth(a, b, c);
      out[y * stride + i] = v & 255;
    }
  }
  return { width, height, ch, data: out };
}

const reqFile = rest[mode === "px" ? 2 : 1] || "target.png";
const img = decodePNG(resolve(reqFile));
// The mask is black art on white; invert it so "bright" still means "HUD line" for all the
// luminance/edge tests below (replaces the old separate mask_inv.png).
const INV = /mask/i.test(reqFile);
const px = (x, y) => { const o = (y * img.width + x) * img.ch; const r = img.data[o], g = img.data[o + 1], b = img.data[o + 2]; return INV ? [255 - r, 255 - g, 255 - b] : [r, g, b]; };
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

function runs(vals, test) {
  const r = []; let start = -1;
  for (let i = 0; i < vals.length; i++) {
    const on = test(i);
    if (on && start < 0) start = i;
    else if (!on && start >= 0) { r.push([start, i - 1]); start = -1; }
  }
  if (start >= 0) r.push([start, vals.length - 1]);
  return r;
}

if (mode === "px") {
  const [x, y] = rest.map(Number);
  console.log(`px(${x},${y}) = rgb(${px(x, y).join(",")})`);
} else if (mode === "row" || mode === "blue-row") {
  const y = Number(rest[0]);
  const blueMode = mode === "blue-row";
  const r = runs({ length: img.width }, (x) => {
    const [R, G, B] = px(x, y);
    return blueMode ? (B > 90 && B > R + 30) : lum(R, G, B) > 60;
  });
  console.log(`y=${y}: ${r.map(([a, b]) => `${a}-${b}(${b - a + 1})`).join("  ")}`);
} else if (mode === "col") {
  const x = Number(rest[0]);
  const r = runs({ length: img.height }, (y) => lum(...px(x, y)) > 60);
  console.log(`x=${x}: ${r.map(([a, b]) => `${a}-${b}(${b - a + 1})`).join("  ")}`);
} else {
  console.log("modes: row <y> | col <x> | px <x> <y> | blue-row <y>  [file]");
}
