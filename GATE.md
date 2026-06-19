# GATE.md — SGC Dialing Computer · Knowledge Base

Everything you need to KNOW to build a screen-accurate **SGC Stargate dialing computer**
(SG-1 series cyan interface, rotating 3D point-of-origin emblem) as an **ES6 PWA** with
**Three.js (CDN)** + **Bun**. This is accumulated knowledge — facts, measurements, lore, and
hard constraints — not a record of work done.

---

## 1. The source assets and what each is FOR

All in `references/`.

### The gate geometry (the one true base)
`Milky_way_stargate_with_detailed_glyphs.svg` — authentic full vector Stargate.
- viewBox `0 0 527.249 526.275`.
- **True ring center is (263.691, 264.729)** — the average center of the 4 `Main_gate_parts`
  circles. This is NOT the viewBox center (263.62, 263.14); using the viewBox center makes the
  ring spin off-axis (visible wobble). Always recenter geometry on the true center.
- **Outer ring radius = 256.71** (largest of the 4 circles). Scale so this maps to 1.0 world unit.
- Layers and their role:
  - `Symbols` — the 39 glyphs (Origin..Leo). Thin constellation line-figures. **The ring
    glyphs are correctly thin** — that matches the show; do not thicken them.
  - `Main_gate_parts` — 4 concentric ring circles.
  - `Inner_Chevron_Delimiters` (39 lines), `Outer_Chevron_Delimiters` (184 lines) — the tick
    bands between glyph slots.
  - `Chevron_Locks` — the 9 V-clamps. One combined layer; to redden a single chevron it must
    be split per-chevron by centroid angle.
  - `Alternative_Detailing` — the chevron housing plates (zigzag detail behind each clamp).

### What rotates vs what's fixed (mechanical truth)
The real gate spins its **symbol ring inside fixed chevron housings**. So:
- ROTATING: `Symbols`, `Main_gate_parts`, `Inner`/`Outer_Chevron_Delimiters`.
- FIXED: `Chevron_Locks` + `Alternative_Detailing`.
Confirmed by radius: the clamps + housing plates are the fixed outer structure; the glyph ring
turns within them.

### UI layout references (the cyan SGC design = the target)
- **`tmp/target.png` (1491×1074, flat-on) — CANONICAL layout frame, the idle/standby state.**
  Every HUD anchor is measured from this with `scripts/probe.js`. This is the match target.
- The **CRT active/dialing captures** (provided in-chat) define the ACTIVE state: red chevron
  indicators, red circuit traces fanning to the filled boxes, the hero glyph in the gate center,
  and the checklist showing "N OK". Treat these as behavior/colour reference (photographed at an
  angle, so not pixel-measurable).
- `references/Dialing_computer.webp`, `references/Dialing_computer_(Unending).jpg`,
  `references/preview.webp`, `references/preview (3).webp` — secondary cross-checks.

### Visual-verification tooling (this repo, Node-only — works with node/npm/bun)
- `npm run capture -- <state>` → `tmp/shot_<state>.png` (states: idle|dialing|dialed|kawoosh|
  active, via the `?state=` deep-link in main.js; serves `public/` live, no build needed).
- `npm run zoom -- <file> [x y w h] [z]` → `tmp/zoom.png` (magnified crop for close review).
- `npm run diff -- <a> <b> [crop]` → `tmp/diff.png` (red=A/green=B/yellow=aligned overlay).
- `node scripts/probe.js row <y>|col <x>|px <x> <y>|blue-row <y> [file]` — decodes a PNG and
  reports exact edge coordinates, used to set layout.json from real target pixels.
- Workflow: clean `tmp/` (keep `target.png`) → `capture` → `diff`/`zoom`/`probe` → adjust
  `layout.json`/`hud.js` → repeat.

### Sources & tmp layout
- **`source/`** holds the inputs: `target.png` (the dim CRT photo — the match target) and
  **`source/mask.png`** (a crisp binary trace of the same frame: black HUD line-art on white, no
  navy/noise/anti-alias haze — the authoritative geometry source). Plus the reference webp/svg.
- **`tmp/<script>/…`** holds outputs, one subfolder per script, filenames carrying their params.
  Nothing else lives loose in `tmp/`.

### Mask-based measurement (USE THIS for layout numbers)
Measure `source/mask.png`, not the photo. All §2 numbers were read from it.
- `node scripts/probe.js row <y>|col <x>|px <x> <y> mask.png` — auto-inverts when the filename
  contains "mask" (white-on-black internally) so bright = HUD line. Default file = target.png.
