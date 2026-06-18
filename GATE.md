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

---

## 2. Screen-accurate facts and measurements

### Gate placement (MEASURED from `tmp/target.png`, 1491×1074, via `scripts/probe.js`)
- Ring center: **(0.498, 0.478)** = px (743, 513). Outer blue rim radius **0.211** of viewport
  width = px 315. (Earlier 0.464/0.222 was eyeballed and wrong — the gate sits dead-centerish,
  not left.) White ring band radius ≈ 0.157 (px 234).
- Chevron radius 0.93·R; glyph track 0.70–0.875·R; **event-horizon / inner void 0.66·R**.

### Other measured anchors (fractions of viewport; see `public/src/layout.json`)
- Outer frame: left 0.020, right 0.969, top 0.014, bottom 0.994 (px 30/1445/16/1068), with a
  diagonal chamfer at the top-left where the logo bay notches in.
- Logo bay: x 0.030, y 0.052, w 0.093, h 0.089.
- Timer arc: center (0.101, 0.267), radius 0.077 of height (px center 150,287 r 83). Clock
  (HH:MM / date / day) is CENTER-aligned inside the arc.
- Result boxes: first at x 0.830, y 0.154, w 0.0865, h 0.094; stepY 0.110; 7 boxes. Number sits
  small at the box bottom-left.
- Footer: readout x 0.193 w 0.569; auth digits in segmented cells x0 0.432 → x1 0.781; LST CODE
  #1 x 0.205, #2 x 0.693; USER/SYS right-anchored.
- STATUS is a small bordered box (x 0.029, w 0.158) ABOVE the checklist; text must fit inside it
  (keep it short — no OUTGOING/INCOMING prefix or it overflows the panel).

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
- **Outer frame**: one big rounded rect around the console, with a diagonal **chamfer at the
  top-left** where the logo bay notches in.
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

- `outerFrame` — the big enclosing rounded rect + top-left chamfer + logo bay box. Drawn first.
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
