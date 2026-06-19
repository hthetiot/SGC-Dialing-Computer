// dialer.js — state machine + wall clock + 38-min timer + manual address entry (SPECS §4).
// Phases: idle · dialing · dialed · kawoosh · active · aborting. Drives lockedCount (chevrons
// engaged so far, in LOCK_ORDER), ring spin, STATUS text, countdown, the dialed glyph address,
// the hero glyph, and effect progress (kawoosh splash, event-horizon shimmer, glow pulse).
//
// Manual entry: digit(0-9) builds a number, enter() commits glyph 1..39 to the sequence; at 7 it
// auto-dials. back() deletes, clearSeq() resets.

import { ADDRESSES, LOCK_ORDER } from "./addresses.js";

const STATUS = {
  idle: "STANDBY", dialing: "DIALING SEQUENCE", dialed: "CHEVRONS ENCODED",
  kawoosh: "WORMHOLE ESTABLISHED", active: "WORMHOLE ACTIVE", aborting: "DIALING ABORTED", entry: "AWAITING ADDRESS",
};
// Dialing rotates at a CONSTANT angular speed (deg/ms), so each chevron takes a different time —
// it depends on how far the ring must turn from the previous glyph to this one. DWELL = the pause
// while the chevron locks. (TV-paced; fast mode for the debug/quick dial.)
const SPEED = 0.11, SPEED_FAST = 0.6, DWELL = 380, DWELL_FAST = 90;
const LOCK_MS = 1400, LOCK_FAST = 320, KAWOOSH_MS = 1500, WORMHOLE_MS = 38 * 60 * 1000;
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function createDialer() {
  let phase = "idle", mode = "outgoing", t0 = 0, lockedCount = 0, ringDeg = 0, forced = null, endAt = 0;
  let address = ADDRESSES.Abydos, seq = [], buf = "", fast = false, lastLock = 0, onLock = null;
  let glyphAngleFn = null, targets = null;     // targets[i] = ring deg that lands address[i-1] on its chevron
  let segStart = null, rotDur = null, totalDialMs = 0, dwellMs = DWELL, frozenMs = 0;
  const pad = (n) => String(n).padStart(2, "0");

  // Absolute ring rotations that bring each dialed glyph under its locking chevron (LOCK_ORDER),
  // alternating spin direction each step and turning the DIRECT distance (≤1 turn) — so the per-step
  // angle, hence time, varies with the previous lock position. Null if glyph angles unknown.
  function buildTargets() {
    if (!glyphAngleFn) return null;
    const t = [0]; let cur = 0;
    for (let i = 0; i < address.length; i++) {
      const a = glyphAngleFn(address[i]);
      if (a == null || !Number.isFinite(a)) return null;
      let next = -LOCK_ORDER[i] - a;                 // align glyph (svg y-down) to chevron angle
      const dir = i % 2 === 0 ? -1 : 1;              // alternate CCW/CW like a real gate
      // keep next within ONE turn of cur in direction dir: dir>0 → (cur, cur+360], dir<0 → [cur-360, cur)
      if (dir > 0) { while (next <= cur) next += 360; while (next > cur + 360) next -= 360; }
      else { while (next >= cur) next -= 360; while (next < cur - 360) next += 360; }
      t.push(next); cur = next;
    }
    return t;
  }
  // Build the per-step rotation schedule at the current speed: constant deg/ms + a fixed lock dwell.
  function computeDial() {
    targets = buildTargets();
    if (!targets) { segStart = null; totalDialMs = 0; return; }
    const speed = fast ? SPEED_FAST : SPEED; dwellMs = fast ? DWELL_FAST : DWELL;
    segStart = [0]; rotDur = []; let acc = 0;
    for (let i = 0; i < 7; i++) { rotDur[i] = Math.abs(targets[i + 1] - targets[i]) / speed; acc += rotDur[i] + dwellMs; segStart[i + 1] = acc; }
    totalDialMs = acc;
  }
  function setGlyphAngle(fn) { glyphAngleFn = fn; }

  // freeze a dial at the end of step n (glyph n aligned under its chevron) — for screenshots/tests
  function freezeStep(n) {
    address = mode === "incoming" ? ADDRESSES.Apophis : ADDRESSES.Abydos;
    computeDial();
    forced = "dialing"; phase = "dialing"; lockedCount = Math.min(7, Math.max(0, n));
    ringDeg = targets ? targets[lockedCount] : 0;
    frozenMs = segStart ? segStart[lockedCount] : 0;
  }

  function start(addr) {
    address = Array.isArray(addr) ? addr : (seq.length === 7 ? seq.slice() : mode === "incoming" ? ADDRESSES.Apophis : ADDRESSES.Abydos);
    phase = "dialing"; t0 = performance.now(); lockedCount = 0; lastLock = 0; forced = null;
    ringDeg = 0; computeDial();
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
  function force(name, secs) {
    forced = name; phase = name; ringDeg = 0;
    if (name === "idle" || name === "dialing") lockedCount = 0; else lockedCount = 7;
    if (name === "active") endAt = performance.now() + (secs > 0 ? secs * 1000 : WORMHOLE_MS);
  }

  function update(now) {
    if (forced) { if (forced === "active" || forced === "kawoosh") ringDeg += 0.2; return; }
    const dt = now - t0;
    if (phase === "dialing") {
      if (!targets) {                                  // fallback: free spin on fixed cadence
        const step = Math.min(7, Math.floor(dt / (fast ? LOCK_FAST : LOCK_MS)));
        lockedCount = step; ringDeg += (step % 2 ? -1 : 1) * (fast ? 3 : 1.5);
        if (lockedCount > lastLock) { lastLock = lockedCount; onLock && onLock(lockedCount); }
        if (lockedCount >= 7) { phase = "dialed"; t0 = now; }
      } else {
        let step = 0; while (step < 7 && dt >= segStart[step + 1]) step++;
        if (step >= 7) { lockedCount = 7; ringDeg = targets[7]; }
        else {
          const local = dt - segStart[step];
          if (local < rotDur[step]) {                  // CONSTANT speed → linear interpolation
            lockedCount = step;
            ringDeg = targets[step] + (targets[step + 1] - targets[step]) * (rotDur[step] ? local / rotDur[step] : 1);
          } else { lockedCount = step + 1; ringDeg = targets[step + 1]; }   // locked, dwelling
        }
        if (lockedCount > lastLock) { lastLock = lockedCount; onLock && onLock(lockedCount); }
        if (lockedCount >= 7 && dt >= totalDialMs) { phase = "dialed"; t0 = now; }
      }
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
    const dialing = phase === "dialing" || phase === "dialed";
    const elapsed = dialing ? (forced ? frozenMs : Math.min(now - t0, totalDialMs || (now - t0))) : 0;
    return {
      phase: ph, rawPhase: phase, mode, lockedCount, ringDeg, fast, countdown: countdown(now), status, t: now,
      timerFrac: phase === "active" ? Math.max(0, Math.min(1, (endAt - now) / WORMHOLE_MS)) : 1,   // 38-min gauge: 1→0
      dialClock: dialing ? `${pad(Math.floor(elapsed / 1000))}.${String(Math.floor(elapsed % 1000)).padStart(3, "0")}` : null,
      address, heroIdx, seq: seq.slice(), buf, ...effects(now),
      clockHHMM: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`,
      day: DAYS[d.getDay()],
    };
  }
  function countdown(now) {
    if (phase !== "active") return null;
    const ms = Math.max(0, endAt - now);
    return `${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms / 1000) % 60)}.${String(Math.floor(ms % 1000)).padStart(3, "0")}`;
  }

  return {
    start, abort, reset, force, update, state, digit, back, enter, clearSeq, setFast, setGlyphAngle, freezeStep,
    set onLock(f) { onLock = f; },
    get phase() { return phase; }, get fast() { return fast; },
    set mode(m) { mode = m; }, get mode() { return mode; },
  };
}