- `node scripts/grid.js` → `tmp/grid/grid.png` — mask + a faint 100px coordinate ruler (tick
  crosses + tiny labels; NO bold gridlines — those got misread as geometry).
  `node scripts/grid.js tiles [cols rows z]` → `tmp/grid/tile_r{r}_c{c}.png` labeled tiles for
  systematic tile-by-tile reading (read coordinates straight off the ruler, never guess an area).
- `node scripts/zoom.js <file> [x y w h] [z]` → `tmp/zoom/<stem>_x_y_w_h_z.png` (params in name).
  `<file>` resolves from `source/` then `tmp/` (tmp may include a subfolder, e.g. `mask/over.png`).
- `node scripts/trace.js [target|mask|raw]` → `tmp/trace/trace_<arg>.png` — draws the whole vector
  model from `trace.json` over the brightened target (default) OR the dimmed crisp **mask**, each
  HUD layer a distinct color + legend. The pre-code VALIDATION artifact: confirm every line/path
  before writing `layout.json`/`hud.js`. (`raw` = on black.)

(`mask.js` and `circuits.js` were removed — folded into `probe.js` auto-invert and `trace.js mask`.)

### `trace.json` (the validated model — single source of truth)
All HUD geometry in **target pixels (1491×1074)**, measured from the mask. `trace.js` renders it;
`public/src/layout.json` is derived from it (normalize by /1491 x, /1074 y) once validated.

---

## 2. Screen-accurate facts and measurements

### Gate placement (MEASURED from `tmp/mask_inv.png`, 1491×1074)
- Ring center: px **(743, 513)** = (0.498, 0.478). Outer rim radius **R = 315** px (0.211·W).
- Chevron radius 0.93·R; glyph track 0.70–0.875·R; **event-horizon / inner void 0.66·R**.
- **9 chevron tips (px, radially measured on the mask)** — feed these as the circuit endpoints:
  90→(743,196) · 50→(933,287) · 10→(1035,462) · 330→(1011,668) · 290→(848,802) ·
  250→(638,802) · 210→(476,667) · 170→(451,462) · 130→(553,287). (290/250 = unused bottom pair.)

### Other measured anchors (px @ 1491×1074; full set lives in `trace.json`)
- Outer frame: x0 29, y0 12, x1 1458, y1 1069, **plain rounded rectangle, corner r≈24 on all four
  corners (NO chamfer)**. The logo bay + header are separate boxes sitting inside the top-left;
  there is no diagonal cut in the frame itself. (An earlier "top-left chamfer" note was wrong.)
- Left-panel divider (vertical) at x≈288. Circuit **left rail** = nested verticals x≈300/307/314.
- Logo bay: x 47, y 30, w 128, h 120 (rounded box holding the 3D emblem).
- Header: panel x 187–1175, y 25–150. Music credit lines anchor at **x 197**, y 42 & 75 (left).
  Transport ◀◀▶▶▶ at x≈405, y 118. Binary-dot panel x 620–1160. DESTINATION text x 1015–1258, y 88.
- Timer arc: center (150, 287), r 84 (open lower-right). Clock 17:56 (y≈262) / date 29/03/20 (y≈312)
  / day 29 (y≈348), CENTER-aligned on x 150.
- Numbers grid (2×3): columns x 103 & 217; value rows y 416 / 492 / 568; sparkline +38 below each.
- **STATUS is TEXT ONLY — there is NO bordered box** (the mask shows no border). "STATUS: DIALING
  SEQUENCE" is centered ≈ x 158, y 702, in the gap between the numbers grid and the checklist.
- Checklist: panel x 64, y 733, w 216, h 268 (bottom ≈ 1001), with a right-tab divider at x≈275.
  7 rows: [left square x≈84][RED bar x 100–145][blue number x≈168][right square x≈250]. Bar centres
  y 765→963, pitch 33.
- Result boxes: left 1238, right 1367 (w 129), **top0 165, stepY 117.5, h 101** (the box body —
  151 is the outer line of the thick double top border), 7 boxes. Bold white number at the box
  lower-LEFT, OUTSIDE the box. Circuit taps connect at box **centre**: boxes 1–3 on the LEFT edge
  (y 215/330/451), boxes 4–7 on the RIGHT edge (y 568/685/803/920).
- Footer: **readout box x 332, y 888, w 805, h 113** (a wide box; idle empty, holds the countdown
  when active). AUTHORIZATION CODE segmented cells x0 628 → x1 1210 (15 cells, pitch ≈38.8, the 7th
  is the `-` gap), digit baseline y≈1028; label "AUTHORIZATION CODE:" at x≈290. LST CODE #1 x≈300,
  #2 x≈1016, y≈812. USER: / SYS: right block at x≈1245, y 1008 / 1036.

