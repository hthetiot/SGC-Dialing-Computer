// capture.js — screenshot ONE dialer state to tmp/ for visual comparison.
//
// Self-contained and runtime-agnostic (plain Node APIs — works with `node`, `npm`, or `bun`).
// Starts a static server on ./public, drives headless Chrome via the ?state= deep-link, and
// writes tmp/shot_<state>.png. No need for `bun run dev` to be running.
//
// Usage:
//   node scripts/capture.js            # idle
//   node scripts/capture.js dialed     # one state per call
//   npm run capture -- active
//   CHROME="/path/to/chrome" WIDTH=1490 HEIGHT=1080 node scripts/capture.js dialing
//
// States: idle | dialing | dialed | kawoosh | active  (see public/src/main.js applyForced)

import http from "node:http";
import { spawn } from "node:child_process";
import { mkdirSync, existsSync, createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const PUB = ROOT + "public/";
const TMP = ROOT + "tmp/";
const PORT = Number(process.env.PORT ?? 0); // 0 = ephemeral free port (never collides)
const WIDTH = Number(process.env.WIDTH ?? 1490);
const HEIGHT = Number(process.env.HEIGHT ?? 1080);
const WAIT = Number(process.env.WAIT ?? 1200);

const state = process.argv[2] || "idle";

function findChrome() {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
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

mkdirSync(TMP, { recursive: true });

const server = http.createServer((req, res) => {
  let pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (pathname === "/") pathname = "/index.html";
  const file = PUB + pathname.slice(1);
  if (existsSync(file)) {
    res.writeHead(200, { "content-type": typeFor(pathname), "cache-control": "no-cache" });
    createReadStream(file).pipe(res);
  } else {
    res.writeHead(404); res.end("404");
  }
});

await new Promise((r) => server.listen(PORT, r));
const port = server.address().port;

const chrome = findChrome();
const out = `${TMP}shot_${state}.png`;
const url = `http://localhost:${port}/?state=${encodeURIComponent(state)}`;
const args = [
  "--headless=new", "--disable-gpu", "--enable-unsafe-swiftshader", "--hide-scrollbars",
  `--window-size=${WIDTH},${HEIGHT}`, `--screenshot=${out}`,
  `--virtual-time-budget=${WAIT}`, url,
];

const code = await new Promise((resolve) => {
  const proc = spawn(chrome, args, { stdio: "ignore" });
  const timer = setTimeout(() => proc.kill("SIGKILL"), 30000);
  proc.on("error", (e) => { clearTimeout(timer); console.error(e.message); resolve(-1); });
  proc.on("exit", (c) => { clearTimeout(timer); resolve(c); });
});

console.log(code === 0 && existsSync(out) ? `✓ ${out}` : `✗ failed: ${state} (status ${code}, chrome=${chrome})`);
server.close();
process.exit(0);
