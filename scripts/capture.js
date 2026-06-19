// capture.js — screenshot via headless Chrome. Two modes:
//   APP STATE (default): render a dialer state through the ?state= deep-link.
//     node scripts/capture.js              # idle
//     node scripts/capture.js active
//     CHROME=… WIDTH=1490 HEIGHT=1080 node scripts/capture.js dialing
//   --mask: load ANY png (from source/ or tmp/) into a canvas and grayscale+threshold it to a crisp
//     B/W mask, browser-side — so we don't need a hand-provided mask. --black sets the polarity.
//     node scripts/capture.js target.png --mask           # white line-art on black, thr 48
//     node scripts/capture.js target.png --mask --black 60 # black line-art on white, thr 60
//     → tmp/mask/<stem>_t<thr>[_black].png
//
// States: idle | dialing | dialed | kawoosh | active

import http from "node:http";
import { spawn } from "node:child_process";
import { mkdirSync, existsSync, createReadStream, openSync, readSync, closeSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const PUB = ROOT + "public/";
const SRC = ROOT + "source/";
const TMP = ROOT + "tmp/";
const PORT = Number(process.env.PORT ?? 0); // 0 = ephemeral free port (never collides)
const WIDTH = Number(process.env.WIDTH ?? 1491);   // match target.png exactly
const HEIGHT = Number(process.env.HEIGHT ?? 1074);
const WAIT = Number(process.env.WAIT ?? 1200);

const argv = process.argv.slice(2);
const mask = argv.includes("--mask");
const black = argv.includes("--black");                       // polarity: black line-art on white (else white-on-black)
const thr = Number(argv.find((a) => /^\d+$/.test(a))) || 48;  // luminance threshold
const arg = argv.find((a) => !a.startsWith("--") && !/^\d+$/.test(a)) || (mask ? "target.png" : "idle");

function findChrome() {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return "chrome";
}

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".webp": "image/webp", ".webmanifest": "application/manifest+json",
  ".css": "text/css; charset=utf-8",
};
const typeFor = (p) => TYPES[p.slice(p.lastIndexOf("."))] ?? "application/octet-stream";
function pngSize(p) { const fd = openSync(p, "r"); const b = Buffer.alloc(24); readSync(fd, b, 0, 24, 0); closeSync(fd); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; }

mkdirSync(TMP, { recursive: true });

// --mask: resolve the image to threshold + build the canvas page that does grayscale+threshold
let maskPath = null, mw = WIDTH, mh = HEIGHT, maskPage = "";
if (mask) {
  maskPath = [SRC, TMP].map((b) => b + arg).find(existsSync);
  if (!maskPath) { console.error(`✗ not found in source/ or tmp/: ${arg}`); process.exit(1); }
  ({ w: mw, h: mh } = pngSize(maskPath));
  maskPage = `<!doctype html><meta charset=utf8><style>html,body{margin:0;padding:0}</style>
<canvas id=c width=${mw} height=${mh}></canvas><script>
const img=new Image();img.onload=()=>{const x=document.getElementById('c').getContext('2d',{willReadFrequently:true});
  x.drawImage(img,0,0,${mw},${mh});const d=x.getImageData(0,0,${mw},${mh}),p=d.data;
  for(let i=0;i<p.length;i+=4){const lum=0.299*p[i]+0.587*p[i+1]+0.114*p[i+2];const on=lum>${thr};
    const v=(on===${black})?0:255;p[i]=p[i+1]=p[i+2]=v;p[i+3]=255;}
  x.putImageData(d,0,0);document.title='READY';};img.src='/img';</script>`;
}

const server = http.createServer((req, res) => {
  let pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (mask && pathname === "/_mask.html") { res.writeHead(200, { "content-type": "text/html" }); res.end(maskPage); return; }
  if (mask && pathname === "/img") { res.writeHead(200, { "content-type": "image/png" }); createReadStream(maskPath).pipe(res); return; }
  if (pathname === "/") pathname = "/index.html";
  const file = PUB + pathname.slice(1);
  if (existsSync(file)) { res.writeHead(200, { "content-type": typeFor(pathname), "cache-control": "no-cache" }); createReadStream(file).pipe(res); }
  else { res.writeHead(404); res.end("404"); }
});

await new Promise((r) => server.listen(PORT, r));
const port = server.address().port;
const chrome = findChrome();

let out, url, win;
if (mask) {
  const stem = arg.replace(/.*\//, "").replace(/\.[^.]+$/, "");
  mkdirSync(TMP + "mask/", { recursive: true });
  out = `${TMP}mask/${stem}_t${thr}${black ? "_black" : ""}.png`;
  url = `http://localhost:${port}/_mask.html`;
  win = `${mw},${mh}`;
} else {
  out = `${TMP}shot_${arg}.png`;
  url = `http://localhost:${port}/?state=${encodeURIComponent(arg)}`;
  win = `${WIDTH},${HEIGHT}`;
}
const cargs = ["--headless=new", "--disable-gpu", "--enable-unsafe-swiftshader", "--hide-scrollbars",
  `--window-size=${win}`, `--screenshot=${out}`, `--virtual-time-budget=${WAIT}`, url];

const code = await new Promise((resolve) => {
  const proc = spawn(chrome, cargs, { stdio: "ignore" });
  const timer = setTimeout(() => proc.kill("SIGKILL"), 30000);
  proc.on("error", (e) => { clearTimeout(timer); console.error(e.message); resolve(-1); });
  proc.on("exit", (c) => { clearTimeout(timer); resolve(c); });
});

const tag = mask ? `mask ${arg} (thr ${thr}${black ? ", black-on-white" : ", white-on-black"})` : arg;
console.log(code === 0 && existsSync(out) ? `✓ ${out}  [${tag}]` : `✗ failed: ${tag} (status ${code}, chrome=${chrome})`);
server.close();
process.exit(0);
