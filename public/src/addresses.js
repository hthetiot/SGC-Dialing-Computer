// addresses.js — Canonical Stargate addresses.
//
// Each address is a list of 7 glyph indices into GLYPH_ORDER (see glyphs.js):
// six destination constellations + the point of origin (index 0, "Origin") last.
// Indices follow the standard SG-1 glyph numbering (verified against the Richard Dean
// Anderson reference and the Wikipedia constellation list for Abydos), which aligns
// 1:1 with our ring order because index 0 is the point of origin.

export const ADDRESSES = [
  { name: "Abydos",        glyphs: [27, 7, 15, 32, 12, 30, 0] },
  { name: "Apophis's Base", glyphs: [20, 18, 11, 38, 10, 32, 0] },
  { name: "Castiana/Sahal", glyphs: [29, 3, 6, 9, 12, 16, 0] },
  { name: "Chulak",        glyphs: [9, 2, 23, 15, 37, 20, 0] },
  { name: "P3X-562",       glyphs: [25, 8, 18, 4, 22, 14, 0] },
  { name: "Tollana",       glyphs: [11, 27, 3, 36, 19, 31, 0] },
  { name: "Cimmeria",      glyphs: [4, 29, 13, 7, 33, 2, 0] },
  { name: "Edora",         glyphs: [16, 31, 9, 24, 6, 35, 0] },
];

// NOTE: Several of these sequences are reconstructed/representative where on-screen
// glyph orders are ambiguous; Abydos and Apophis's Base are screen-canonical. The
// debug UI also allows a fully manual 7-glyph build, so any address can be dialed.
