// debug.js — lil-gui panel, HIDDEN by default, toggled by clicking the SGC logo emblem (or D key).
// Drive the phase/mode, fast-dial, address presets, and manual-entry directly. Loaded lazily so a
// CDN hiccup never breaks the app.

import { ADDRESSES } from "./addresses.js";

export async function initDebug(dialer) {
  let gui = null, visible = false;
  const ctrl = {
    phase: "auto", mode: dialer.mode, fast: dialer.fast, speed: dialer.speedScale,
    dial: () => dialer.start(), abort: () => dialer.abort(), clear: () => dialer.clearSeq(),
    Abydos: () => dialer.start(ADDRESSES.Abydos), Apophis: () => dialer.start(ADDRESSES.Apophis),
  };
  try {
    const { GUI } = await import("lil-gui");
    gui = new GUI({ title: "SGC DEBUG" });
    Object.assign(gui.domElement.style, { position: "fixed", top: "8px", right: "8px", zIndex: 20, display: "none" });
    gui.add(ctrl, "phase", ["auto", "idle", "dialing", "dialed", "kawoosh", "active"]).onChange((v) => v === "auto" ? dialer.reset() : dialer.force(v));
    gui.add(ctrl, "mode", ["outgoing", "incoming"]).onChange((v) => (dialer.mode = v));
    gui.add(ctrl, "fast").name("fast dial").onChange((v) => dialer.setFast(v));
    // speed range: 0.3 = slow / cinematic … 1 = normal … 3 = fast. Applies to the next dial.
    gui.add(ctrl, "speed", 0.3, 3, 0.05).name("dial speed").onChange((v) => dialer.setSpeedScale(v));
    gui.add({ slow: () => { ctrl.speed = 0.4; dialer.setSpeedScale(0.4); gui.controllers.forEach((c) => c.updateDisplay()); } }, "slow").name("slow preset");
    gui.add(ctrl, "dial").name("DIAL (Space)");
    gui.add(ctrl, "abort").name("ABORT");
    const a = gui.addFolder("address");
    a.add(ctrl, "Abydos").name("dial Abydos");
    a.add(ctrl, "Apophis").name("dial Apophis");
    a.add(ctrl, "clear").name("clear entry (C)");
    gui.add({ help: "type 1-39 + Enter per glyph" }, "help").disable();
  } catch (e) { console.warn("lil-gui:", e); }
  return { toggle() { if (!gui) return; visible = !visible; gui.domElement.style.display = visible ? "" : "none"; } };
}
