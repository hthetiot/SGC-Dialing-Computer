// zoom.js — zoom into any tmp/ image (crop + magnify) for close visual review.
//
// Runtime-agnostic (plain Node APIs — works with `node`, `npm`, or `bun`). Serves the tmp/
// folder + a tiny canvas page, drives headless Chrome to render the crop, writes tmp/zoom.png.
//
// Usage:
//   node scripts/zoom.js <file> [x y w h] [z]
//   node scripts/zoom.js target.png                 # whole image
//   node scripts/zoom.js target.png 2.0             # whole image, 2x
//   node scripts/zoom.js shot_idle.png 0 0 1491 180 # header strip
//   node scripts/zoom.js target.png 400 140 680 720 1.6   # gate region, 1.6x
//   OUT=gate.png node scripts/zoom.js target.png 400 140 680 720   # custom output name
//
// Output: tmp/zoom.png (or tmp/$OUT). States/screenshots come from `npm run capture`.

import http from "node:http";
import { spawn } from "node:child_process";
import { existsSync, createReadStream, readSync, openSync, closeSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const TMP = ROOT + "tmp/";
const PORT = Number(process.env.PORT ?? 0);
const OUTNAME = process.env.OUT ?? "zoom.png";

const a = process.argv.slice(2);
const file = a[0] || "target.png";
const nums = a.slice(1).map(Number).filter((n) => !Number.isNaN(n));

if (!existsSync(TMP + file)) { console.error(`✗ not found: tmp/${file}`); process.exit(1); }

// PNG IHDR dimensions (big-endian uint32 @ offset 16/20)
function pngSize(p) {
  const fd = openSync(p, "r"); const b = Buffer.alloc(24); readSync(fd, b, 0, 24, 0); closeSync(fd);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
const dim = pngSize(TMP + file);

// arg forms: [] | [z] | [x y w h] | [x y w h z]
let x = 0, y = 0, w = dim.w, h = dim.h, z = 1.5;
if (nums.length === 1) { z = nums[0]; }
else if (nums.length === 4) { [x, y, w, h] = nums; z = 1.5; }
else if (nums.length >= 5) { [x, y, w, h, z] = nums; }

const findChrome = () => {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
  for (const c of [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ]) if (existsSync(c)) return c;
  return "chrome";
};

const HTML = `<!doctype html><meta charset=utf8><style>html,body{margin:0;background:#111}</style>
<canvas id=c></canvas><script>
const img=new Image();img.onload=()=>{const c=document.getElementById('c');
c.width=${Math.round(w * z)};c.height=${Math.round(h * z)};
const x=c.getContext('2d');x.imageSmoothingEnabled=false;
x.drawImage(img,${x},${y},${w},${h},0,0,c.width,c.height);};img.src='/img';
</script>`;

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/_zoom.html") { res.writeHead(200, { "content-type": "text/html" }); res.end(HTML); return; }
  if (p === "/img") { res.writeHead(200, { "content-type": "image/png" }); createReadStream(TMP + file).pipe(res); return; }
  res.writeHead(404); res.end("404");
});

await new Promise((r) => server.listen(PORT, r));
const port = server.address().port;
const out = TMP + OUTNAME;

const code = await new Promise((resolve) => {
  const proc = spawn(findChrome(), [
    "--headless=new", "--disable-gpu", "--enable-unsafe-swiftshader", "--hide-scrollbars",
    `--window-size=${Math.round(w * z)},${Math.round(h * z)}`,
    `--screenshot=${out}`, "--virtual-time-budget=900",
    `http://localhost:${port}/_zoom.html`,
  ], { stdio: "ignore" });
  const timer = setTimeout(() => proc.kill("SIGKILL"), 30000);
  proc.on("error", (e) => { clearTimeout(timer); console.error(e.message); resolve(-1); });
  proc.on("exit", (c) => { clearTimeout(timer); resolve(c); });
});

console.log(code === 0 && existsSync(out)
  ? `✓ ${out}  [${file} crop ${x},${y} ${w}x${h} @${z}x]`
  : `✗ failed (status ${code})`);
server.close();
process.exit(0);
