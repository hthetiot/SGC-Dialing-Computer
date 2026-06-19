// grid.js — render tmp/mask.png with a COORDINATE GRID overlay -> tmp/grid.png, then optionally
// emit zoomed TILES (each labeled with its exact pixel bounds) for systematic tile-by-tile reading.
//
//   node scripts/grid.js                 # -> tmp/grid.png (full mask + 50/100px ruler)
//   node scripts/grid.js tiles [cols rows z]   # -> tmp/tile_r{r}_c{c}.png  (default 4x3 @2x)
//
// Grid: faint line every 50px, brighter + labeled every 100px. Read geometry straight off the
// ruler — no guessing which area you're in. Background = the crisp mask (black art on white).

import http from "node:http";
import { spawn } from "node:child_process";
import { readFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SRC = ROOT + "source/";
const TMP = ROOT + "tmp/grid/";
mkdirSync(TMP, { recursive: true });
if (!process.argv.includes("-s")) for (const fn of readdirSync(TMP)) if (fn.endsWith(".png")) rmSync(TMP + fn);
const T = JSON.parse(readFileSync(ROOT + "source/trace.json", "utf8"));
const W = T.canvas.w, H = T.canvas.h;
const TILES = process.argv[2] === "tiles";
const COLS = Number(process.argv[3] || 4), ROWS = Number(process.argv[4] || 3), Z = Number(process.argv[5] || 2);

if (!existsSync(SRC + "mask.png")) { console.error("source/mask.png missing"); process.exit(1); }

const HTML = `<!doctype html><meta charset=utf8><style>html,body{margin:0;background:#fff}</style>
<canvas id=c></canvas><script>
const W=${W},H=${H};
const c=document.getElementById('c');c.width=W;c.height=H;const g=c.getContext('2d');
const img=new Image();
img.onload=()=>{
  g.fillStyle='#fff';g.fillRect(0,0,W,H);
  g.drawImage(img,0,0,W,H);
  // very faint 100px reference dots at intersections + tiny coord labels (no full gridlines —
  // bold lines were misread as HUD geometry). Read coordinates from the small gray ticks.
  g.fillStyle='rgba(0,150,255,.5)';
  for(let x=0;x<=W;x+=100){for(let y=0;y<=H;y+=100){
    g.fillRect(x-3,y,7,1); g.fillRect(x,y-3,1,7);           // tiny + cross
  }}
  g.fillStyle='rgba(0,110,210,.85)';g.font='10px monospace';g.textBaseline='top';
  for(let x=0;x<=W;x+=100){for(let y=0;y<=H;y+=100){g.fillText(x+','+y, x+3, y+2);}}
  window.__ready=1;
};
img.onerror=()=>{g.fillStyle='#400';g.fillRect(0,0,W,H);window.__ready=1;};
img.src='/mask';
</script>`;

const server = http.createServer((req, res) => { const p = new URL(req.url, "http://x").pathname; if (p === "/_g.html") { res.writeHead(200, { "content-type": "text/html" }); res.end(HTML); return; } if (p === "/mask") { res.writeHead(200, { "content-type": "image/png" }); res.end(readFileSync(SRC + "mask.png")); return; } res.writeHead(404); res.end("404"); });
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const findChrome = () => { for (const c of ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"]) if (existsSync(c)) return c; return "chrome"; };
const shot = (out) => new Promise((resolve) => { const proc = spawn(findChrome(), ["--headless=new", "--disable-gpu", "--enable-unsafe-swiftshader", "--hide-scrollbars", `--window-size=${W},${H}`, `--screenshot=${out}`, "--virtual-time-budget=1500", `http://localhost:${port}/_g.html`], { stdio: "ignore" }); const timer = setTimeout(() => proc.kill("SIGKILL"), 30000); proc.on("error", () => { clearTimeout(timer); resolve(-1); }); proc.on("exit", (c) => { clearTimeout(timer); resolve(c); }); });

await shot(TMP + "grid.png");
console.log(`✓ ${TMP}grid.png`);
server.close();

if (TILES) {
  // tile grid.png via zoom.js-style crops using a second headless pass per tile
  const tileW = Math.ceil(W / COLS), tileH = Math.ceil(H / ROWS);
  const gridBuf = readFileSync(TMP + "grid.png");
  const tHTML = (x, y, w, h) => `<!doctype html><meta charset=utf8><style>html,body{margin:0;background:#111}</style><canvas id=c></canvas><script>
  const img=new Image();img.onload=()=>{const c=document.getElementById('c');c.width=${Math.round(w * Z)};c.height=${Math.round(h * Z)};const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(img,${x},${y},${w},${h},0,0,c.width,c.height);window.__r=1;};img.src='/g';</script>`;
  const srv2 = http.createServer((req, res) => { const u = new URL(req.url, "http://x"); if (u.pathname === "/g") { res.writeHead(200, { "content-type": "image/png" }); res.end(gridBuf); return; } res.writeHead(200, { "content-type": "text/html" }); res.end(srv2._html); });
  await new Promise((r) => srv2.listen(0, r));
  const p2 = srv2.address().port;
  for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
    const x = col * tileW, y = r * tileH, w = Math.min(tileW, W - x), h = Math.min(tileH, H - y);
    srv2._html = tHTML(x, y, w, h);
    const out = `${TMP}tile_r${r}_c${col}.png`;
    await new Promise((resolve) => { const proc = spawn(findChrome(), ["--headless=new", "--disable-gpu", "--enable-unsafe-swiftshader", "--hide-scrollbars", `--window-size=${Math.round(w * Z)},${Math.round(h * Z)}`, `--screenshot=${out}`, "--virtual-time-budget=600", `http://localhost:${p2}/t.html`], { stdio: "ignore" }); const timer = setTimeout(() => proc.kill("SIGKILL"), 20000); proc.on("error", () => { clearTimeout(timer); resolve(-1); }); proc.on("exit", () => { clearTimeout(timer); resolve(0); }); });
    console.log(`✓ tile_r${r}_c${col}  [x ${x}-${x + w}, y ${y}-${y + h}]`);
  }
  srv2.close();
}
process.exit(0);
