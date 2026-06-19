// zoom.js — crop+magnify a source/tmp image, OR grab a frame from a source video, for close review.
// Runtime-agnostic (plain Node APIs). Output -> tmp/zoom/ (cleared each run unless -s to stack).
//
// IMAGE:  node scripts/zoom.js <file.png> [x y w h] [z]
//   node scripts/zoom.js target.png 400 140 680 720 1.6
//
// VIDEO (mp4/webm/mov):  node scripts/zoom.js <file.mp4> <timeSec> [x y w h] [z]
//   node scripts/zoom.js stargate.mp4 33             # full native frame at 33s
//   node scripts/zoom.js stargate.mp4 33 0 0 640 360 # cropped (native px) at 33s
//   The native size is read from the loaded <video> element (videoWidth/videoHeight) — no decode in
//   Node. <file> resolves from source/ then tmp/. OUT=name.png overrides the filename.

import http from "node:http";
import { spawn } from "node:child_process";
import { existsSync, createReadStream, readSync, openSync, closeSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUTDIR = ROOT + "tmp/zoom/";
const STACK = process.argv.includes("-s");
const a = process.argv.slice(2).filter((x) => x !== "-s");
const file = a[0] || "target.png";
const nums = a.slice(1).map(Number).filter((n) => !Number.isNaN(n));
const VID = /\.(mp4|webm|mov|m4v)$/i.test(file);

const resolve = (name) => { for (const base of [ROOT + "source/", ROOT + "tmp/"]) if (existsSync(base + name)) return base + name; return null; };
const inPath = resolve(file);
if (!inPath) { console.error(`✗ not found in source/ or tmp/: ${file}`); process.exit(1); }
mkdirSync(OUTDIR, { recursive: true });
if (!STACK) for (const fn of readdirSync(OUTDIR)) if (fn.endsWith(".png")) rmSync(OUTDIR + fn);
const stem = file.replace(/.*\//, "").replace(/\.[^.]+$/, "");

const findChrome = () => {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
  for (const c of ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]) if (existsSync(c)) return c;
  return "chrome";
};
const CHROME = findChrome();

// server serves a (mutable) page + the asset (image / ranged video) + a /dims report endpoint
let pageHTML = "", dimsResolve;
const dimsPromise = new Promise((r) => (dimsResolve = r));
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"), p = decodeURIComponent(u.pathname);
  if (p === "/_zoom.html") { res.writeHead(200, { "content-type": "text/html" }); res.end(pageHTML); return; }
  if (p === "/dims") { dimsResolve({ w: +u.searchParams.get("w"), h: +u.searchParams.get("h"), d: +u.searchParams.get("d") }); res.writeHead(200); res.end("ok"); return; }
  if (p === "/img") { res.writeHead(200, { "content-type": "image/png" }); createReadStream(inPath).pipe(res); return; }
  if (p === "/vid") {
    const sz = statSync(inPath).size, range = req.headers.range;
    if (range) { const m = /bytes=(\d+)-(\d*)/.exec(range); const s = +m[1], e = m[2] ? +m[2] : sz - 1;
      res.writeHead(206, { "content-type": "video/mp4", "accept-ranges": "bytes", "content-range": `bytes ${s}-${e}/${sz}`, "content-length": e - s + 1 });
      createReadStream(inPath, { start: s, end: e }).pipe(res); return; }
    res.writeHead(200, { "content-type": "video/mp4", "accept-ranges": "bytes", "content-length": sz }); createReadStream(inPath).pipe(res); return;
  }
  res.writeHead(404); res.end("404");
});
await new Promise((r) => server.listen(Number(process.env.PORT ?? 0), r));
const port = server.address().port;
const URL_ = `http://localhost:${port}/_zoom.html`;

function run(extra, budget) {
  return new Promise((res) => {
    const proc = spawn(CHROME, ["--headless=new", "--autoplay-policy=no-user-gesture-required", "--disable-gpu", "--enable-unsafe-swiftshader", "--hide-scrollbars", `--virtual-time-budget=${budget}`, ...extra, URL_], { stdio: "ignore" });
    const timer = setTimeout(() => proc.kill("SIGKILL"), 40000);
    proc.on("error", (e) => { clearTimeout(timer); console.error(e.message); res(-1); });
    proc.on("exit", (c) => { clearTimeout(timer); res(c); });
  });
}

