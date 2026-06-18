// sound.js — Synthesized SFX via Web Audio (no external files; works offline in the PWA).
// Sounds are generated procedurally: chevron lock (mechanical clunk), ring spin (low rumble),
// kawoosh (whoosh + splash), dial start (beep). Call sound.unlock() on first user gesture to
// satisfy autoplay policies.

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this._spinNode = null;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  setEnabled(v) { this.enabled = v; if (!v) this.stopSpin(); }
  setVolume(v) { if (this.master) this.master.gain.value = v; }

  _now() { return this.ctx ? this.ctx.currentTime : 0; }

  play(name) {
    if (!this.enabled || !this.ctx) return;
    switch (name) {
      case "lock": return this._lock();
      case "kawoosh": return this._kawoosh();
      case "dial": return this._dial();
      case "abort": return this._abort();
      default: return;
    }
  }

  // mechanical chevron lock: a short noise burst + low thunk
  _lock() {
    const t = this._now();
    // thunk (low sine drop)
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.16);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.24);
    // metallic noise tick
    const nb = this._noiseBuffer(0.12);
    const ns = this.ctx.createBufferSource(); ns.buffer = nb;
    const nf = this.ctx.createBiquadFilter(); nf.type = "bandpass";
    nf.frequency.value = 2200; nf.Q.value = 0.8;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.4, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    ns.connect(nf).connect(ng).connect(this.master);
    ns.start(t); ns.stop(t + 0.12);
  }

  // kawoosh: rising whoosh then splash
  _kawoosh() {
    const t = this._now();
    const nb = this._noiseBuffer(1.4);
    const ns = this.ctx.createBufferSource(); ns.buffer = nb;
    const lp = this.ctx.createBiquadFilter(); lp.type = "lowpass";
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(4500, t + 0.5);
    lp.frequency.exponentialRampToValueAtTime(600, t + 1.3);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    ns.connect(lp).connect(g).connect(this.master);
    ns.start(t); ns.stop(t + 1.4);
    // low boom under it
    const o = this.ctx.createOscillator(); const og = this.ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(80, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.8);
    og.gain.setValueAtTime(0.0001, t + 0.4);
    og.gain.exponentialRampToValueAtTime(0.5, t + 0.6);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    o.connect(og).connect(this.master);
    o.start(t); o.stop(t + 1.2);
  }

  _dial() {
    const t = this._now();
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(660, t);
    o.frequency.setValueAtTime(880, t + 0.08);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.2);
  }

  _abort() {
    const t = this._now();
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(400, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.3);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.32);
  }

  // continuous ring-spin rumble; call startSpin()/stopSpin()
  startSpin() {
    if (!this.enabled || !this.ctx || this._spinNode) return;
    const t = this._now();
    const nb = this._noiseBuffer(2, true);
    const ns = this.ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
    const lp = this.ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 220;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.3);
    ns.connect(lp).connect(g).connect(this.master);
    ns.start(t);
    this._spinNode = { ns, g };
  }

  stopSpin() {
    if (!this._spinNode) return;
    const { ns, g } = this._spinNode;
    const t = this._now();
    try {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      ns.stop(t + 0.25);
    } catch { /* already stopped */ }
    this._spinNode = null;
  }

  _noiseBuffer(seconds, loopable = false) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}
