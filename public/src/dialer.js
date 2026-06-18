// dialer.js — The dialing state machine.
//
// Drives the gate through a dial sequence: for each of the 7 picked glyphs, rotate the
// ring so that glyph aligns under the top chevron, pause, "lock" the chevron (light it
// + the result box), then move to the next. After all 7 lock, trigger the kawoosh and
// settle into the active-wormhole state. Supports abort at any point.

import { glyphAngle } from "./gate.js";

export const Phase = {
  IDLE: "idle",
  SPINNING: "spinning",
  LOCKING: "locking",
  DIALED: "dialed",
  KAWOOSH: "kawoosh",
  ACTIVE: "active",
  ABORTING: "aborting",
};

// Default timings (seconds). All scaled by `speed` at runtime.
const DEFAULTS = {
  spinPerGlyph: 1.6, // base time to rotate to a glyph (also scales w/ distance)
  lockDwell: 0.45,   // pause while chevron locks
  betweenGlyphs: 0.25,
  kawoosh: 1.2,
  spinSpeedMax: 3.4, // rad/s cap
};

export class Dialer {
  // Canonical Stargate limit: a wormhole stays open a MAXIMUM of 38 minutes before it
  // destabilizes and shuts down (SG-1 lore). We track the open time in ms.
  static MAX_OPEN_MS = 38 * 60 * 1000; // 2,280,000 ms

  constructor(gate, hooks = {}) {
    this.gate = gate;           // { group, glyphMeshes, ... } from buildGate
    this.hooks = hooks;         // { onChevronLock(i,glyph), onPhase(phase), onKawoosh(), onReset() }
    this.timing = { ...DEFAULTS };
    this.speed = 1;
    this.mode = "outgoing";     // "outgoing" (we dial) | "incoming" (someone dials us)
    this.gateOpenMs = 0;        // elapsed wormhole-open time (ms), counts up to MAX_OPEN_MS
    this.reset();
  }

  // Remaining wormhole time in ms (38:00 countdown), 0 when closed.
  remainingMs() {
    if (this.phase !== Phase.ACTIVE) return Dialer.MAX_OPEN_MS;
    return Math.max(0, Dialer.MAX_OPEN_MS - this.gateOpenMs);
  }

  // Shut the wormhole: return to IDLE, clear the timer and red state.
  shutdown() {
    this.sound?.("abort");
    this.gateOpenMs = 0;
    this.phase = Phase.IDLE;
    this.address = [];
    this.lockedCount = 0;
    this._litGlyphs?.clear?.();
    this.gate?.resetChevrons?.();
    this.gate?.hideCenterEmblem?.();
    this._unlightAll?.();
    if (this.gate?.ringGroup) this.gate.ringGroup.rotation.z = 0;
    this.hooks.onReset?.();
    this.hooks.onPhase?.(this.phase);
  }

  reset() {
    this.phase = Phase.IDLE;
    this.address = [];          // glyph indices the user has chosen
    this.lockedCount = 0;
    this.ringAngle = 0;         // current ring rotation (rad)
    this.targetAngle = 0;
    this._t = 0;                // phase timer
    this._spinFrom = 0;
    this._spinDur = 0;
    this._litGlyphs = new Set();
    this.kawooshT = 0;
    if (this.gate?.ringGroup) this.gate.ringGroup.rotation.z = 0;
    this._unlightAll();
    this.hooks.onReset?.();
    this.hooks.onPhase?.(this.phase);
  }

  _unlightAll() {
    for (const m of this.gate?.glyphMeshes || []) {
      m.userData.lit = false;
      m.userData.mat.color.setHex(this.gate.palette.glyph);
    }
    this.gate?.resetChevrons?.();
    this.gate?.hideCenterEmblem?.();
    this._litGlyphs?.clear?.();
  }

  // --- address building (user clicks) ---
  canEdit() {
    return this.phase === Phase.IDLE && this.address.length < 7;
  }
  addGlyph(i) {
    if (!this.canEdit()) return false;
    if (this.address.includes(i)) return false; // no repeats in an address
    this.address.push(i);
    return true;
  }
  removeLast() {
    if (this.phase !== Phase.IDLE) return;
    this.address.pop();
  }
  setAddress(arr) {
    if (this.phase !== Phase.IDLE && this.phase !== Phase.ACTIVE) this.abort();
    this.reset();
    this.address = arr.slice(0, 7);
  }

  // --- dial / abort ---
  dial() {
    if (this.address.length < 7) return false;
    if (this.phase !== Phase.IDLE) return false;
    this.lockedCount = 0;
    this.sound?.("dial");
    this.gate.showCenterEmblem?.(); // point-of-origin emblem appears in the center
    this._beginSpinTo(0);
    return true;
  }

  abort() {
    if (this.phase === Phase.IDLE) return;
    this.sound?.("abort");
    this.phase = Phase.ABORTING;
    this._t = 0;
    this._spinFrom = this.gate.ringGroup.rotation.z;
    this._spinDur = 0.9 / this.speed;
    this.hooks.onPhase?.(this.phase);
  }

