// diff.js — overlay two tmp/ images to expose layout offsets for pixel-perfect alignment.
//
// Renders A tinted RED and B tinted GREEN (luminance-preserving), added together:
//   yellow = aligned (both)   ·   red = target-only   ·   green = mine-only
// So any positional mismatch shows as separated red/green edges.
//
// Runtime-agnostic (plain Node APIs). Usage:
//   node scripts/diff.js                              # target.png vs shot_idle.png, full
//   node scripts/diff.js target.png shot_dialed.png  # pick the two images
//   node scripts/diff.js target.png shot_idle.png 0 0 1491 180 2   # crop + zoom
//   OUT=diff_head.png node scripts/diff.js target.png shot_idle.png 0 0 1491 180
//
// Output: tmp/diff.png (or tmp/$OUT).

import http from "node:http";
import { spawn } from "node:child_process";
import { existsSync, createReadStream, readSync, openSync, closeSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const TMP = ROOT + "tmp/";
const PORT = Number(process.env.PORT ?? 0);
const OUTNAME = process.env.OUT ?? "diff.png";

const a = process.argv.slice(2);
const fileA = a[0] || "target.png";
const fileB = a[1] || "shot_idle.png";
const nums = a.slice(2).map(Number).filter((n) => !Number.isNaN(n));

for (const f of [fileA, fileB]) if (!existsSync(TMP + f)) { console.error(`✗ not found: tmp/${f}`); process.exit(1); }

function pngSize(p) {
  const fd = openSync(p, "r"); const b = Buffer.alloc(24); readSync(fd, b, 0, 24, 0); closeSync(fd);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
const dim = pngSize(TMP + fileA);
let x = 0, y = 0, w = dim.w, h = dim.h, z = 1;
if (nums.length === 1) z = nums[0];
else if (nums.length === 4) [x, y, w, h] = nums;
else if (nums.length >= 5) [x, y, w, h, z] = nums;

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

const W = Math.round(w * z), H = Math.round(h * z);
const HTML = `<!doctype html><meta charset=utf8><style>html,body{margin:0;background:#000}</style>
<canvas id=c></canvas><script>
function tint(img,color){const o=document.createElement('canvas');o.width=${W};o.height=${H};
const g=o.getContext('2d');g.imageSmoothingEnabled=false;g.filter='grayscale(1) brightness(1.15)';
g.drawImage(img,${x},${y},${w},${h},0,0,${W},${H});g.filter='none';
g.globalCompositeOperation='multiply';g.fillStyle=color;g.fillRect(0,0,${W},${H});return o;}
let A,B,n=0;function go(){if(++n<2)return;const c=document.getElementById('c');c.width=${W};c.height=${H};
const x=c.getContext('2d');const ta=tint(A,'#ff2a2a'),tb=tint(B,'#22ff22');
x.drawImage(ta,0,0);x.globalCompositeOperation='lighter';x.drawImage(tb,0,0);}
A=new Image();A.onload=go;A.src='/a';B=new Image();B.onload=go;B.src='/b';
</script>`;

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/_diff.html") { res.writeHead(200, { "content-type": "text/html" }); res.end(HTML); return; }
  if (p === "/a") { res.writeHead(200, { "content-type": "image/png" }); createReadStream(TMP + fileA).pipe(res); return; }
  if (p === "/b") { res.writeHead(200, { "content-type": "image/png" }); createReadStream(TMP + fileB).pipe(res); return; }
  res.writeHead(404); res.end("404");
});

await new Promise((r) => server.listen(PORT, r));
const port = server.address().port;
const out = TMP + OUTNAME;

const code = await new Promise((resolve) => {
  const proc = spawn(findChrome(), [
    "--headless=new", "--disable-gpu", "--enable-unsafe-swiftshader", "--hide-scrollbars",
    `--window-size=${W},${H}`, `--screenshot=${out}`, "--virtual-time-budget=900",
    `http://localhost:${port}/_diff.html`,
  ], { stdio: "ignore" });
  const timer = setTimeout(() => proc.kill("SIGKILL"), 30000);
  proc.on("error", (e) => { clearTimeout(timer); console.error(e.message); resolve(-1); });
  proc.on("exit", (c) => { clearTimeout(timer); resolve(c); });
});

console.log(code === 0 && existsSync(out)
  ? `✓ ${out}  [red=${fileA} green=${fileB}  crop ${x},${y} ${w}x${h} @${z}x]  yellow=aligned`
  : `✗ failed (status ${code})`);
server.close();
process.exit(0);
