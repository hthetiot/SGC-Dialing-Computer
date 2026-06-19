# SGC Dialing Computer

A screen-accurate **Stargate SG-1 (SGC) dialing computer** — the cyan dialing-HUD with the
rotating gate and point-of-origin emblem — built as an **ES6 PWA** with **Three.js (CDN)** + **Bun**.

## Docs
- **[docs/SPECS.md](docs/SPECS.md)** — the full project specification: source assets, measured
  HUD geometry, gate/circuit/lore facts, program states, and hard environment constraints.
- **[docs/PIPELINE.md](docs/PIPELINE.md)** — the pixel-perfect tracing pipeline: how the HUD is
  measured from `source/mask.png`, captured in `trace.json` (the design source), previewed, and
  verified against the target before any app code is written.

## Layout
```
source/        target.png (match target) + mask.png (crisp binary trace) + references
trace.json     THE design source — every HUD element measured in target pixels (the "figma")
scripts/       tracing + dev tooling (see docs/PIPELINE.md). Outputs go to tmp/<script>/
public/        the PWA (index.html, src/, assets/gate.svg, manifest, sw) — derived from trace.json
docs/          SPECS.md + PIPELINE.md
```

## Quick start
```bash
bun run dev          # live-reload dev server -> http://localhost:8787
bun run build        # -> dist/index.html (self-contained)

# tracing / design pipeline (Node — works with node/npm/bun)
npm run trace        # validation overlay of trace.json on the target  -> tmp/trace/
npm run trace:schema # filled SGC-styled preview of trace.json          -> tmp/trace/schema.png
npm run trace:match  # preview overlaid on the target to check the fit  -> tmp/trace/match.png
npm run grid         # mask + coordinate ruler                          -> tmp/grid/grid.png
```

## Controls
Space = dial/abort · M = toggle mode · A = incoming (Apophis) · click the SGC logo = debug panel.
