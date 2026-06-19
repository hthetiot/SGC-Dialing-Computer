// debug.js — lil-gui panel, HIDDEN by default, toggled by clicking the SGC logo emblem.
// Lets you drive the phase/mode directly. Loaded lazily so a CDN hiccup never breaks the app.

export async function initDebug(dialer) {
  let gui = null, visible = false;
  const ctrl = { phase: "auto", mode: dialer.mode, dial: () => dialer.start(dialer.mode), abort: () => dialer.abort() };
  try {
    const { GUI } = await import("lil-gui");
    gui = new GUI({ title: "SGC DEBUG" });
    gui.domElement.style.position = "fixed"; gui.domElement.style.top = "8px"; gui.domElement.style.right = "8px"; gui.domElement.style.zIndex = 20;
    gui.add(ctrl, "phase", ["auto", "idle", "dialing", "dialed", "kawoosh", "active"]).onChange((v) => v === "auto" ? dialer.reset() : dialer.force(v));
    gui.add(ctrl, "mode", ["outgoing", "incoming"]).onChange((v) => (dialer.mode = v));
    gui.add(ctrl, "dial"); gui.add(ctrl, "abort");
    gui.domElement.style.display = "none";
  } catch { /* lil-gui unavailable — toggle is a no-op */ }
  return {
    toggle() { if (!gui) return; visible = !visible; gui.domElement.style.display = visible ? "" : "none"; },
  };
}