let out, outW, outH;
if (VID) {
  const time = nums[0] || 0, crop = nums.slice(1);
  let cx = 0, cy = 0, cw = 0, ch = 0, z = 1;
  if (crop.length >= 4) { [cx, cy, cw, ch] = crop; z = crop[4] || 1; }

  // PROBE pass — read native size off the loaded <video> element (videoWidth/videoHeight)
  pageHTML = `<!doctype html><meta charset=utf8><body><video id=v muted preload=metadata playsinline></video><script>
    const v=document.getElementById('v');
    v.addEventListener('loadedmetadata',()=>fetch('/dims?w='+v.videoWidth+'&h='+v.videoHeight+'&d='+v.duration));
    v.src='/vid';v.load();</script>`;
  const probe = run([], 4000);
  const nat = await Promise.race([dimsPromise, new Promise((r) => setTimeout(() => r({ w: 0, h: 0, d: 0 }), 9000))]);
  await probe;
  if (!nat.w || !nat.h) { console.error(`✗ could not read video metadata: ${file}`); server.close(); process.exit(1); }
  if (nat.d && time >= nat.d) { console.error(`✗ time ${time}s is past the video duration (${nat.d.toFixed(1)}s): ${file}`); server.close(); process.exit(1); }

  outW = cw ? Math.round(cw * z) : nat.w; outH = ch ? Math.round(ch * z) : nat.h;
  out = process.env.OUT ? OUTDIR + process.env.OUT : `${OUTDIR}${stem}_t${time}${cw ? `_x${cx}_y${cy}_w${cw}_h${ch}` : ""}.png`;
  const draw = cw ? `x.drawImage(v,${cx},${cy},${cw},${ch},0,0,${outW},${outH});` : `x.drawImage(v,0,0,${outW},${outH});`;
  // CAPTURE pass
  pageHTML = `<!doctype html><meta charset=utf8><style>html,body{margin:0;background:#000}</style>
<video id=v muted preload=auto playsinline></video><canvas id=c width=${outW} height=${outH}></canvas><script>
const v=document.getElementById('v'),x=document.getElementById('c').getContext('2d');let done=false;
function grab(){if(done)return;done=true;${draw}document.title='READY';}
function onReady(){ if('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(()=>grab()); else setTimeout(grab,200); }
v.addEventListener('loadeddata',()=>{try{v.currentTime=${time};}catch(e){}});
v.addEventListener('seeked',onReady);
v.src='/vid';v.load();</script>`;
  const code = await run([`--window-size=${outW},${outH}`, `--screenshot=${out}`], 20000);
  console.log(code === 0 && existsSync(out) ? `✓ ${out}  [${nat.w}x${nat.h} @ ${time}s]` : `✗ failed (${code})`);
} else {
  function pngSize(p) { const fd = openSync(p, "r"); const b = Buffer.alloc(24); readSync(fd, b, 0, 24, 0); closeSync(fd); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; }
  const dim = pngSize(inPath);
  let x = 0, y = 0, w = dim.w, h = dim.h, z = 1.5;
  if (nums.length === 1) z = nums[0]; else if (nums.length === 4) [x, y, w, h] = nums; else if (nums.length >= 5) [x, y, w, h, z] = nums;
  outW = Math.round(w * z); outH = Math.round(h * z);
  out = process.env.OUT ? OUTDIR + process.env.OUT : `${OUTDIR}${stem}_x${x}_y${y}_w${w}_h${h}_z${z}.png`;
  pageHTML = `<!doctype html><meta charset=utf8><style>html,body{margin:0;background:#111}</style>
<canvas id=c></canvas><script>const img=new Image();img.onload=()=>{const c=document.getElementById('c');c.width=${outW};c.height=${outH};const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(img,${x},${y},${w},${h},0,0,c.width,c.height);};img.src='/img';</script>`;
  const code = await run([`--window-size=${outW},${outH}`, `--screenshot=${out}`], 900);
  console.log(code === 0 && existsSync(out) ? `✓ ${out}` : `✗ failed (${code})`);
}
server.close(); process.exit(0);
