// addresses.js — 39-glyph ring order + canonical addresses + the chevron lock sequence.
// (Matches SPECS §2.)

export const GLYPHS = [
  "Origin", "Crater", "Virgo", "Bootes", "Centaurus", "Libra", "Serpens_Caput", "Norma",
  "Scorpius", "Corona_Australis", "Scutum", "Sagittarius", "Aquila", "Microscopium", "Capricornus",
  "Piscis_Austrinus", "Equuleus", "Aquarius", "Pegasus", "Sculptor", "Pisces", "Andromeda",
  "Triangulum", "Aries", "Perseus", "Cetus", "Taurus", "Auriga", "Eridanus", "Orion", "Canis_Minor",
  "Monoceros", "Gemini", "Hydra", "Lynx", "Cancer", "Sextans", "Leo_Minor", "Leo",
];

// 7 glyph indices, point-of-origin (Origin = 0) last.
export const ADDRESSES = {
  Abydos: [27, 7, 15, 32, 12, 30, 0],
  Apophis: [20, 18, 11, 38, 10, 32, 0],
};

// The 9 chevron clamp centre angles (deg, 0 = +X, CCW).
export const CHEVRONS = [90, 50, 10, 330, 290, 250, 210, 170, 130];
// Lock order 1..7 — right side down, skip the bottom pair (250/290), up the left, origin (90) last.
export const LOCK_ORDER = [50, 10, 330, 210, 170, 130, 90];
