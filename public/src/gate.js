// gate.js — the authentic Stargate, mounted as a LIVE recolored SVG (SPECS v5: no GPU needed).
// The symbol ring + ring circles + delimiters ROTATE; the chevron housings stay FIXED. Positioned
// so the SVG's true centre (263.691, 264.729) and outer radius (256.715) align with the HUD gate
// (layout.gate.cx/cy/R) under the same screen.fit transform the HUD canvas uses.

const VB = { cx: 263.691, cy: 264.729, rOuter: 256.715, w: 527.249, h: 526.275 };
const RING_GROUPS = ["Symbols", "Main_gate_parts", "Inner_Chevron_Delimiters", "Outer_Chevron_Delimiters"];

let svg = null, ringGroups = [];

export async function mountGate(host, base = "./assets/gate.svg") {
  // dist inlines the SVG as a global (self-contained build); dev fetches the file.
  const txt = window.__SGC_GATE_SVG__ || (await fetch(base).then((r) => r.text()));
  // Strip the XML prolog + DOCTYPE: its internal-subset close "]>" leaks as a visible text node
  // when assigned via innerHTML. Start at the <svg> root.
  const i = txt.indexOf("<svg");
  host.innerHTML = i >= 0 ? txt.slice(i) : txt;
  svg = host.querySelector("svg");
  svg.removeAttribute("width"); svg.removeAttribute("height");
  svg.style.position = "absolute"; svg.style.overflow = "visible";

  // recolor: cyan line-art, glyphs faint, ring circles brighter, housings pale
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  // recolor: cyan line-art. Constellation glyphs stay ON the ring (SPECS §3 project choice — they
  // differ from target.png's empty tick-band by design); circles + delimiter band carry the form.
  style.textContent = `
    svg * { vector-effect: non-scaling-stroke; }
    #Main_gate_parts circle { stroke:#3f7bd0; stroke-width:1.6; fill:none; filter:drop-shadow(0 0 2px rgba(60,120,255,.5)); }
    #Symbols path, #Symbols polygon { fill:#9fd0ff; stroke:none; opacity:.62; }
    #Inner_Chevron_Delimiters line { stroke:#cfe0ff; opacity:.6; }
    #Outer_Chevron_Delimiters line { stroke:#aecdf0; opacity:.45; }
    #Chevron_Locks path, #Chevron_Locks polygon, #Chevron_Locks polyline { fill:#eef4ff; stroke:#9fc0e8; stroke-width:.5; }
    #Alternative_Detailing line { stroke:#4a78b0; opacity:.45; }`;
  svg.insertBefore(style, svg.firstChild);

  ringGroups = RING_GROUPS.map((id) => svg.getElementById(id)).filter(Boolean);
  return { setLayout, setRotation };
}

// place + size the SVG so its centre/outer-radius land on the (centred) HUD gate (screen px)
export function setLayout(cx, cy, R) {
  if (!svg) return;
  const pxPerUnit = R / VB.rOuter;
  svg.setAttribute("viewBox", `0 0 ${VB.w} ${VB.h}`);
  svg.style.width = `${VB.w * pxPerUnit}px`; svg.style.height = `${VB.h * pxPerUnit}px`;
  svg.style.left = `${cx - VB.cx * pxPerUnit}px`;
  svg.style.top = `${cy - VB.cy * pxPerUnit}px`;
}

export function setRotation(deg) {
  if (!Number.isFinite(deg)) return;     // never write rotate(NaN ...) — would throw on the <g>
  const tf = `rotate(${deg} ${VB.cx} ${VB.cy})`;
  for (const g of ringGroups) g.setAttribute("transform", tf);
}

