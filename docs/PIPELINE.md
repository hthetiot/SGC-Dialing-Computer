# PIPELINE.md — the pixel-perfect tracing pipeline

How the HUD is reverse-engineered from the reference frame into `source/trace.json` (the design source),
previewed, and verified — **before** any `public/src` app code is written. All tooling is plain
Node (works with `node` / `npm` / `bun`). Inputs live in `source/`, every output goes to
`tmp/<script>/` with parameters in the filename.

## Sources (`source/`)
- **`target.png`** — the reference photo of the real SGC dialing screen (1491×1074). The match
  target. Dim, CRT-noised — do NOT measure it directly.
- **`mask.png`** — a crisp binary trace of the same frame: black HUD line-art on white, no noise.
  **This is the authoritative geometry source.** Probe this, not the photo.

## The single source of truth: `source/trace.json`
Every HUD element measured in **target pixels**, as a keyed block:
`frame, rail, logoBay, header, timer, numbers, checklist, footer, boxes, gate, circuit, texts`.
This is the "figma" — the app's `public/src/layout.json` is derived from it (normalize x/1491,
y/1074) once the preview matches.

## The loop
```
            ┌──────────────────────────────────────────────┐
            │  1. MEASURE   probe / grid / zoom on the mask │
            │  2. CAPTURE   edit source/trace.json                 │
            │  3. PREVIEW   trace.js schema                 │
            │  4. VERIFY    trace.js match  /  trace.js     │
            └─────────────── repeat ───────────────────────┘
```

### 1. Measure — read exact coordinates off the mask
- `npm run probe -- row <y> | col <x> | px <x> <y> mask.png`
  Decodes a PNG and reports bright-run edge coordinates. Auto-inverts any file whose name contains
  "mask" (black-on-white → bright = HUD line). Default file = `target.png`.
- `npm run grid` → `tmp/grid/grid.png` — the mask under a faint 100px coordinate ruler (tick
  crosses + tiny labels; no bold gridlines — those get misread as geometry).
- `npm run grid:tiles -- [cols rows z]` → `tmp/grid/tile_r{r}_c{c}.png` — labeled tiles for
  systematic, tile-by-tile reading. **Read coordinates straight off the ruler — never guess an area.**
- `npm run zoom -- <file> [x y w h] [z]` → `tmp/zoom/<stem>_x_y_w_h_z.png` — magnified crop
  (params encoded in the filename). `<file>` resolves from `source/` then `tmp/`.

### 2. Capture — edit `source/trace.json`
Put the measured numbers into the relevant block. Text labels go in `texts[]` as
`{id, t, x, y, size}` (x,y = measured TOP-LEFT anchor, size = px chosen so cap-height matches).

### 3. Preview — render the design
- `npm run trace:schema` → `tmp/trace/schema.png` — a filled, SGC-styled render of `source/trace.json`
  (blue frame, cyan text, gate rings, red checklist bars, …). What the HUD will look like.

### 4. Verify — confirm the fit
- `npm run trace:match -- [opacity]` → `tmp/trace/match.png` — the schema preview overlaid on the
  real target at `opacity` (default 0.62). Drift shows as doubled edges.
- `npm run trace` → `tmp/trace/trace_target.png` — distinct-colour vectors + legend over the
  brightened target (use `trace -- mask` for the crisp mask, `trace -- raw` for black). Confirms
  every individual line/path.

## Conventions
- Inputs: `source/`.  Outputs: `tmp/<script>/…`, params in the filename. `tmp/` is disposable.
- `mask.js` and `circuits.js` were removed — folded into `probe.js` (auto-invert) and `trace.js mask`.

See **[SPECS.md](SPECS.md)** for the measured values themselves and the project facts.
