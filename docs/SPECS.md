# SPECS.md — SGC Dialing Computer · Knowledge Base

Everything you need to KNOW to build a screen-accurate **SGC Stargate dialing computer**
(SG-1 series cyan interface, rotating 3D point-of-origin emblem) as an **ES6 PWA** with
**Three.js (CDN)** + **Bun**. This is accumulated knowledge — facts, measurements, lore, and
hard constraints — not a record of work done.

---

## 1. The source assets and what each is FOR

All in `source/`:
- `target.png` — the match target (see below).
- `mask.png` — the crisp binary trace used for all measurement (see §1 tooling).
- `Milky_way_stargate_with_detailed_glyphs.svg` — the gate geometry base.
- `Dialing_computer_(2).webp`, `Dialing_computer_(Dialing).webp`,
  `Dialing_computer_(Pilot Animation).webp`, `Dialing_computer_(Unending).jpg` — secondary
  cross-check captures (active/dialing states; photographed at angles, not pixel-measurable).

### The gate geometry (the one true base)
`source/Milky_way_stargate_with_detailed_glyphs.svg` — authentic full vector Stargate.
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
- **`source/target.png` (1491×1074, flat-on) — CANONICAL layout frame.** Every HUD anchor is
  measured from `source/mask.png` (its crisp trace). This is the match target.
- The **CRT active/dialing captures** (`source/Dialing_computer_(2|Dialing|Unending).*`) are
  **behaviour/colour reference ONLY** — shot at an angle, uncropped/skewed, and a slightly
  **different panel variant** (their LEFT column is a scrolling binary-data panel where target.png
  has the timer/clock/numbers grid). Do NOT pixel-measure them. `Dialing_computer_(Pilot
  Animation).webp` is an even older animation style — animation reference only.

### What the active-state captures confirm (used for behaviour, not geometry)
- **STATUS text is phase-dependent**: `STATUS: ACTIVE` once the wormhole is up (vs `DIALING
  SEQUENCE` while dialing). The header `DESTINATION:` carries a colon in these captures.
- **Checklist** locked rows read `N OK` (checkbox + "OK"); a fully dialed address = all 7 `OK`.
- **Circuit + chevrons redden as each chevron engages.** Idle = all blue; per-lock = that chevron's
  V indicator + its box trace turn red; fully active (`Unending`) = ALL traces + ALL chevrons red.
- **Result boxes fill with the locked glyph in dialing order** — boxes 1–2 filled mid-dial
  (`(2).webp`), all 7 filled when complete (`Unending`).
- **Gate center** shows a big bold **hero glyph** while encoding each symbol; collapses to a small
  event-horizon point once the wormhole is active.
- **Chevrons render as inward-pointing V indicators (▽)** over a **segmented tick band** around the
  ring — both visible on the gate in every capture (and in target.png).
- **Circuit routing CONFIRMED**: the red traces run from boxes 1–3 directly (diagonal) to the
  right-hemisphere chevrons — matching `source/trace.json` `circuit`. Good cross-check of the topology.

### Visual-verification tooling — see **[PIPELINE.md](PIPELINE.md)** for the full pixel-perfect flow
The measurement loop (probe → grid → zoom → trace) reads `source/mask.png` and writes to
`tmp/<script>/`; `source/trace.json` is the design source and `scripts/trace.js` renders it. Legacy
`capture`/`diff` (compare a live app render to `source/target.png`) are used later, at build time.

### Sources & tmp layout
- **`source/`** holds the inputs: `target.png` (the dim CRT photo — the match target) and
  **`source/mask.png`** (a crisp binary trace of the same frame: black HUD line-art on white, no
  navy/noise/anti-alias haze — the authoritative geometry source). Plus the reference webp/svg.
- **`tmp/<script>/…`** holds outputs, one subfolder per script, filenames carrying their params.
  Nothing else lives loose in `tmp/`.

### Mask-based measurement
All §2 numbers were read from `source/mask.png` (not the photo). **The measurement/preview/verify
tooling — `probe`, `grid`, `zoom`, `trace.js`, `capture`, `diff` — lives in
[PIPELINE.md](PIPELINE.md).** SPECS only records the resulting facts; PIPELINE records how to get them.

