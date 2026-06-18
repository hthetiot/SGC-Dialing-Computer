// debug.js — lil-gui debug panel. Hidden by default; toggled by clicking the SGC logo.

import GUI from "lil-gui";
import { ADDRESSES } from "./addresses.js";
import { GLYPH_ORDER } from "./glyphs.js";

export function buildDebug(scene, hud, glyphsModule) {
  const gui = new GUI({ title: "SGC // DEBUG", width: 300 });
  gui.domElement.style.position = "fixed";
  gui.domElement.style.top = "96px";
  gui.domElement.style.left = "12px";
  gui.domElement.style.zIndex = "50";
  gui.domElement.style.maxHeight = "calc(100vh - 120px)";
  gui.domElement.style.overflowY = "auto";
  gui.hide();
  let visible = false;

  const dialer = scene.dialer;

  // Close control at the top so the panel can be dismissed (the logo only OPENS it, since
  // the logo sits under the open panel and a toggle there would fight stray clicks).
  const ctl = { closePanel: () => toggle() };
  gui.add(ctl, "closePanel").name("✕ Close debug (or click logo)");

  const state = {
    address: "Abydos",
    manual: GLYPH_ORDER[0],
    mode: "outgoing",
    dial: () => doDial(),
    abort: () => dialer.abort(),
    reset: () => dialer.reset(),
    skipToLocked: () => skipToLocked(),
    clearAddress: () => { dialer.reset(); },
    shutdown: () => dialer.shutdown?.(),
    ffTimer: () => { if (dialer.phase === "active") dialer.gateOpenMs += 60000; }, // +1 min
    jumpTo37: () => { if (dialer.phase === "active") dialer.gateOpenMs = 37 * 60000; },
  };

  // --- Dialing folder ---
  const fDial = gui.addFolder("Dialing");
  fDial.add(state, "address", ADDRESSES.map((a) => a.name)).name("Known address")
    .onChange(() => loadAddress());
  fDial.add(state, "mode", ["outgoing", "incoming"]).name("Mode")
    .onChange((v) => { dialer.mode = v; });
  fDial.add(state, "dial").name("▶ Dial");
  fDial.add(state, "abort").name("✕ Abort");
  fDial.add(state, "reset").name("↺ Reset to idle");
  fDial.add(state, "skipToLocked").name("⏩ Skip to locked");
  fDial.add(state, "shutdown").name("⏻ Shutdown wormhole");
  fDial.add(state, "ffTimer").name("⏱ +1 min (timer)");
  fDial.add(state, "jumpTo37").name("⏱ Jump to 37:00");

  // Manual 7-glyph builder
  const fManual = fDial.addFolder("Manual builder");
  const slotState = { current: 0 };
  for (let s = 0; s < 7; s++) {
    slotState["g" + s] = GLYPH_ORDER[s === 6 ? 0 : s + 1];
    fManual.add(slotState, "g" + s, GLYPH_ORDER).name(`glyph ${s + 1}`);
  }
  fManual.add({ apply: () => {
    const arr = [];
    for (let s = 0; s < 7; s++) arr.push(GLYPH_ORDER.indexOf(slotState["g" + s]));
    dialer.setAddress(arr);
  } }, "apply").name("Apply manual address");

  // --- Animation folder ---
  const fAnim = gui.addFolder("Animation");
  fAnim.add(scene.params, "speed", 0.25, 8, 0.05).name("Speed ×");
  fAnim.add({ fast: false }, "fast").name("Fast preset").onChange((v) => {
    scene.params.speed = v ? 5 : 1;
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  });
  fAnim.add(dialer.timing, "spinPerGlyph", 0.4, 3, 0.05).name("Spin/glyph (s)");
  fAnim.add(dialer.timing, "lockDwell", 0.1, 1.2, 0.05).name("Lock dwell (s)");
  fAnim.add(dialer.timing, "kawoosh", 0.4, 3, 0.05).name("Kawoosh (s)");

  // --- Settings folder ---
  const fSet = gui.addFolder("Settings");
  fSet.add(scene.params, "palette", ["cyan", "red"]).name("Palette")
    .onChange((p) => { scene.setPalette(p); hud.setPalette(p); });
  fSet.add(scene.params, "bloom", 0, 2.5, 0.05).name("Bloom");
  fSet.add(scene.params, "logoSpin", 0, 2, 0.05).name("Logo spin");
  fSet.add(scene.params, "binarySpeed", 0, 4, 0.1).name("Binary speed");
  // sound controls
  const soundParams = { enabled: true, volume: 0.5 };
  fSet.add(soundParams, "enabled").name("Sound").onChange((v) => scene.sound?.setEnabled(v));
  fSet.add(soundParams, "volume", 0, 1, 0.05).name("Volume").onChange((v) => scene.sound?.setVolume(v));

  // --- HUD layers ---
  const fLayers = gui.addFolder("HUD layers");
  for (const k of Object.keys(hud.showLayers)) {
    fLayers.add(hud.showLayers, k).name(k);
  }
  // --- Gate layers ---
  const fGate = gui.addFolder("Gate layers");
  const gateLayerKeys = ["Main_gate_parts", "Inner_Chevron_Delimiters",
    "Outer_Chevron_Delimiters", "Alternative_Detailing", "Chevron_Locks", "Symbols"];
  const gateVis = {};
  for (const k of gateLayerKeys) {
    gateVis[k] = true;
    fGate.add(gateVis, k).name(k.replace(/_/g, " ")).onChange((v) => {
      const obj = scene.gate.layers[k];
      if (obj) obj.visible = v;
    });
  }

  // --- Debug / stats ---
  const fDbg = gui.addFolder("Debug");
  const stats = { fps: 0, phase: "idle", locked: 0, addressLen: 0 };
  fDbg.add(stats, "fps").name("FPS").listen().disable();
  fDbg.add(stats, "phase").name("Phase").listen().disable();
  fDbg.add(stats, "locked").name("Chevrons").listen().disable();
  fDbg.add(stats, "addressLen").name("Address len").listen().disable();
  fDbg.add({ wireframe: false }, "wireframe").name("Glyph wireframe").onChange((v) => {
    for (const m of scene.gate.glyphMeshes) m.traverse((o) => { if (o.isMesh) o.material.wireframe = v; });
  });
  fDbg.add({ freeze: false }, "freeze").name("Freeze anim").onChange((v) => { scene._frozen = v; });

  function loadAddress() {
    const a = ADDRESSES.find((x) => x.name === state.address);
    if (a) { dialer.setAddress(a.glyphs.slice()); dialer.addressName = a.name; }
  }
  function doDial() {
    if (dialer.address.length < 7) loadAddress();
    dialer.dial();
  }
  function skipToLocked() {
    if (dialer.address.length < 7) loadAddress();
    // Instantly light all glyphs and set active
    dialer.lockedCount = 7;
    for (let i = 0; i < 7; i++) {
      const gi = dialer.address[i];
      const mesh = scene.gate.glyphMeshes[gi];
      if (mesh) { mesh.userData.lit = true; mesh.userData.mat.color.setHex(scene.gate.palette.glyphLit); }
    }
    dialer.phase = "active";
  }

  function toggle() {
    visible = !visible;
    visible ? gui.show() : gui.hide();
  }
  function isOpen() { return visible; }

  // Prevent clicks on the debug panel from reaching the canvas pointerdown handler
  // (which would otherwise pick glyphs / toggle the logo underneath the panel).
  gui.domElement.addEventListener("pointerdown", (e) => e.stopPropagation());
  gui.domElement.addEventListener("click", (e) => e.stopPropagation());

  function tickStats(fps) {
    stats.fps = Math.round(fps);
    stats.phase = dialer.phase;
    stats.locked = dialer.lockedCount;
    stats.addressLen = dialer.address.length;
  }

  // open via ?debug
  if (new URLSearchParams(location.search).has("debug")) toggle();

  return { gui, toggle, isOpen, tickStats, loadAddress };
}
