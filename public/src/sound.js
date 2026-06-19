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
  chevron() { blip(180, 0.18, "square", 0.05); blip(360, 0.12, "sine", 0.04); },
  lock() { blip(90, 0.3, "sawtooth", 0.06); },
  kawoosh() {
    const c = ensure(); if (c.state === "suspended") c.resume();
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(700, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.8);
    g.gain.setValueAtTime(0.12, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.9);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.9);
  },
};
