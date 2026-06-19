// main.js — bootstrap, input, auto-demo, render loop. Ties the recolored gate SVG, the 2D HUD
// canvas, and the Three.js logo emblem together; drives them from the dialer state machine.
//
// Controls: Space = dial/abort · M = toggle mode · A = incoming (Apophis) · click logo = debug.
// Deep-link ?state=idle|dialing|dialed|kawoosh|active forces a phase (used by scripts/capture.js).

import { makeScreen } from "./screen.js";
import { drawHud, transportRects } from "./hud.js";
import { mountGate, setLayout as gateSetLayout, setRotation as gateSetRotation, setLitChevrons as gateSetLit, glyphAngle } from "./gate.js";
import { initLogo, resizeLogo, renderLogo } from "./logo.js";
import { createDialer } from "./dialer.js";
import { GLYPHS, LOCK_ORDER } from "./addresses.js";
import { initDebug } from "./debug.js";
import { sfx } from "./sound.js";

const hud = document.getElementById("hud"), g = hud.getContext("2d");
const logoCanvas = document.getElementById("logo"), host = document.getElementById("gate-host");

let L, dialer, dbg, dpr = 1, demoAt = 0;
// virtual clock — the dialer is driven by `vnow`, which only advances when not paused (so the
// transport can pause/step the whole animation deterministically).
let paused = false, vnow = 0, lastReal = 0, stepMs = 0, prevRing = 0, frames = 0, fpsAt = 0;
const metrics = { fps: 0, loopMs: 0, hudMs: 0, gateMs: 0, gateSpeed: 0, targetIdx: -1, paused: false };
const transport = {
  toggle: () => { paused = !paused; metrics.paused = paused; },               // play/pause the loop
  forward: () => { if (paused) stepMs += 1000 / 60; else dialer.skip(); },     // paused: step a frame · playing: skip a state
  back: () => { if (paused) stepMs -= 1000 / 60; else { dialer.reset(); demoAt = vnow + 700; } }, // paused: step back · playing: reset
};

async function boot() {
  // dist inlines layout as a global (self-contained build); dev fetches the file.
  L = window.__SGC_LAYOUT__ || (await fetch("./assets/layout.json").then((r) => r.json()));
  let gateReady = false;
  try { await mountGate(host); gateReady = true; } catch (e) { console.warn("gate svg:", e); }
  initLogo(logoCanvas);
  dialer = createDialer();
  // feed the dialer each glyph's ring angle so it can rotate the exact glyph under its chevron
  if (gateReady) dialer.setGlyphAngle((idx) => glyphAngle(GLYPHS[idx]));
  dialer.onLock = (n) => {                 // SFX hooks fired by the state machine
    if (n === -1) sfx.kawoosh(); else if (n === -2) sfx.wormhole();
    else if (n > 0) { sfx.chevron(); if (n === 7) sfx.lock(); }
  };
  dbg = await initDebug(dialer);

  const q = new URLSearchParams(location.search);
  const forced = q.get("state"), step = q.get("step");
  if (forced === "dialing" && step != null) dialer.freezeStep(+step);   // ?state=dialing&step=N
  else if (forced) dialer.force(forced, +q.get("secs") || 0);           // ?state=active&secs=N → N s remaining
  if (q.get("debug")) dbg.toggle();

  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (e.code === "Space") { e.preventDefault(); (dialer.phase === "idle" || dialer.phase === "active") ? dialer.start() : dialer.abort(); }
    else if (/^[0-9]$/.test(e.key)) { dialer.digit(e.key); sfx.key(); }       // build a glyph number 1..39
    else if (e.key === "Enter") { dialer.enter(); sfx.key(); }                // commit the glyph
    else if (e.key === "Backspace") { e.preventDefault(); dialer.back(); }
    else if (k === "m") dialer.mode = dialer.mode === "outgoing" ? "incoming" : "outgoing";
    else if (k === "a") { dialer.mode = "incoming"; dialer.start(); }
    else if (k === "f") dialer.setFast(!dialer.fast);                         // fast dial
    else if (k === "c") dialer.clearSeq();
    else if (k === "p") transport.toggle();                                   // pause/resume the loop
    else if (k === "d") dbg.toggle();
  });
  // pointer hit-tests (document-level, since #hud/#logo don't capture): the 3 header transport
  // buttons first, then the SGC logo bay (toggles the debug panel).
  addEventListener("pointerdown", (e) => {
    const M = makeScreen(innerWidth, innerHeight);
    const hit = (r) => e.clientX >= M.x(r.x) && e.clientX <= M.x(r.x + r.w) && e.clientY >= M.y(r.y) && e.clientY <= M.y(r.y + r.h);
    for (const b of transportRects(L)) if (hit(b)) { ({ back: transport.back, play: transport.toggle, fwd: transport.forward })[b.id](); return; }
    if (hit(L.logoBay)) dbg.toggle();
  });
  addEventListener("resize", resize);
  resize();
  document.getElementById("app")?.classList.add("ready");   // reveal: triggers the gate/hud/logo CSS fade-in
  setTimeout(() => document.getElementById("boot")?.remove(), 650);
  if (!forced) demoAt = performance.now() + 2500;   // auto-demo: kick off a dial shortly after load
  requestAnimationFrame(loop);
}

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  const vw = innerWidth, vh = innerHeight;
  hud.width = vw * dpr; hud.height = vh * dpr; hud.style.width = vw + "px"; hud.style.height = vh + "px";
  const M = makeScreen(vw, vh);
  const lb = L.logoBay, x0 = M.x(lb.x), y0 = M.y(lb.y), x1 = M.x(lb.x + lb.w), y1 = M.y(lb.y + lb.h);
  logoCanvas.style.left = x0 + "px"; logoCanvas.style.top = y0 + "px";
  logoCanvas.style.width = (x1 - x0) + "px"; logoCanvas.style.height = (y1 - y0) + "px";
  resizeLogo(x1 - x0, y1 - y0);
  const gp = M.gate(L); gateSetLayout(gp.cx, gp.cy, gp.R);
}

function loop() {
  const real = performance.now();
  if (!lastReal) { lastReal = real; vnow = real; }
  if (!paused) vnow += real - lastReal;        // advance virtual time only while playing
  lastReal = real;
  if (stepMs) { vnow += stepMs; stepMs = 0; }   // single-frame step (forward/back while paused)

  if (demoAt && vnow > demoAt && !paused) { dialer.start(); demoAt = 0; }   // auto-demo (default Abydos)
  dialer.update(vnow);
  const st = dialer.state(vnow);
  metrics.gateSpeed = Math.abs(st.ringDeg - prevRing); prevRing = st.ringDeg;   // deg/frame
  metrics.targetIdx = st.targetIdx;

  const vw = innerWidth, vh = innerHeight, M = makeScreen(vw, vh);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, vw, vh);                 // transparent — lets the gate SVG (below) show through
  const hudStart = performance.now();
  drawHud(g, M, L, st, metrics);
  metrics.hudMs = performance.now() - hudStart;

  const gateStart = performance.now();
  gateSetRotation(st.ringDeg);
  gateSetLit(LOCK_ORDER.slice(0, st.lockedCount || 0));   // turn engaged chevrons red on the SVG
  metrics.gateMs = performance.now() - gateStart;

  renderLogo(vnow / 1000);
  metrics.loopMs = performance.now() - real;
  frames++;
  if (real - fpsAt >= 250) { metrics.fps = Math.round((frames * 1000) / (real - fpsAt)); frames = 0; fpsAt = real; }
  requestAnimationFrame(loop);
}

boot();
