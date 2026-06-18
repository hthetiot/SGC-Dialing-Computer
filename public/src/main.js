// main.js — Application bootstrap.

import * as glyphsModule from "./glyphs.js";
import { Screen } from "./screen.js";
import { SGCScene } from "./scene.js";
import { HUD } from "./hud.js";
import { buildDebug } from "./debug.js";
import { Phase } from "./dialer.js";
import { Sound } from "./sound.js";

const glCanvas = document.getElementById("gl");
const hudCanvas = document.getElementById("hud");

// Assets are inlined by the build (window.__SGC_LAYOUT__ / __SGC_GATE_SVG__) for the
// self-contained dist/index.html; in dev they're fetched from disk.
const layout = globalThis.__SGC_LAYOUT__
  ?? await (await fetch(new URL("./layout.json", import.meta.url))).json();

// Shared screen-space mapper (reference 1.25:1 → viewport, responsive on other aspects).
const screen = new Screen(layout.ref_aspect ?? 1.25);

const scene = new SGCScene(glCanvas, screen);
const gateSrc = globalThis.__SGC_GATE_SVG__
  ?? new URL("../assets/gate.svg", import.meta.url).href;
await scene.load(gateSrc);
scene.setGateTarget(layout.gate.center, layout.gate.R_outer);
scene._logoBayRef = layout.logo_bay.rect;

const hud = new HUD(hudCanvas, layout, screen);
const debug = buildDebug(scene, hud, glyphsModule);

// Sound (synthesized; unlocked on first user gesture per autoplay policy).
const sound = new Sound();
scene.dialer.sound = (name) => sound.play(name);
scene.sound = sound;
const unlockAudio = () => { sound.unlock(); window.removeEventListener("pointerdown", unlockAudio); window.removeEventListener("keydown", unlockAudio); };
window.addEventListener("pointerdown", unlockAudio);
window.addEventListener("keydown", unlockAudio);

// keep screen mapper in sync on resize (scene/hud also listen, but ensure order)
window.addEventListener("resize", () => { screen.resize(); scene._placeGate(); });

// wire dialer hooks → HUD updates + hero-glyph fly-out to the locked box
scene.hooks.onChevronLock = () => {};
scene.hooks.onPhase = () => {};
scene.hooks.onKawoosh = () => { sound.play("kawoosh"); };
scene.hooks.onReset = () => {};

// --- input ---
let hoverGlyph = -1;
window.addEventListener("pointermove", (e) => {
  if (scene.dialer.phase === Phase.IDLE) {
    hoverGlyph = scene.pickGlyph(e.clientX, e.clientY);
    glCanvas.style.cursor = hoverGlyph >= 0 ? "pointer" : "default";
    // preview-highlight hovered glyph
    for (const m of scene.gate.glyphMeshes) {
      if (m.userData.lit) continue;
      const on = m.userData.index === hoverGlyph;
      m.userData.mat.color.setHex(on ? scene.gate.palette.glyphLit : scene.gate.palette.glyph);
      m.userData.mat.opacity = on ? 1 : 0.9;
    }
  }
});

window.addEventListener("pointerdown", (e) => {
  // If the debug panel is open, the panel handles its own clicks (it stops propagation).
  // Any click reaching here while open is on the canvas — don't let the logo bay (which
  // sits UNDER the open panel) toggle debug closed, and don't pick glyphs behind it.
  if (debug.isOpen()) return;

  // logo click → open debug
  if (scene.isLogoClick(e.clientX, e.clientY)) {
    debug.toggle();
    return;
  }
  if (scene.dialer.phase === Phase.IDLE) {
    const gi = scene.pickGlyph(e.clientX, e.clientY);
    if (gi >= 0) {
      if (scene.dialer.addGlyph(gi)) {
        // mark chosen glyph faintly
        const m = scene.gate.glyphMeshes[gi];
        m.userData.mat.color.setHex(scene.gate.palette.glyphLit);
        m.userData.lit = true; // visually selected (will be confirmed on dial)
        if (scene.dialer.address.length === 7) {
          // auto-dial once 7 are chosen
          // clear the "selected" lit flags so the dial animation re-locks them in order
          for (const idx of scene.dialer.address) {
            const mm = scene.gate.glyphMeshes[idx];
            mm.userData.lit = false;
            mm.userData.mat.color.setHex(scene.gate.palette.glyph);
          }
          scene.dialer.dial();
        }
      }
    }
  }
});

// keyboard: Esc aborts, Backspace removes last, Enter dials
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") scene.dialer.abort();
  if (e.key === "Backspace" && scene.dialer.phase === Phase.IDLE) {
    const last = scene.dialer.address.pop();
    if (last !== undefined) {
      const m = scene.gate.glyphMeshes[last];
      m.userData.lit = false;
      m.userData.mat.color.setHex(scene.gate.palette.glyph);
    }
  }
  if (e.key === "Enter" && scene.dialer.address.length === 7) {
    for (const idx of scene.dialer.address) {
      const mm = scene.gate.glyphMeshes[idx];
      mm.userData.lit = false; mm.userData.mat.color.setHex(scene.gate.palette.glyph);
    }
    scene.dialer.dial();
  }
});

// --- render loop ---
let last = performance.now();
let fpsEMA = 60;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const fps = 1 / Math.max(dt, 1e-3);
  fpsEMA = fpsEMA * 0.9 + fps * 0.1;

  if (!scene._frozen) scene.update(dt);

  const ph = scene.dialer.phase;
  hud.setActivated(ph === Phase.ACTIVE || ph === Phase.KAWOOSH || ph === Phase.DIALED);
  hud.update(dt, {
    address: scene.dialer.address,
    locked: scene.dialer.lockedCount,
    palette: scene.params.palette,
    binarySpeed: scene.params.binarySpeed,
    resultGlyphPaths: scene.resultGlyphPaths(glyphsModule),
    phase: scene.dialer.phase,
    mode: scene.dialer.mode,
    remainingMs: scene.dialer.remainingMs(),
    addressName: scene.dialer.addressName,
  });
  hud.draw();
  scene.render();
  debug.tickStats(fpsEMA);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// PWA service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

console.log("%cSGC Dialing Computer online. Click the SGC emblem (top-left) for debug.",
  "color:#7fd4ff");