### Text anchors (measured TOP-LEFT px + font size; all in `trace.json` `texts[]`, left-aligned)
credit1 "David Arnold arr. Joel Goldsmith" (200,37 s19) · credit2 "Stargate SG-1: Main Title"
(200,65 s19) · DESTINATION (1112,73 s28) · clock 17:56 (102,267 s33) · date 29/03/20 (102,313 s24)
· day 29 (138,344 s28) · STATUS: DIALING SEQUENCE (42,702 s18) · LST CODE # 1 (307,809 s26) ·
LST CODE # 2 (1016,809 s26) · AUTHORIZATION CODE: (292,1041 s21) · USER: SGT. W HARRIMAN
(1245,1021 s17) · SYS: NOMINAL (1245,1046 s17). Transport ◀◀▶▶ at (200,116). Numbers grid 2×3
values [[2,8],[4,1],[1,4]] at cols x 100/215, rows y 415/490/565, size 24, sparkline +33 below each.
(The SGC font is a wide custom face; monospace in the trace overlay reads a bit wider — anchors match.)

### Circuit anchors (the trace network — all in `trace.json` as explicit polylines)
Right boxes 1–3 leave the box LEFT edge (box1 = single shallow diagonal to its tip; boxes 2–3 =
horizontal stub to **turnX 1178** then a diagonal to the tip). Boxes 4–7 leave the RIGHT edge into
**nested lanes x 1401/1415/1429/1443**, rise to **nested top-rail levels y 137/123/109/96**, run
left: 4/5/6 drop the **left rail** to a short horizontal tap into their chevron (210/170/130),
7 runs to x 743 and drops to the top chevron (90). The bottom pair (250°,290°) carry no trace.

### NOTE — target.png is a MID-DIAL frame, not pure idle
The canonical frame shows **STATUS: DIALING SEQUENCE** with the checklist **red bars lit**, while
the circuit is still all-blue, chevrons unlit, boxes empty. A pixel match to `target.png` must
render that exact mixed state (red checklist bars + dialing status text).

### Chevron angles (degrees, 0 = +X, CCW)
- The 9 chevron clamp centers: `[90, 50, 10, 330, 290, 250, 210, 170, 130]`.
- A 7-symbol address engages **7 chevrons; the 2 NOT used are the bottom pair (250°, 290°)** —
  the chevrons flanking 6 o'clock stay dark. Lock order 1..7: `[50, 10, 330, 210, 170, 130, 90]`
  (right side down, skip the bottom two, up the left side, point-of-origin / top 90° last).

### Glyph ring order (index 0..38)
Origin, Crater, Virgo, Bootes, Centaurus, Libra, Serpens_Caput, Norma, Scorpius,
Corona_Australis, Scutum, Sagittarius, Aquila, Microscopium, Capricornus, Piscis_Austrinus,
Equuleus, Aquarius, Pegasus, Sculptor, Pisces, Andromeda, Triangulum, Aries, Perseus, Cetus,
Taurus, Auriga, Eridanus, Orion, Canis_Minor, Monoceros, Gemini, Hydra, Lynx, Cancer, Sextans,
Leo_Minor, Leo.

### Canonical addresses (7 glyph indices, origin last)
Abydos `[27,7,15,32,12,30,0]`, Apophis `[20,18,11,38,10,32,0]`.

### The hero center glyph (the big one shown while dialing)
- It is **bold/thick**, not thin — produced by stroking the thin glyph paths with width
  (~width 10 in 100-unit glyph space) and filling the ribbon. The RING glyphs stay thin; only
  this center glyph is bold.
- Size math: the gate void diameter = 2·0.66 = **1.32 world units**. A glyph spans
  100/256.71 = **0.39 world units at scale 1**. To fill ~75% of the void → **scale ≈ 2.5**.
- Behavior: appears big in the gate center on lock, holds a beat, then flies out to its result
  box (shrinking, landing readable inside the box).

### The circuit (routing topology — verified against target.png + the targeted left-side zoom)
Every trace ANCHORS on a real feature (a chevron tip, a box edge, the rail); none float. Each of
the 7 result boxes maps to the chevron that locks for it, **in dialing order** (box _i_ ↔ the
_i_-th locked chevron). The two unused bottom chevrons (250°, 290°) carry no trace.