### `source/trace.json` (THE design source — the "figma" for the HUD)
All HUD geometry in **target pixels (1491×1074)**, measured from the mask: every element is a
keyed block (`frame, rail, logoBay, header, timer, numbers, checklist, footer, boxes, gate,
circuit, texts`). `trace.js schema` renders it filled; `match` checks the fit. Once the preview
matches, `public/assets/layout.json` is derived from it (currently a copy of `source/trace.json`).

---

## 2. Screen-accurate facts and measurements

### Gate placement (MEASURED from `source/mask.png`, 1491×1074)
- Ring center: px **(743, 513)** = (0.498, 0.478). Outer rim radius **R = 315** px (0.211·W).
- Chevron radius 0.93·R; glyph track 0.70–0.875·R; **event-horizon / inner void 0.66·R**.
- **9 chevron tips (px, radially measured on the mask)** — feed these as the circuit endpoints:
  90→(743,196) · 50→(933,287) · 10→(1035,462) · 330→(1011,668) · 290→(848,802) ·
  250→(638,802) · 210→(476,667) · 170→(451,462) · 130→(553,287). (290/250 = unused bottom pair.)

### Other measured anchors (px @ 1491×1074; full set lives in `source/trace.json`)
- Outer frame: x0 29, y0 12, x1 1458, y1 1069, **plain rounded rectangle, corner r≈24 on all four
  corners (NO chamfer)**. The logo bay + header are separate boxes sitting inside the top-left;
  there is no diagonal cut in the frame itself. (An earlier "top-left chamfer" note was wrong.)
- Left-panel divider (vertical) at x≈288. Circuit **left rail** = nested verticals x≈300/307/314.
- Logo bay: x 47, y 30, w 128, h 120 (rounded box holding the 3D emblem).
- Header: panel x 187–1175, y 25–150. Music credit lines anchor at **x 200**, y 37 & 65 (left).
  Transport ◀◀▶▶ at x≈200, y 116. Binary-dot panel x 620–1160. DESTINATION text x 1112, y 73.
- Timer arc: center (150, 287), r 84 (open lower-right). Clock 17:56 (102,267) / date 29/03/20
  (102,313) / day 29 (138,344), left-anchored in `texts[]`.
- Numbers grid (2×3): columns x 100 & 215; value rows y 415 / 490 / 565; size 24; sparkline +33.
  Values [[2,8],[4,1],[1,4]].
- **STATUS is TEXT ONLY — there is NO bordered box** (the mask shows no border). "STATUS: DIALING
  SEQUENCE" at x 42, y 702 (left), in the gap between the numbers grid and the checklist.
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

### Text anchors (measured TOP-LEFT px + font size; all in `source/trace.json` `texts[]`, left-aligned)
credit1 "David Arnold arr. Joel Goldsmith" (200,37 s19) · credit2 "Stargate SG-1: Main Title"
(200,65 s19) · DESTINATION (1112,73 s28) · clock 17:56 (102,267 s33) · date 29/03/20 (102,313 s24)
· day 29 (138,344 s28) · STATUS: DIALING SEQUENCE (42,702 s18) · LST CODE # 1 (307,809 s26) ·
LST CODE # 2 (1016,809 s26) · AUTHORIZATION CODE: (292,1041 s21) · USER: SGT. W HARRIMAN
(1245,1021 s17) · SYS: NOMINAL (1245,1046 s17). Transport ◀◀▶▶ at (200,116). Numbers grid 2×3
values [[2,8],[4,1],[1,4]] at cols x 100/215, rows y 415/490/565, size 24, sparkline +33 below each.
(The SGC font is a wide custom face; monospace in the trace overlay reads a bit wider — anchors match.)

