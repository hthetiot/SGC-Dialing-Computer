// debug.js — lil-gui control panel. HIDDEN by default; toggled by clicking the SGC logo
// emblem (see main.js). Toggles HUD layers, switches mode, and triggers dial / abort. Loads
// lazily so a CDN hiccup never blocks the app.

import { ADDRESSES } from "./addresses.js";

export async function initDebug({ hud, dialer, onDial, onAbort }) {
  let GUI;
  try { ({ GUI } = await import("lil-gui")); }
  catch (e) { console.warn("debug: lil-gui unavailable", e); return null; }

  const gui = new GUI({ title: "SGC" });
  const el = gui.domElement;
  el.style.position = "fixed";
  el.style.right = "12px";
  el.style.top = "12px";
  el.style.zIndex = "30";

  const state = {
    mode: dialer.mode,
    address: "Abydos",
    dial() { onDial(ADDRESSES[state.address], state.mode); },
    abort() { onAbort(); },
  };

  gui.add(state, "address", Object.keys(ADDRESSES)).name("address");
  gui.add(state, "mode", ["outgoing", "incoming"]).name("mode").onChange((v) => (dialer.mode = v));
  gui.add(state, "dial").name("▶ dial");
  gui.add(state, "abort").name("■ abort");

  const layers = gui.addFolder("layers");
  for (const k of Object.keys(hud.layers)) layers.add(hud.layers, k);
  layers.close();

  // start hidden — revealed only on SGC-logo click
  let visible = false;
  el.style.display = "none";
  return {
    gui,
    get visible() { return visible; },
    toggle() { visible = !visible; el.style.display = visible ? "" : "none"; },
  };
}
