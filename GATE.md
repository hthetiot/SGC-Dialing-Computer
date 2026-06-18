# GATE.md — SGC Dialing Computer · Knowledge Base

Everything you need to KNOW to build a screen-accurate **SGC Stargate dialing computer**
(SG-1 series cyan interface, rotating 3D point-of-origin emblem) as an **ES6 PWA** with
**Three.js (CDN)** + **Bun**. This is accumulated knowledge — facts, measurements, lore, and
hard constraints — not a record of work done.

---

## 1. The source assets and what each is FOR

All in `/mnt/user-data/uploads/`.

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
- `1781775793523_image.png` (1000×800, flat-on) — **CANONICAL layout frame.** Every HUD anchor
  is measured from this.
- `1781780688811_image.png` — clean hi-res recreation; clearest view of the **circuit routing**
  and the **red chevron-lock** state.
- `1781784110871_preview.webp` — shows the **large bold glyph in the gate center** while dialing.
- `1781781242383_image.png`, `Dialing_computer__Unending_.jpg` — red incoming/active state.
- `preview.webp`, `preview__3_.webp`, `2ndGenStargate.webp` — secondary cross-checks.

### Glyph-behavior reference (BEHAVIOR ONLY)
`1781781847492_Dialing_computer.webp` — the **SG-1 PILOT** dialer (teal, NEC monitor). Its UI
design is different and must be **ignored**; use it only to understand glyph activation
behavior. Never reproduce its frames.

---

## 2. Screen-accurate facts and measurements

### Gate placement (normalized to the 1000×800 reference)
- Ring center: **(0.464, 0.4775)**. Outer radius: **0.222** (of viewport width).
- Chevron radius 0.93·R; glyph track 0.70–0.875·R; **event-horizon / inner void 0.66·R**.

### Chevron angles (degrees, 0 = +X, CCW)
- The 9 chevron clamp centers: `[90, 50, 10, 330, 290, 250, 210, 170, 130]`.
- The 7 that engage during dialing, in lock order 1..7: `[50, 10, 330, 290, 250, 210, 90]`
  (chevron 7 / point-of-origin = top, 90°).

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

### The circuit (routing topology — this is subtle)
The box connectors do NOT fan diagonally from the gate. The real routing:
- A top rail runs from left of the gate, up, across the top, with a step-down at the top-right.
- The rail **links to a gate chevron** (a diagonal trace from the rail's left segment down to
  the top-left chevron, ~130°) — the conductor connects to the gate, it doesn't float.
- From the top-right corner each box trace runs RIGHT past the boxes to a **nested vertical
  lane on the far right**, drops down, then comes back LEFT into the box's right edge. The
  lanes nest (deeper per box). The whole network reddens on activation.
- KNOWN GAP: this is close but not yet a pixel-faithful match to the reference; per-trace
  detail still differs.

---

## 3. HUD structure (the layers)

Independent, individually-toggleable canvas layers. **Each layer owns its own text** (labels
live with their layer — there is no separate "labels" layer, and no standalone "frame" layer).

- `header` — top bar enclosure, logo bay frame, DESTINATION text, indicator dots.
- `binary` — left scrolling binary panel + frame.
- `checklist` — STATUS line + the 7-row chevron-lock checklist.
- `footer` — bottom readout box, AUTHORIZATION CODE, SYS: NOMINAL, LST CODE #1/#2, the
  wormhole countdown.
- `boxes` — the 7 result boxes + numbers + landed glyphs.
- `circuit` — the gate-to-boxes trace network (replaces any "frame").

Red chevron lock = recolor the actual `Chevron_Locks` clamp geometry for that position (split
per-angle), NOT a floating overlay arrowhead.

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
- The build sandbox has **no GPU/WebGL and no browser** — live rendering cannot be verified
  here. Verify geometry/layout/animation math by rendering to PNG (cairosvg). Anything visual
  (3D emblem, fly-out motion, sound, timer pulse) needs a real-browser smoke test.
- Bun installed via `npm i -g bun` (bun.sh is blocked in-sandbox). Node v22.22.2.
- Under an **orthographic camera** (used so the WebGL gate aligns 1:1 with the 2D HUD), a
  `rotation.y` flip is invisible (no perspective). Drive any "flip" via scale.x instead.
- The composer (EffectComposer) leaves its render target bound; to draw the 3D logo afterward,
  bind the default framebuffer and clear depth, or it won't appear.

---

## 6. Project shape (where things live)

```
public/
  index.html            dev entry: jsdelivr import map, canvases, CRT/scanline, PWA meta
  manifest.webmanifest, sw.js, icons/   (icons generated from the gate SVG; maskable + any)
  assets/gate.svg       base gate (entities resolved)
  src/
    glyphs.js           39 glyphs normalized 100×100
    addresses.js        canonical addresses
    screen.js           responsive mapper: faithful at 1.25:1, edge-anchored otherwise
    gate.js             SVG→Three.js; ringGroup/staticGroup; glyph + hero-glyph anims
    logo.js             3D point-of-origin emblem
    dialer.js           state machine + 38-min timer + mode
    hud.js              the 6 HUD layers
    scene.js            ortho pixel-space renderer, bloom, event horizon, picking
    sound.js            Web-Audio synthesized SFX (offline-capable)
    debug.js            lil-gui panel (top-left, below logo bay)
    main.js             bootstrap, input, render loop
    layout.json         measured anchors + circuit path data
scripts/{dev.js, serve.js, build.js}
dist/index.html          built, self-contained (inlines layout+SVG+bundle) — THE runnable file
```

Run: `bun run dev` (live reload) · `bun run build` → `dist/gate.html` · `SERVE_DIST=1 bun run
preview` · `bun run lint`.

### Responsive rule
Designed at aspect **1.25:1** (1000×800). At that aspect the layout is pixel-faithful to the
reference. On other aspects, panels anchor to the true viewport edges (binary/checklist left,
result-box column + DESTINATION/SYS right) and the gate radius is clamped to fit, so wide and
mobile screens fill naturally instead of stretching.
