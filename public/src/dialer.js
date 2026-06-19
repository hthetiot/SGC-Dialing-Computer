// dialer.js — state machine + wall clock + 38-min timer + manual address entry (SPECS §4).
// Phases: idle · dialing · dialed · kawoosh · active · aborting. Drives lockedCount (chevrons
// engaged so far, in LOCK_ORDER), ring spin, STATUS text, countdown, the dialed glyph address,
// the hero glyph, and effect progress (kawoosh splash, event-horizon shimmer, glow pulse).
//
// Manual entry: digit(0-9) builds a number, enter() commits glyph 1..39 to the sequence; at 7 it
// auto-dials. back() deletes, clearSeq() resets.

import { ADDRESSES } from "./addresses.js";

const STATUS = {
  idle: "STANDBY", dialing: "DIALING SEQUENCE", dialed: "CHEVRONS ENCODED",
  kawoosh: "WORMHOLE ESTABLISHED", active: "WORMHOLE ACTIVE", aborting: "DIALING ABORTED", entry: "AWAITING ADDRESS",
};
const LOCK_MS = 1400, LOCK_FAST = 320, KAWOOSH_MS = 1500, WORMHOLE_MS = 38 * 60 * 1000;
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function createDialer() {
  let phase = "idle", mode = "outgoing", t0 = 0, lockedCount = 0, ringDeg = 0, forced = null, endAt = 0;
  let address = ADDRESSES.Abydos, seq = [], buf = "", fast = false, lastLock = 0, onLock = null;
  const lockMs = () => fast ? LOCK_FAST : LOCK_MS;
  const pad = (n) => String(n).padStart(2, "0");

  function start(addr) {
    address = Array.isArray(addr) ? addr : (seq.length === 7 ? seq.slice() : mode === "incoming" ? ADDRESSES.Apophis : ADDRESSES.Abydos);
    phase = "dialing"; t0 = performance.now(); lockedCount = 0; lastLock = 0; forced = null;
  }
  function abort() { if (phase === "idle" || phase === "active") { reset(); return; } phase = "aborting"; t0 = performance.now(); }
  function reset() { phase = "idle"; lockedCount = 0; forced = null; }

  // manual address entry
  function digit(c) { if (buf.length < 2) buf += c; }
  function back() { if (buf) buf = buf.slice(0, -1); else seq.pop(); }
  function clearSeq() { seq = []; buf = ""; }
  function enter() {
    const v = parseInt(buf, 10); buf = "";
    if (v >= 1 && v <= 39 && seq.length < 7) { seq.push(v - 1); if (seq.length === 7) start(seq.slice()); }
  }
  function setFast(v) { fast = v; }
  function force(name) {
    forced = name; phase = name; ringDeg = 0;
    if (name === "idle" || name === "dialing") lockedCount = 0; else lockedCount = 7;
    if (name === "active") endAt = performance.now() + WORMHOLE_MS;
  }

  function update(now) {
    if (forced) { if (forced === "active" || forced === "kawoosh") ringDeg += 0.2; return; }
    const dt = now - t0;
    if (phase === "dialing") {
      lockedCount = Math.min(7, Math.floor(dt / lockMs()));
      if (lockedCount > lastLock) { lastLock = lockedCount; onLock && onLock(lockedCount); }
      ringDeg += (lockedCount % 2 ? -1 : 1) * (fast ? 3 : 1.5);
      if (lockedCount >= 7) { phase = "dialed"; t0 = now; }
    } else if (phase === "dialed") { ringDeg += 0.4; if (dt > 650) { phase = "kawoosh"; t0 = now; onLock && onLock(-1); } }
    else if (phase === "kawoosh") { if (dt > KAWOOSH_MS) { phase = "active"; t0 = now; endAt = now + WORMHOLE_MS; onLock && onLock(-2); } }
    else if (phase === "active") { ringDeg += 0.15; if (now >= endAt) reset(); }
    else if (phase === "aborting") { ringDeg -= 4; lockedCount = Math.max(0, lockedCount - 1); if (dt > 1300) reset(); }
  }

  function effects(now) {
    const dt = now - t0;
    const kawoosh = phase === "kawoosh" ? Math.min(1, dt / 420) : 0;          // 0->1 splash ramp
    const eh = (phase === "active" || phase === "kawoosh") ? 1 : phase === "dialed" ? 0.3 : 0;
    return { kawoosh, eh, pulse: 0.5 + 0.5 * Math.sin(now / 260) };
  }

  function state(now = performance.now()) {
    const d = new Date();
    const dir = mode === "incoming" ? "INCOMING" : "OUTGOING";
    const ph = (phase === "idle" && (seq.length || buf)) ? "entry" : phase;
    const status = (ph === "dialing" || ph === "active") ? `STATUS: ${dir} ${STATUS[ph]}` : `STATUS: ${STATUS[ph]}`;
    const heroIdx = (phase === "dialing" && lockedCount > 0) ? address[lockedCount - 1] : -1;
    return {
      phase: ph, rawPhase: phase, mode, lockedCount, ringDeg, fast, countdown: countdown(now), status,
      address, heroIdx, seq: seq.slice(), buf, ...effects(now),
      clockHHMM: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`,
      day: DAYS[d.getDay()],
    };
  }
  function countdown(now) {
    if (phase !== "active") return null;
    const ms = Math.max(0, endAt - now);
    return `${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms / 1000) % 60)}`;
  }

  return {
    start, abort, reset, force, update, state, digit, back, enter, clearSeq, setFast,
    set onLock(f) { onLock = f; },
    get phase() { return phase; }, get fast() { return fast; },
    set mode(m) { mode = m; }, get mode() { return mode; },
  };
}
