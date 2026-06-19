// sound.js — tiny Web-Audio synthesized SFX (offline-capable, no assets). Lazily created on the
// first user gesture so autoplay policies don't block it.

let ctx = null;
const ensure = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

function blip(freq, dur, type = "sine", gain = 0.06) {
  const c = ensure(); if (c.state === "suspended") c.resume();
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur);
}

export const sfx = {
  key() { blip(660, 0.05, "square", 0.03); },
  chevron() { blip(180, 0.18, "square", 0.05); blip(360, 0.12, "sine", 0.04); },
  lock() { blip(90, 0.3, "sawtooth", 0.06); blip(140, 0.25, "square", 0.04); },
  wormhole() {
    const c = ensure(); if (c.state === "suspended") c.resume();
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(120, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(420, c.currentTime + 0.5);
    g.gain.setValueAtTime(0.001, c.currentTime); g.gain.linearRampToValueAtTime(0.1, c.currentTime + 0.2); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.2);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 1.2);
  },
  kawoosh() {
    const c = ensure(); if (c.state === "suspended") c.resume();
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(700, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.8);
    g.gain.setValueAtTime(0.12, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.9);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.9);
  },
};