| box | chevron | position | routing |
|---|---|---|---|
| 1 | 50° | upper-right | direct diagonal: box LEFT edge → chevron tip |
| 2 | 10° | right | direct diagonal: box LEFT edge → chevron tip |
| 3 | 330° | lower-right | direct diagonal: box LEFT edge → chevron tip |
| 4 | 210° | lower-left | box RIGHT edge → far-right lane → top rail → left rail → chevron |
| 5 | 170° | left | via the rail bus (as box 4) |
| 6 | 130° | upper-left | via the rail bus (as box 4) |
| 7 | 90° | top (origin) | box RIGHT edge → lane → top rail → drop down to the top chevron |

Structure carrying the above:
- **Outer frame**: one big rounded rect around the console (rounded corners all four, no chamfer).
- **Inner rail = shared bus**: left vertical edge (x ≈ 0.205) + rounded top-left corner + top
  edge. The far-right box lanes, the top point-of-origin drop, and the left-chevron taps all
  merge into this rail.
- **Right diagonals** — boxes 1–3 reach the right-hemisphere chevrons (50/10/330) directly
  across the gap (`tip = (cx + R·cosθ, cy − R·sinθ)`).
- **Far-right lanes** — boxes 4–7 leave their RIGHT edge to **nested vertical lanes** (deeper per
  box), rise, and run across the top into the rail.
- **Left-chevron taps** — the left chevrons (130/170/210°) run a **short horizontal trace LEFT
  into the left rail**; the top chevron (90°) is a **vertical drop from the top rail to its tip**.
- The bottom pair (250°, 290°) get nothing — unused for a 7-symbol address.

(Earlier notes called this a "right-side fan with no left connections" — that was wrong; the left
chevrons DO connect, via the rail. The left zoom confirms it.)

**State color (this is the key idle-vs-active distinction):**
- **Idle / standby** (`tmp/target.png`): the whole circuit is **blue**; chevrons are unlit
  (white/blue); gate center empty; boxes empty; checklist rows blank.
- **Active / dialing** (the CRT captures): as each chevron engages, **its tap trace + its box
  trace turn RED** and fan from the engaged chevron to that box; the box **fills with the locked
  glyph**; the checklist row shows **"N OK"**. Unengaged traces stay blue. A large **hero glyph**
  of the symbol being locked shows in the gate center. Box 7 = point-of-origin (Earth) glyph.

---

## 3. HUD structure (the layers)

Independent, individually-toggleable canvas layers. **Each layer owns its own text** (labels
live with their layer — there is no separate "labels" layer, and no standalone "frame" layer).

- `outerFrame` — the big enclosing rounded rect (rounded corners, no chamfer) + logo bay box. Drawn first.
- `header` — music text + transport (◀◀ ▶ ▶▶), centered binary dot panel (dim, ~3 rows),
  DESTINATION text, inner rail enclosure.
- `left` — timer arc + centered clock/date/day, the 2×3 numbers grid with sparklines, the
  bordered STATUS box, and the checklist.
- `checklist` — 7 rows inside a beveled panel: [left square] [SHORT rounded red bar]
  [blue number] [right square], plus a vertical divider creating a thin right tab. Bars are red
  only for locked rows (active/dialed); blank otherwise. Active also shows "N OK" per the refs.
- `footer` — LST CODE #1/#2, the countdown icon, the readout box (holds the 38-min countdown
  when active) with status dots, **segmented** AUTHORIZATION CODE cells, USER/SYS.
- `boxes` — the 7 result boxes + small bottom-left numbers + landed glyphs (filled on lock).
- `circuit` — the gate-to-boxes trace network (see §2). Blue idle, reddens per engaged chevron.

**Chevron lock indicator** (decided from the CRT reference): light a **clean red V indicator**
at the engaged chevron position — do NOT redden the whole `Chevron_Locks` housing (that reads as
a red blob). The authentic white housing stays; only a crisp red chevron mark turns on.
The ring's constellation glyphs stay ON the ring (explicit project choice), even though the
clean refs show an empty tick band — the symbol ALSO appears as the hero glyph in the center.

---

## 4. Gate Dialing Computer — program states & SG-1 lore

`mode` = "outgoing" (Earth dials out) | "incoming" (off-world dials Earth). Phase drives the
STATUS text:

| phase | STATUS text | meaning |
|---|---|---|
| idle | STANDBY | dormant, awaiting dial. |
| spinning/locking/between | {OUTGOING\|INCOMING} DIALING SEQUENCE | ring turning, encoding one glyph at a time. |
| dialed | CHEVRONS ENCODED | all 7 locked, address complete. |
| kawoosh | WORMHOLE ESTABLISHED | unstable vortex ("kawoosh") forms, then settles. |
| active | {OUTGOING\|INCOMING} WORMHOLE ACTIVE | stable wormhole; 38-min clock runs. |
| aborting | DIALING ABORTED | dial cancelled, ring unwinds. |

