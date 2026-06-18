// dialer.js — the dialing state machine, 38-minute wormhole timer, and mode.
//
// Phases (GATE.md §4) drive the STATUS line:
//   idle      -> STANDBY
//   spinning  -> {OUTGOING|INCOMING} DIALING SEQUENCE   (ring turning toward a glyph)
//   locking   -> "  (chevron engaging)
//   between   -> "  (pause before next)
//   dialed    -> CHEVRONS ENCODED
//   kawoosh   -> WORMHOLE ESTABLISHED
//   active    -> {OUTGOING|INCOMING} WORMHOLE ACTIVE     (38:00 clock runs)
//   aborting  -> DIALING ABORTED
//
// The ring spins, reversing direction per chevron, locking 7 in sequence. After the 7th the
// vortex erupts (kawoosh) then settles into a stable wormhole that runs a 38-minute countdown.

const TAU = Math.PI * 2;
const WORMHOLE_MS = 38 * 60 * 1000;

// timing (ms)
const T = { spin: 1400, lock: 420, between: 320, dialed: 1100, kawoosh: 1700, hold: 9000, abortSpin: 1600 };

export class Dialer {
  constructor({ onLock, onClear } = {}) {
    this.onLock = onLock || (() => {});
    this.onClear = onClear || (() => {});

    this.mode = "outgoing";      // "outgoing" | "incoming"
    this.phase = "idle";
    this.address = null;         // 7 glyph indices
    this.locked = 0;             // chevrons engaged 0..7
    this.ring = 0;               // ring angle (rad)
    this.spinRate = 0;           // rad/ms
    this.dir = -1;               // current spin direction

    this.t = 0;                  // ms elapsed in current step
    this.step = null;            // internal sequence cursor
    this.glyph = -1;             // glyph currently locking (for hero display)

    this.countdownMs = WORMHOLE_MS;
    this.kawooshT = 0;           // 0..1 vortex intensity

    this.clock = { hh: "00", mm: "00", date: "01/01/20", day: "00" };
  }

  get status() {
    const m = this.mode === "incoming" ? "INCOMING" : "OUTGOING";
    switch (this.phase) {
      case "idle": return "STANDBY";
      case "spinning":
      case "locking":
      case "between": return `${m} DIALING SEQUENCE`;
      case "dialed": return "CHEVRONS ENCODED";
      case "kawoosh": return "WORMHOLE ESTABLISHED";
      case "active": return `${m} WORMHOLE ACTIVE`;
      case "aborting": return "DIALING ABORTED";
      default: return "STANDBY";
    }
  }

  startDial(address, mode = "outgoing") {
    if (this.phase !== "idle") return;
    this.mode = mode;
    this.address = address.slice(0, 7);
    this.locked = 0;
    this.dir = -1;
    this.onClear();
    this._enter("spinning", 0);
  }

  abort() {
    if (this.phase === "idle" || this.phase === "aborting") return;
    this._enter("aborting", 0);
  }

  toggleMode() { if (this.phase === "idle") this.mode = this.mode === "outgoing" ? "incoming" : "outgoing"; }

  _enter(phase, glyphIdx) {
    this.phase = phase;
    this.t = 0;
    if (phase === "spinning") {
      this.dir = -this.dir;                       // reverse each chevron
      this.spinRate = (TAU * 0.9) / T.spin;       // ~0.9 turn per spin
      this.glyph = this.address ? this.address[this.locked] : -1;
    } else if (phase === "kawoosh") {
      this.kawooshT = 0;
    } else if (phase === "active") {
      this.countdownMs = WORMHOLE_MS;
    }
  }

  update(dt) {
    this._tickClock();
    if (this.frozen) return;   // a forced ?state= holds the phase for deterministic capture
    this.t += dt;

    switch (this.phase) {
      case "idle":
        this.ring += 0.00004 * dt; // barely-perceptible drift
        break;

      case "spinning":
        this.ring += this.dir * this.spinRate * dt;
        if (this.t >= T.spin) this._enter("locking");
        break;

      case "locking":
        if (!this._lockedThis) {
          this.locked++;
          this.onLock(this.locked, this.glyph);
          this._lockedThis = true;
        }
        if (this.t >= T.lock) {
          this._lockedThis = false;
          this.phase = "between"; this.t = 0;
        }
        break;

      case "between":
        if (this.t >= T.between) {
          if (this.locked >= 7) { this._enter("dialed"); }
          else { this._enter("spinning"); }
        }
        break;

      case "dialed":
        if (this.t >= T.dialed) this._enter("kawoosh");
        break;

      case "kawoosh":
        this.kawooshT = Math.min(1, this.t / (T.kawoosh * 0.45));
        if (this.t > T.kawoosh * 0.55) this.kawooshT = Math.max(0.35, 1 - (this.t - T.kawoosh * 0.55) / (T.kawoosh * 0.45));
        if (this.t >= T.kawoosh) this._enter("active");
        break;

      case "active":
        this.countdownMs -= dt;
        this.ring += 0.00002 * dt;
        if (this.countdownMs <= 0) { this.countdownMs = 0; this._reset(); }
        break;

      case "aborting":
        this.ring -= this.spinRate * 0.8 * dt;
        if (this.t >= T.abortSpin) this._reset();
        break;
    }
  }

  _reset() {
    this.phase = "idle";
    this.locked = 0;
    this.glyph = -1;
    this.address = null;
    this._lockedThis = false;
    this.onClear();
  }

  get countdownText() {
    const ms = Math.max(0, this.countdownMs);
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mmm = Math.floor(ms % 1000);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(mmm).padStart(3, "0")}`;
  }
  get countdownCritical() { return this.phase === "active" && this.countdownMs <= 60000; }

  _tickClock() {
    const d = new Date();
    this.clock.hh = String(d.getHours()).padStart(2, "0");
    this.clock.mm = String(d.getMinutes()).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(0, 2);
    this.clock.date = `${dd}/${mo}/${yy}`;
    this.clock.day = String(d.getFullYear()).slice(2);
  }
}