  _beginSpinTo(addrIdx) {
    const glyphIndex = this.address[addrIdx];
    // Alternate spin direction per chevron, like the show.
    const dir = addrIdx % 2 === 0 ? 1 : -1;
    const target = -glyphAngle(glyphIndex) + Math.PI / 2; // bring glyph to top chevron
    // choose an angle that travels at least ~0.6 turn in `dir`
    const a = target;
    const cur = this.gate.ringGroup.rotation.z;
    // normalize so we travel in dir with a decent sweep
    const TWO = Math.PI * 2;
    let delta = ((a - cur) % TWO + TWO) % TWO; // 0..2π forward
    if (dir < 0) delta = delta - TWO;          // make it negative travel
    // ensure a minimum sweep so it reads as a spin
    if (Math.abs(delta) < 1.2) delta += dir * TWO;
    this._spinFrom = cur;
    this._spinTarget = cur + delta;
    this._spinDur = Math.min(
      this.timing.spinPerGlyph * (0.6 + Math.abs(delta) / (Math.PI * 2)),
      3.5
    ) / this.speed;
    this._t = 0;
    this._curAddrIdx = addrIdx;
    this.phase = Phase.SPINNING;
    this.hooks.onPhase?.(this.phase);
  }

  _lockCurrent() {
    const addrIdx = this._curAddrIdx;
    const glyphIndex = this.address[addrIdx];
    const mesh = this.gate.glyphMeshes[glyphIndex];
    if (mesh) {
      mesh.userData.lit = true;
      mesh.userData.mat.color.setHex(this.gate.palette.glyphLit);
      mesh.userData.anim = { t: 0, dur: 0.6 / this.speed };
      this._litGlyphs.add(glyphIndex);
    }
    // turn the CHEVRON LOCK clamp red for this position (lock order index = addrIdx)
    this.gate.setChevronRed?.(addrIdx, true);
    this.lockedCount = addrIdx + 1;
    this.hooks.onChevronLock?.(addrIdx, glyphIndex);
    this.sound?.("lock"); // chevron lock sound
  }

  // easing
  static _ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  update(dt) {
    const g = this.gate.ringGroup;
    switch (this.phase) {
      case Phase.SPINNING: {
        this._t += dt;
        const u = Math.min(this._t / this._spinDur, 1);
        const e = Dialer._ease(u);
        g.rotation.z = this._spinFrom + (this._spinTarget - this._spinFrom) * e;
        if (u >= 1) {
          this.phase = Phase.LOCKING;
          this._t = 0;
          this.hooks.onPhase?.(this.phase);
        }
        break;
      }
      case Phase.LOCKING: {
        this._t += dt;
        if (this._t >= this.timing.lockDwell / this.speed) {
          this._lockCurrent();
          const next = this._curAddrIdx + 1;
          if (next < 7) {
            // brief pause then spin to next
            this._t = 0;
            this._pendingNext = next;
            this.phase = "between";
            this.hooks.onPhase?.(Phase.SPINNING);
          } else {
            this.phase = Phase.DIALED;
            this._t = 0;
            this.hooks.onPhase?.(this.phase);
          }
        }
        break;
      }
      case "between": {
        this._t += dt;
        if (this._t >= this.timing.betweenGlyphs / this.speed) {
          this._beginSpinTo(this._pendingNext);
        }
        break;
      }
      case Phase.DIALED: {
        this._t += dt;
        if (this._t >= 0.4 / this.speed) {
          this.phase = Phase.KAWOOSH;
          this.kawooshT = 0;
          this._t = 0;
          this.hooks.onKawoosh?.();
          this.hooks.onPhase?.(this.phase);
        }
        break;
      }
      case Phase.KAWOOSH: {
        this.kawooshT += dt;
        if (this.kawooshT >= this.timing.kawoosh / this.speed) {
          this.phase = Phase.ACTIVE;
          this.gateOpenMs = 0;            // start the 38-minute wormhole clock
          this.gateOpenStart = Date.now();
          this.hooks.onPhase?.(this.phase);
        }
        break;
      }
      case Phase.ACTIVE: {
        // Wormhole is open. Count elapsed time; a Stargate stays open a MAX of 38 minutes
        // (canonical limit — past this the wormhole destabilizes and shuts down).
        this.gateOpenMs += dt * 1000;
        if (this.gateOpenMs >= Dialer.MAX_OPEN_MS) {
          this.gateOpenMs = Dialer.MAX_OPEN_MS;
          this.shutdown();               // auto-close at 38:00
        }
        break;
      }
      case Phase.ABORTING: {
        this._t += dt;
        const u = Math.min(this._t / this._spinDur, 1);
        const e = Dialer._ease(u);
        g.rotation.z = this._spinFrom * (1 - e); // unwind toward 0
        if (u >= 1) {
          this.reset();
        }
        break;
      }
      default:
        break;
    }
  }

  // kawoosh progress 0..1 for the renderer
  kawooshProgress() {
    if (this.phase !== Phase.KAWOOSH) return this.phase === Phase.ACTIVE ? 1 : 0;
    return Math.min(this.kawooshT / (this.timing.kawoosh / this.speed), 1);
  }
}
