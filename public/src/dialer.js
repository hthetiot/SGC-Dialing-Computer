// dialer.js — state machine + wall clock + 38-minute wormhole timer (SPECS §4).
// Phases: idle · dialing · dialed · kawoosh · active · aborting. Drives lockedCount (chevrons
// engaged so far, in LOCK_ORDER), the ring spin, the STATUS text, and the countdown readout.

const STATUS = {
  idle: "STANDBY", dialing: "DIALING SEQUENCE", dialed: "CHEVRONS ENCODED",
  kawoosh: "WORMHOLE ESTABLISHED", active: "WORMHOLE ACTIVE", aborting: "DIALING ABORTED",
};
const LOCK_MS = 1500, KAWOOSH_MS = 1600, WORMHOLE_MS = 38 * 60 * 1000;
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function createDialer() {
  let phase = "idle", mode = "outgoing", t0 = 0, lockedCount = 0, ringDeg = 0, forced = null, endAt = 0;

  const pad = (n) => String(n).padStart(2, "0");

  function start(m = "outgoing") { mode = m; phase = "dialing"; t0 = performance.now(); lockedCount = 0; forced = null; }
  function abort() { if (phase === "idle" || phase === "active") { reset(); return; } phase = "aborting"; t0 = performance.now(); }
  function reset() { phase = "idle"; lockedCount = 0; forced = null; }
  // deep-link: jump to a representative static state for headless capture (?state=…)
  function force(name) {
    forced = name; phase = name; ringDeg = 0;            // hold the ring static for a deterministic capture
    if (name === "idle") lockedCount = 0;
    else if (name === "dialing") lockedCount = 0;        // = target.png: bars lit, nothing locked yet
    else { lockedCount = 7; }                            // dialed/kawoosh/active = all 7
    if (name === "active") endAt = performance.now() + WORMHOLE_MS;
  }

  function update(now) {
    if (forced) return;                                  // deep-link: frozen state (no spin)
    const dt = now - t0;
    if (phase === "dialing") {
      lockedCount = Math.min(7, Math.floor(dt / LOCK_MS));
      ringDeg += (lockedCount % 2 ? -1 : 1) * 1.4;       // spin, reversing per chevron
      if (lockedCount >= 7) { phase = "dialed"; t0 = now; }
    } else if (phase === "dialed") { if (dt > 700) { phase = "kawoosh"; t0 = now; } }
    else if (phase === "kawoosh") { if (dt > KAWOOSH_MS) { phase = "active"; t0 = now; endAt = now + WORMHOLE_MS; } }
    else if (phase === "active") { if (now >= endAt) reset(); }
    else if (phase === "aborting") { ringDeg -= 3; lockedCount = Math.max(0, lockedCount - 1); if (dt > 1400) reset(); }
  }

  function countdown(now) {
    if (phase !== "active") return null;
    const ms = Math.max(0, endAt - now), m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60;
    return `${pad(m)}:${pad(s)}`;
  }

  function state(now = performance.now()) {
    const d = new Date();
    const dir = mode === "incoming" ? "INCOMING" : "OUTGOING";
    const status = (phase === "dialing" || phase === "active") ? `STATUS: ${dir} ${STATUS[phase]}` : `STATUS: ${STATUS[phase]}`;
    return {
      phase, mode, lockedCount, ringDeg, countdown: countdown(now), status,
      clockHHMM: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`,
      day: DAYS[d.getDay()],
    };
  }

  return { start, abort, reset, force, update, state, get phase() { return phase; }, set mode(m) { mode = m; }, get mode() { return mode; } };
}
