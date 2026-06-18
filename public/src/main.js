// main.js — bootstrap, input, and the render loop.
//
// Wires the authentic gate vector, the 2D HUD, the 3D emblem, the dialer state machine, and
// synthesized sound together. Runs an auto-demo dial so the screen looks alive on load; user
// input (Space / click) takes over and enables audio.

import { Screen } from "./screen.js";
import { Gate } from "./gate.js";
import { Hud } from "./hud.js";
import { Logo } from "./logo.js";
import { Dialer } from "./dialer.js";
import { Sound } from "./sound.js";
import { ADDRESSES } from "./addresses.js";
import { initDebug } from "./debug.js";

async function loadLayout() {
  if (window.__SGC_LAYOUT__) return window.__SGC_LAYOUT__;
  const res = await fetch("./src/layout.json");
  return res.json();
}

async function main() {
  const layout = await loadLayout();
  const screen = new Screen(layout);

  const hudCanvas = document.getElementById("hud");
  const ctx = hudCanvas.getContext("2d");

  const sound = new Sound();
  const lockOrder = layout.gate.lockOrder;

  const gate = new Gate(document.getElementById("gate-host"));
  const dialer = new Dialer({
    onLock: (count, _glyph) => {
      const ang = lockOrder[count - 1];
      if (ang !== undefined) gate.setChevronLit(ang, true);
      sound.lock();
    },
    onClear: () => gate.clearLocks(),
  });
  const hud = new Hud(layout, dialer);
  const logo = new Logo(document.getElementById("logo")).init();

  await gate.init();

  // size everything
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    screen.resize(vw, vh, dpr);
    hudCanvas.width = Math.round(vw * dpr);
    hudCanvas.height = Math.round(vh * dpr);
    hudCanvas.style.width = vw + "px";
    hudCanvas.style.height = vh + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gate.layout(screen);
    logo.layout(screen.rect(layout.header.logoBay), dpr);
  }
  window.addEventListener("resize", resize);
  resize();

  // input
  function enableAudio() { sound.enable(); }
  function dial(addr = ADDRESSES.Abydos, mode = dialer.mode) { dialer.startDial(addr, mode); }
  window.addEventListener("pointerdown", () => { enableAudio(); }, { once: false });
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); enableAudio(); dialer.phase === "idle" ? dial() : dialer.abort(); }
    else if (e.code === "KeyM") dialer.toggleMode();
    else if (e.code === "KeyA") { enableAudio(); dial(ADDRESSES.Apophis, "incoming"); }
  });

  const dbg = await initDebug({ hud, dialer, onDial: (a, m) => dial(a, m), onAbort: () => dialer.abort() });
  // The SGC logo emblem is the debug-panel toggle. Hit-test the logo bay so it works whether
  // or not the WebGL emblem mounted.
  const logoEl = document.getElementById("logo");
  if (logoEl) logoEl.style.cursor = "pointer";
  window.addEventListener("click", (e) => {
    if (!dbg) return;
    const r = screen.rect(layout.header.logoBay);
    if (e.clientX >= r.x && e.clientX <= r.x + r.w && e.clientY >= r.y && e.clientY <= r.y + r.h) {
      dbg.toggle();
    }
  });

  // Deterministic state deep-link for verification/screenshots: ?state=idle|dialing|dialed|
  // kawoosh|active freezes the dialer in that phase (auto-demo disabled).
  const forced = new URLSearchParams(location.search).get("state");
  function setLocks(n) {
    gate.clearLocks();
    for (let i = 0; i < Math.min(n, 7); i++) { const a = lockOrder[i]; if (a !== undefined) gate.setChevronLit(a, true); }
  }
  function applyForced(name) {
    dialer.frozen = true;
    dialer.address = ADDRESSES.Abydos;
    switch (name) {
      case "dialing": dialer.phase = "between"; dialer.locked = 4; setLocks(4); break;
      case "dialed": dialer.phase = "dialed"; dialer.locked = 7; setLocks(7); break;
      case "kawoosh": dialer.phase = "kawoosh"; dialer.locked = 7; dialer.kawooshT = 1; setLocks(7); break;
      case "active": dialer.phase = "active"; dialer.locked = 7; dialer.countdownMs = 38 * 60 * 1000; setLocks(7); break;
      default: dialer.phase = "idle"; dialer.locked = 0; setLocks(0); break;
    }
  }
  if (forced) applyForced(forced);

  // auto-demo: kick off a dial, and keep the screen alive by re-dialing when idle
  let demoTimer = 1500;
  let prevPhase = dialer.phase;

  // render loop
  const boot = document.getElementById("boot");
  let last = performance.now();
  let booted = false;

  function frame(now) {
    let dt = now - last; last = now;
    if (dt > 80) dt = 80; // clamp after tab-away

    // auto-demo scheduling (disabled when a state is forced)
    if (!forced && dialer.phase === "idle") {
      demoTimer -= dt;
      if (demoTimer <= 0) { dial(ADDRESSES.Abydos, "outgoing"); demoTimer = 6000; }
    } else demoTimer = 6000;

    dialer.update(dt);

    // phase-transition side effects
    if (dialer.phase !== prevPhase) {
      if (dialer.phase === "kawoosh") sound.kawoosh();
      if (dialer.phase === "aborting") sound.abort();
      prevPhase = dialer.phase;
    }

    gate.setRotation(dialer.ring);
    hud.update(dt);
    ctx.clearRect(0, 0, screen.vw, screen.vh);
    hud.draw(ctx, screen);
    logo.update(dt);

    if (!booted) { booted = true; if (boot) boot.remove(); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // PWA service worker (best-effort)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  const boot = document.getElementById("boot");
  if (boot) boot.textContent = "ERROR: " + err.message;
});
