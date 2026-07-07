# PIPELINE.md — the pixel-perfect tracing pipeline

How the HUD is reverse-engineered from the reference frame into `source/trace.json` (the design
source), then validated and iterated. All tooling is headless-Chrome or pure-Node and writes to
`tmp/<script>/` (params in the filename; `tmp/` is disposable — `npm run clean`).

## Inputs
- **`source/target.png`** — the reference photo of the real SGC screen (1491×1074). Dim and
  CRT-noised: **never measure it directly.**
- **The mask is GENERATED, not hand-provided.** `npm run capture -- target.png --mask --black [thr]`
  grayscale-thresholds the target **browser-side** into a crisp B/W trace → `tmp/mask/`. **This is
  the authoritative geometry source — measure THIS, not the photo.** (`--black` = black line-art on
  white; omit for white-on-black. Default threshold 48; tune per region.)

## The single source of truth: `source/trace.json`
Every HUD element in **target pixels**, as a keyed block:
`frame, rail, logoBay, header, timer, numbers, checklist, footer, boxes, gate, circuit, texts`.
The app's `public/assets/layout.json` is derived from it (`npm run layout` copies it). `scripts/trace.js`
renders it.

## The loop
```
   1. MASK      capture --mask           → tmp/mask  (B/W from target, browser-side)
   2. MEASURE   read coords off the mask: grid · probe · zoom · analyze
   3. UPDATE    edit source/trace.json   (+ scripts/trace.js only if the render logic changes)
   4. VALIDATE  trace:schema · trace:match · diff · analyze   (against target)
   5. ITERATE   repeat — the USER validates every MAJOR change before moving on
```

## Tools — one distinct, non-overlapping job each
| Tool | The ONE thing it does | Reads | Out |
|---|---|---|---|
| `capture -- <img> --mask` | make the B/W **mask** (grayscale+threshold) | target.png | `tmp/mask/` |
| `npm run grid` / `grid:tiles` | **eyeball** — coordinate ruler / labelled tiles over the mask | mask | `tmp/grid/` |
| `npm run probe -- row\|col\|px …` | **one line, exact** — bright-run edge numbers for a single row/col/px | mask | stdout |
| `npm run zoom -- <file> [x y w h z]` | **one region, visual** — magnified crop (also extracts video frames) | any png/mp4 | `tmp/zoom/` |
| `node scripts/analyze.js [a b]` | **whole layout, numeric** — auto-measure all anchors, target-vs-render Δ | target + a render | stdout |
| `npm run trace[:schema\|:match\|:mask]` | **render the design** + overlay it on target/mask | trace.json | `tmp/trace/` |
| `npm run diff` | **whole image, visual** — pixel-difference of a render vs target | a render + target | `tmp/diff/` |
| `npm run capture -- <state>` | render a **live app state** (`?state=`) for analyze/diff | the app | `tmp/shot_` |

No two overlap on purpose: **grid** = eyeball ruler, **probe** = one-line numbers, **zoom** = one-region
visual, **analyze** = whole-layout numbers, **diff** = whole-image visual, **trace.js** = render the
design + validation overlay. Measure numbers with probe/analyze; look at shapes with grid/zoom; confirm
the fit with trace:match/diff.

### Validate (step 4) in detail
- `npm run trace:schema` → `tmp/trace/schema.png` — filled SGC-styled render of `trace.json` ("figma").
- `npm run trace:match -- [opacity]` → `tmp/trace/match.png` — the schema over the real target; drift = doubled edges.
- `npm run trace -- [target|mask|raw]` → distinct-colour vectors + legend over target/mask/black — confirm each line.
- `npm run diff` and `node scripts/analyze.js target.png shot_idle.png` — pixel-diff image + numeric Δ table.

## The change loop (project-wide, not just first trace)
The trace stays the design source-of-truth AND the regression gate for the whole project. Every change runs:
**trace → plan → change BOTH `source/trace.json`/`scripts/trace.js` (design) AND `public/src/hud.js`
(implementation) → re-trace → check vs `source/target.png` → USER confirms major changes → loop.**
The implementation derives from the trace; never let them diverge silently.

## Conventions
- Inputs in `source/`. Outputs in `tmp/<script>/…`, params in the filename. `tmp/` is disposable.
- `mask.js` and `circuits.js` were removed — mask generation folded into `capture --mask`.

See **[SPECS.md](SPECS.md)** for the measured values themselves and the project facts.
