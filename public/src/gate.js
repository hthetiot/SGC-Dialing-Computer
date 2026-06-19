// gate.js — the authentic Stargate, mounted as a LIVE recolored SVG (SPECS v5: no GPU needed).
// The symbol ring + ring circles + delimiters ROTATE; the chevron housings stay FIXED. Positioned
// so the SVG's true centre (263.691, 264.729) and outer radius (256.715) align with the HUD gate
// (layout.gate.cx/cy/R) under the same screen.fit transform the HUD canvas uses.

const VB = { cx: 263.691, cy: 264.729, rOuter: 256.715, w: 527.249, h: 526.275 };
const RING_GROUPS = ["Symbols", "Main_gate_parts", "Inner_Chevron_Delimiters", "Outer_Chevron_Delimiters"];

let svg = null, ringGroups = [];

export async function mountGate(host, base = "./assets/gate.svg") {
  const txt = await fetch(base).then((r) => r.text());
  host.innerHTML = txt;
  svg = host.querySelector("svg");
  svg.removeAttribute("width"); svg.removeAttribute("height");
  svg.style.position = "absolute"; svg.style.overflow = "visible";

  // recolor: cyan line-art, glyphs faint, ring circles brighter, housings pale
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `
    svg * { vector-effect: non-scaling-stroke; }
    #Main_gate_parts circle { stroke:#2f6bff; stroke-width:2; fill:none; filter:drop-shadow(0 0 2px rgba(60,120,255,.6)); }
    #Symbols path, #Symbols polygon { fill:#9fd0ff; stroke:#9fd0ff; stroke-width:.3; }
    #Inner_Chevron_Delimiters line, #Outer_Chevron_Delimiters line { stroke:#3f7bd0; opacity:.55; }
    #Chevron_Locks path, #Chevron_Locks polygon, #Chevron_Locks polyline { fill:#cfe4ff; stroke:#6fa8e6; stroke-width:.6; }
    #Alternative_Detailing line { stroke:#2c5aa0; opacity:.4; }`;
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
  const tf = `rotate(${deg} ${VB.cx} ${VB.cy})`;
  for (const g of ringGroups) g.setAttribute("transform", tf);
}
