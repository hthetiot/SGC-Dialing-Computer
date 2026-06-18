// sound.js — Web-Audio synthesized SFX. No asset files (offline-capable). Must be enabled
// from a user gesture (browsers block autoplay). Calls are no-ops until enabled.

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.hum = null;
  }

  enable() {
    if (this.enabled) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    this.enabled = true;
  }
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); }

  _env(node, gain, t0, attack, decay, peak = 1) {
    const g = node.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0, t0);
    g.linearRampToValueAtTime(peak * gain, t0 + attack);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  lock() {
    if (!this.enabled) return; this.resume();
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.18);
    const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900;
    o.connect(f); f.connect(g); g.connect(this.master);
    this._env(g, 0.9, t, 0.005, 0.22); o.start(t); o.stop(t + 0.3);
    // metallic clank
    const o2 = c.createOscillator(), g2 = c.createGain();
    o2.type = "square"; o2.frequency.value = 320;
    o2.connect(g2); g2.connect(this.master); this._env(g2, 0.25, t, 0.001, 0.08); o2.start(t); o2.stop(t + 0.1);
  }

  kawoosh() {
    if (!this.enabled) return; this.resume();
    const c = this.ctx, t = c.currentTime;
    const buf = c.createBuffer(1, c.sampleRate * 1.6, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.5); f.Q.value = 1.2;
    const g = c.createGain();
    src.connect(f); f.connect(g); g.connect(this.master);
    this._env(g, 1.0, t, 0.08, 1.4, 1); src.start(t);
  }

  abort() {
    if (!this.enabled) return; this.resume();
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(80, t + 0.5);
    o.connect(g); g.connect(this.master); this._env(g, 0.7, t, 0.01, 0.55); o.start(t); o.stop(t + 0.6);
  }
}