### Circuit anchors (the trace network — all in `source/trace.json` as explicit polylines)
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
- **Idle / standby** (`source/target.png`): the whole circuit is **blue**; chevrons are unlit
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
  assets/
    gate.svg            base gate (entities resolved)
    layout.json         figma model (anchors + circuit data + palette), copy of source/trace.json
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
scripts/{dev.js, serve.js, build.js}
dist/index.html          built, self-contained (inlines layout+SVG+bundle) — THE runnable file
```

Run: `bun run dev` (live reload) · `bun run build` → `dist/index.html` · `SERVE_DIST=1 bun run
preview` · `bun run lint`. Controls: Space = dial/abort · M = toggle mode · A = incoming
(Apophis) · click the SGC logo = show/hide the debug panel.

### Responsive rule
The GATE stays centred (`screen.js` `M.gate`, design centre 743,513). Everything else anchors to
the nearest viewport edge so extra space opens in the gaps, not by stretching art. Side panels pin
as **units at fixed height** via a settable y-anchor (`M.setY('top'|'bot'|'auto')`): numbers/timer
→ top-left (below header+logo), checklist → bottom-left, footer → bottom. At the design aspect all
anchors coincide → pixel-faithful.

---

## 7. Current build requirements (target state — implemented unless marked ⏳)

### Debug
- **Speed range** (⏳): a slider covering slow→fast, wired to a dialer **speed scale** that
  multiplies the constant rotation speed (and inversely the lock dwell). Keep the `fast` preset.

### HUD — auth block
- The AUTHORIZATION label + the segmented code + `USER:` + `SYS:` are **ONE block ("auth")**,
  **centred below the footer**, **fixed width (does not grow)**, with label/number/USER/SYS all
  **aligned** on a shared grid. (⏳ — currently three separate left/right anchored pieces.)

### Sidebar (the left numbers/timer panel) — now a live telemetry panel
- **Clock**: current time **HH:MM:SS** + **date** + **day-of-week** (seconds now shown).
- **remainingTime chart**: a horizontal **counter bar drawn behind the date**, fed by the 38-min
  `timerFrac`.
- **Six live metric rows**, each a number + a mini sparkline/bar below it:
  1. **FPS** (prefix `fps`) · 2. **render-loop duration** (ms) · 3. **gate rotation speed**
  (deg/frame) · 4. **target index** of the current rotation distance · 5. **HUD render time** (ms)
  · 6. **gate render time** (ms). (⏳ — replaces the static 2×3 placeholder numbers grid.)

### Header — transport controls (functional; ⏳)
Three buttons (currently the static `◀◀ ▶ ▶▶` glyphs):
- **Play/Pause** — toggles the rAF animation loop; icon reflects state (▶ when paused, ▌▌ when
  playing). Paused freezes the gate/HUD; play resumes.
- **Fast-forward (◀◀ / reset)** — *paused*: step one frame **back**; *playing*: **reset** the gate
  state to zero (re-arm the dial).
- **Forward (▶▶ / step)** — *paused*: advance **one frame**; *playing*: **skip to the next state**.

### Gate loading (⏳)
The gate is still the **SVG**, but **inlined in `index.html`** so it is part of the initial paint
(with a `preload`/eager hint), then a **minor CSS fade/scale transition** reveals it once `main.js`
is ready. Removes the blank-gate flash on load.

### Rendering direction — **ThreeJs all the way** (⏳, the major migration)
The 2D-canvas HUD is too slow on low-power targets (Raspberry Pi, modern smart-TV browsers) where
it should not be. **Move HUD rendering to Three.js/WebGL** so we can lean on the GPU, write
**shader effects**, and use **generated textures / charts** at a high, stable FPS. Phased plan:
1. **Composite swap** — keep the existing 2D draw functions but render them into an offscreen
   canvas → upload as a `CanvasTexture` on a fullscreen ortho quad. Immediate compositing win;
   gate emblem already in the same renderer.
2. **Static vs dynamic split** — bake the static layers (frame, panels, labels, box outlines,
   auth) to a texture **once per resize**; only re-upload the dynamic layers (timer, dots,
   circuits, glyphs, sidebar metrics, gate effects) per frame.
3. **Native WebGL layers** — replace the hottest dynamic layers (event horizon, kawoosh, binary
   dots, sparkline charts) with **shader materials / instanced geometry**; SDF/atlas text for
   labels. Keep `screen.js` anchoring and `layout.json` as the coordinate source of truth.
The gate ring itself stays the SVG (reliable everywhere, no GPU needed); the orthographic camera
already aligns WebGL 1:1 with the HUD coordinate space.