// ── engaged-chevron recolour: turn the real SVG chevron RED when its clamp locks (active/dialing) ──
const CHEV_ANGLES = [90, 50, 10, 330, 290, 250, 210, 170, 130];
let chevrons = null;   // [{ els:[path,polygon,polyline], ang }] — the 9 clamps in Chevron_Lock_1
const angDist = (x, y) => Math.abs(((x - y + 540) % 360) - 180);
function ensureChevrons() {
  if (chevrons) return;
  const lock1 = svg && svg.getElementById("Chevron_Lock_1");
  if (!lock1) { chevrons = []; return; }
  const els = [...lock1.querySelectorAll("path, polygon, polyline")];   // 9 × (path,polygon,polyline)
  const groups = [];
  for (let i = 0; i < els.length; i += 3) {
    const grp = els.slice(i, i + 3);
    let bb; try { bb = grp[0].getBBox(); } catch { bb = null; }
    if (!bb || !Number.isFinite(bb.x) || bb.width === 0) return;        // not laid out yet — retry next call
    const a = (Math.atan2(-((bb.y + bb.height / 2) - VB.cy), (bb.x + bb.width / 2) - VB.cx) * 180) / Math.PI;
    const ang = CHEV_ANGLES.reduce((p, c) => (angDist(c, a) < angDist(p, a) ? c : p), CHEV_ANGLES[0]);
    groups.push({ els: grp, ang });
  }
  chevrons = groups;
}
let litKey = "";
export function setLitChevrons(angles) {
  ensureChevrons();
  if (!chevrons || !chevrons.length) return;
  const key = angles.slice().sort().join(",");
  if (key === litKey) return;                  // only touch the DOM when the set changes
  litKey = key;
  const on = new Set(angles);
  for (const c of chevrons) {
    const lit = on.has(c.ang);
    for (const el of c.els) {
      const line = el.tagName.toLowerCase() === "polyline";
      el.style.fill = lit && !line ? "#d8281f" : "";       // "" reverts to the recolor stylesheet
      el.style.stroke = lit ? "#ff6a60" : "";
      el.style.filter = lit ? "drop-shadow(0 0 3px rgba(255,60,55,.95))" : "";
    }
  }
}

// angle (deg, SVG y-down convention) of a glyph's centre about the gate centre — used by the dialer
// to rotate the ring so a dialed glyph lands under its locking chevron.
export function glyphAngle(name) {
  const gl = getGlyph(name);
  if (!gl || gl._degenerate) return null;
  const a = (Math.atan2((gl.y + gl.h / 2) - VB.cy, (gl.x + gl.w / 2) - VB.cx) * 180) / Math.PI;
  return Number.isFinite(a) ? a : null;
}

// extract a glyph (by SPECS glyph name, e.g. "Origin") as a Path2D + bbox in gate-svg units, so the
// HUD can draw it filled in a result box or big as the hero glyph. Cached.
const glyphCache = {};
export function getGlyph(name) {
  if (name in glyphCache) return glyphCache[name];
  const el = svg && svg.getElementById(name);
  if (!el) return (glyphCache[name] = null);
  const path = new Path2D();
  el.querySelectorAll("path").forEach((n) => { const d = n.getAttribute("d"); if (d) try { path.addPath(new Path2D(d)); } catch { /* skip */ } });
  el.querySelectorAll("polygon, polyline").forEach((n) => {
    const nums = (n.getAttribute("points") || "").trim().split(/[\s,]+/).map(Number);
    if (nums.length < 4) return;
    let d = `M${nums[0]},${nums[1]}`;
    for (let i = 2; i + 1 < nums.length; i += 2) d += `L${nums[i]},${nums[i + 1]}`;
    if (n.tagName.toLowerCase() === "polygon") d += "Z";
    try { path.addPath(new Path2D(d)); } catch { /* skip */ }
  });
  let bb; try { bb = el.getBBox(); } catch { bb = null; }
  // Before layout, getBBox can return NaN/empty — return a transient (uncached) box so a later,
  // laid-out call recomputes instead of poisoning the cache (and any angle) with NaN.
  if (!bb || !Number.isFinite(bb.x) || !Number.isFinite(bb.width) || bb.width === 0) {
    return { path, x: 0, y: 0, w: 1, h: 1, _degenerate: true };
  }
  return (glyphCache[name] = { path, x: bb.x, y: bb.y, w: bb.width || 1, h: bb.height || 1 });
}