### The 38-minute limit (canonical)
A Stargate holds a stable wormhole a **maximum of 38 minutes** before it destabilizes and
shuts down. Longer requires extraordinary power (a black hole's gravity, a solar flare).
So: an active wormhole runs a 38:00 countdown; at zero it auto-closes. Displaying this as a
millisecond-precision readout (MM:SS.mmm) gives the impressive HUD feel; pulse it red in the
final minute.

### Dialing choreography (show-accurate, for reference)
Outgoing dial: ring rotates to bring each glyph under the top chevron, the chevron engages
(locks), the ring reverses direction for the next, repeating for all 7; after the 7th the
unstable vortex erupts and settles into the event horizon. Incoming follows the same chevron
sequence but is initiated remotely (and on Earth would trigger the iris/defense protocol).

---

## 5. Hard environment constraints

- **CDN must be jsdelivr**, not unpkg. The Claude preview CSP only whitelists
  `cdn.jsdelivr.net/npm/`; unpkg is blocked. Pins: three@0.184.0, lil-gui@0.21.0.
- Served over **http(s)**, not file:// (the import map needs an origin).
- Verify visually with **headless Chrome** via `npm run capture/zoom/diff` (Chrome is present on
  this Windows host; swiftshader covers the WebGL emblem). `--virtual-time-budget` does NOT
  advance the rAF loop in new-headless, so the auto-demo won't progress in a screenshot — use the
  `?state=` deep-link to render a specific phase deterministically. Sound/timer pulse still need a
  real interactive browser.
- Bun installed via `npm i -g bun` (bun.sh is blocked in-sandbox). Node v22.22.2.
- Under an **orthographic camera** (used so the WebGL gate aligns 1:1 with the 2D HUD), a
  `rotation.y` flip is invisible (no perspective). Drive any "flip" via scale.x instead.
- The composer (EffectComposer) leaves its render target bound; to draw the 3D logo afterward,
  bind the default framebuffer and clear depth, or it won't appear.

---

## 6. Project shape (where things live)

**v5 rendering approach (important):** the gate is mounted as a LIVE recolored SVG in the DOM
(rotating ring group vs. fixed chevron housings), NOT extruded into Three.js geometry. This is
why it renders reliably in any environment (no GPU needed for the gate). The HUD is one 2D
canvas with six layer-draw functions. Three.js is used only for the small rotating
point-of-origin emblem in the logo bay. The authentic glyphs come straight from gate.svg, so
there is no separate glyphs.js.

```
public/
  index.html            dev entry: jsdelivr import map, gate-host/hud/logo, CRT/scanline, PWA meta
  manifest.webmanifest, sw.js, icons/   (icons generated from the gate SVG; maskable + any)
  assets/gate.svg       base gate (entities resolved)
  src/
    addresses.js        39-glyph ring order + canonical addresses
    screen.js           responsive mapper: faithful at 1.25:1, edge-anchored otherwise
    gate.js             gate.svg → live DOM SVG; ring (rotating) vs fixed groups; recolor;
                        per-angle chevron split for red locks
    logo.js             3D point-of-origin emblem (Three.js, perspective, own canvas)
    dialer.js           state machine + 38-min timer + mode (+ wall clock)
    hud.js              the 6 HUD layers drawn to one 2D canvas
    sound.js            Web-Audio synthesized SFX (offline-capable)
    debug.js            lil-gui panel — HIDDEN by default, toggled by clicking the SGC logo
                        emblem (logo bay). Top-right when shown.
    main.js             bootstrap, input, auto-demo, render loop
    layout.json         measured anchors (normalized fractions) + circuit data + palette
scripts/{dev.js, serve.js, build.js}
dist/index.html          built, self-contained (inlines layout+SVG+bundle) — THE runnable file
```

Run: `bun run dev` (live reload) · `bun run build` → `dist/index.html` · `SERVE_DIST=1 bun run
preview` · `bun run lint`. Controls: Space = dial/abort · M = toggle mode · A = incoming
(Apophis) · click the SGC logo = show/hide the debug panel.

### Responsive rule
Designed at aspect **1.25:1** (1000×800). At that aspect the layout is pixel-faithful to the
reference. On other aspects, panels anchor to the true viewport edges (binary/checklist left,
result-box column + DESTINATION/SYS right) and the gate radius is clamped to fit, so wide and
mobile screens fill naturally instead of stretching.
