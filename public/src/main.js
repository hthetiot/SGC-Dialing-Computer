// main.js — bootstrap, input, auto-demo, render loop. Ties the recolored gate SVG, the 2D HUD
// canvas, and the Three.js logo emblem together; drives them from the dialer state machine.
//
// Controls: Space = dial/abort · M = toggle mode · A = incoming (Apophis) · click logo = debug.
// Deep-link ?state=idle|dialing|dialed|kawoosh|active forces a phase (used by scripts/capture.js).

import { makeScreen } from "./screen.js";
import { drawHud } from "./hud.js";
import { mountGate, setLayout as gateSetLayout, setRotation as gateSetRotation, setLitChevrons as gateSetLit, glyphAngle } from "./gate.js";
import { initLogo, resizeLogo, renderLogo } from "./logo.js";
import { createDialer } from "./dialer.js";
import { GLYPHS, LOCK_ORDER } from "./addresses.js";
import { initDebug } from "./debug.js";
import { sfx } from "./sound.js";

const hud = document.getElementById("hud"), g = hud.getContext("2d");
const logoCanvas = document.getElementById("logo"), host = document.getElementById("gate-host");

let L, dialer, dbg, dpr = 1, demoAt = 0;

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
    else if (k === "d") dbg.toggle();
  });
  // click the SGC logo emblem -> debug panel. The #logo canvas is pointer-events:none, so hit-test
  // the logo-bay rect at the document level instead of relying on canvas layering.
  addEventListener("pointerdown", (e) => {
    const M = makeScreen(innerWidth, innerHeight), lb = L.logoBay;
    if (e.clientX >= M.x(lb.x) && e.clientX <= M.x(lb.x + lb.w) && e.clientY >= M.y(lb.y) && e.clientY <= M.y(lb.y + lb.h)) dbg.toggle();
  });
  addEventListener("resize", resize);
  resize();
  document.getElementById("boot")?.remove();
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
  const now = performance.now();
  if (demoAt && now > demoAt) { dialer.start(); demoAt = 0; }   // start() = default address (Abydos); never pass the mode here
  dialer.update(now);
  const st = dialer.state(now);
  const vw = innerWidth, vh = innerHeight, M = makeScreen(vw, vh);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, vw, vh);                 // transparent — lets the gate SVG (below) show through
  drawHud(g, M, L, st);

  gateSetRotation(st.ringDeg);
  gateSetLit(LOCK_ORDER.slice(0, st.lockedCount || 0));   // turn engaged chevrons red on the SVG
  renderLogo(now / 1000);
  requestAnimationFrame(loop);
}

boot();
