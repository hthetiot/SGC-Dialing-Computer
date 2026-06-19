// trace.js — RENDERER for source/trace.json.
//
//   node scripts/trace.js [target|mask|raw]  # VALIDATION overlay: distinct-colour vectors + legend
//                                            #   over the brightened target / dimmed mask / black
//   node scripts/trace.js schema             # PREVIEW: filled, SGC-styled render on dark bg
//   node scripts/trace.js match              # schema preview overlaid on the real target @ opacity
//
// Outputs -> tmp/trace/<mode>.png.
//
// ROLES (important):
//   • source/trace.json  = the DESIGN SOURCE ("figma"): pure data — geometry, text, values, colours.
//                          It is what the app IMPLEMENTATION consumes; keep it rich + descriptive.
//   • scripts/trace.js   = the RENDERER. It MAY contain logic (how each element is drawn). Tweak the
//                          drawing here; put measurements/data in trace.json, never inline them here.
//
// For an automated/LLM pass: only edit between the `LLM-EDIT REGION` markers below (the render
// logic). Everything outside them is boilerplate (paths, arg parsing, headless-Chrome plumbing).

import http from "node:http";
import { spawn } from "node:child_process";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SRC = ROOT + "source/";
const OUTDIR = ROOT + "tmp/trace/";
mkdirSync(OUTDIR, { recursive: true });
// modes: target (default) | mask | raw | schema | match
const ARG = process.argv[2] || "target";
const RAW = ARG === "raw";
const SCHEMA = ARG === "schema" || ARG === "match";
const MATCH = ARG === "match";
const MATCH_OP = Number(process.argv[3] ?? 0.62);   // node scripts/trace.js match 0.5
const UNDER = ARG === "match" ? "target.png" : ARG === "mask" ? "mask.png" : "target.png";

// trace.js holds NO data — everything (geometry, text, values, colours) comes from trace.json.
const T = JSON.parse(readFileSync(ROOT + "source/trace.json", "utf8"));
const GATE_SVG = readFileSync(ROOT + "public/assets/gate.svg", "utf8").replace(/<\/?script/gi, "");  // for box glyphs
const W = T.canvas.w, H = T.canvas.h;
const MODEL = { frame: T.frame, rail: T.rail, logoBay: T.logoBay, header: T.header, timer: T.timer, numbers: T.numbers, binaryDots: T.binaryDots, status: T.status, checklist: T.checklist, footer: T.footer, boxes: T.boxes, gate: T.gate, texts: T.texts };
const CIRCUIT = T.circuit, STYLE = T.style;

// ============================================================================
const ops = JSON.stringify({ W, H, MODEL, CIRCUIT, STYLE, RAW, UNDER, SCHEMA, MATCH, MATCH_OP });

// ╔══════════════════════════ LLM-EDIT REGION START ══════════════════════════╗
// Rendering logic only (runs in the headless-Chrome canvas). All numbers/text/colours come from
// trace.json via `M`/`D.STYLE`; do not hard-code data here — edit trace.json for that.
const HTML = `<!doctype html><meta charset=utf8><style>html,body{margin:0;background:#000}</style>
<div id=gatesrc style="position:absolute;left:-9999px;top:0">${GATE_SVG}</div>
<canvas id=c></canvas><script>
const D = ${ops}, M = D.MODEL;
// extract a gate-svg glyph (by name) as a Path2D + bbox, for drawing the locked symbol in a box
const _gsvg = document.querySelector('#gatesrc svg'), _gc = {};
function glyphOf(name){ if(name in _gc) return _gc[name]; const el=_gsvg&&_gsvg.getElementById(name); if(!el) return _gc[name]=null;
  const path=new Path2D(); el.querySelectorAll('path').forEach(n=>{const d=n.getAttribute('d');if(d)try{path.addPath(new Path2D(d));}catch(e){}});
  el.querySelectorAll('polygon,polyline').forEach(n=>{const v=(n.getAttribute('points')||'').trim().split(/[\\s,]+/).map(Number);if(v.length<4)return;let d='M'+v[0]+','+v[1];for(let i=2;i+1<v.length;i+=2)d+='L'+v[i]+','+v[i+1];if(n.tagName.toLowerCase()==='polygon')d+='Z';try{path.addPath(new Path2D(d));}catch(e){}});
  let bb;try{bb=el.getBBox();}catch(e){bb={x:0,y:0,width:1,height:1};} return _gc[name]={path,x:bb.x,y:bb.y,w:bb.width||1,h:bb.height||1}; }
function boxGlyph(name, cx, cy, sizePx, col){ const gl=glyphOf(name); if(!gl) return; const s=sizePx/Math.max(gl.w,gl.h);
  g.save(); g.translate(cx,cy); g.scale(s,s); g.translate(-(gl.x+gl.w/2),-(gl.y+gl.h/2));
  g.fillStyle=col; g.strokeStyle=col; g.lineJoin='round'; g.lineCap='round'; g.lineWidth=2/s; g.stroke(gl.path); g.fill(gl.path); g.restore(); }
const c = document.getElementById('c'); c.width = D.W; c.height = D.H;
const g = c.getContext('2d');
const tip = (a) => [ M.gate.cx + M.gate.R*M.gate.chevR*Math.cos(a*Math.PI/180),
                     M.gate.cy - M.gate.R*M.gate.chevR*Math.sin(a*Math.PI/180) ];
function rr(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
function L(x0,y0,x1,y1){g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();}
function poly(pts){g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.stroke();}
function lab(t,x,y,col){g.fillStyle=col;g.font='12px monospace';g.fillText(t,x,y);}
// binary-dot panel: partial corner brackets (only the listed corners) + a deterministic dot scatter
function bdots(z,dotCol,borderCol){
  g.strokeStyle=borderCol; g.lineWidth=1.5; const A=12;
  const corner=(cx,cy,dx,dy)=>{g.beginPath();g.moveTo(cx+dx*A,cy);g.lineTo(cx,cy);g.lineTo(cx,cy+dy*A);g.stroke();};
  const c=z.corners||[];
  if(c.includes('tl'))corner(z.x,z.y,1,1); if(c.includes('tr'))corner(z.x+z.w,z.y,-1,1);
  if(c.includes('bl'))corner(z.x,z.y+z.h,1,-1); if(c.includes('br'))corner(z.x+z.w,z.y+z.h,-1,-1);
  g.fillStyle=dotCol; const cw=z.w/z.cols, ch=z.h/z.rows;
  for(let j=0;j<z.rows;j++)for(let i=0;i<z.cols;i++){ if(((i*7+j*13+(z.seed||0)*5)%5)<2)
    g.fillRect(z.x+i*cw+cw/2-1.5, z.y+j*ch+ch/2-1.5, 3, 3); }
}
// sparkline mini-chart: a near-flat WAVY data line + a straight baseline beneath it
function spark(sx,sy,sw,base,seed,col){
  g.strokeStyle=col; g.lineWidth=1.2;
  g.beginPath(); g.moveTo(sx,sy);
  for(let k=1;k<=12;k++){ const t=seed+k*5; const b=(t%9<2)?-5:(t%5<2?-2:0); g.lineTo(sx+k*sw/12, sy+b); }
  g.stroke();
  g.beginPath(); g.moveTo(sx,sy+base); g.lineTo(sx+sw,sy+base); g.stroke();
}

// ---- SCHEMA: filled, SGC-styled preview of trace.json (the design render) -------------------
function schema(img){
  const s=D.STYLE.schema;
  const P = { bg:s.bg, blue:s.line, cyan:s.text, white:s.white, dim:s.dim, red:s.red, glow:s.glow, panel:s.panel };
  g.fillStyle=P.bg; g.fillRect(0,0,D.W,D.H);
  if(img){ g.save(); g.globalAlpha=0.95; g.filter='brightness(1.7)'; g.drawImage(img,0,0,D.W,D.H); g.restore(); }
  if(D.MATCH) g.globalAlpha=D.MATCH_OP;
  g.textBaseline='top'; g.textAlign='left'; g.lineJoin='round';
  const text=(t,x,y,s,col)=>{ g.font=(s||14)+'px "DejaVu Sans Mono",monospace'; g.fillStyle=col||P.cyan; g.fillText(t,x,y); };
  const stroke=(col,w)=>{ g.strokeStyle=col; g.lineWidth=w||2; g.stroke(); };

  // frame (glowing blue)
  const f=M.frame; g.shadowColor=P.glow; g.shadowBlur=8;
  rr(f.x0,f.y0,f.x1-f.x0,f.y1-f.y0,f.r); stroke(P.blue,3); g.shadowBlur=0;

  // rail divider + circuit bus
  g.strokeStyle=P.blue; g.lineWidth=2; L(M.rail.x,135,M.rail.x,f.y1-20);

  // logoBay
  rr(M.logoBay.x,M.logoBay.y,M.logoBay.w,M.logoBay.h,8); stroke(P.blue,2);

  // header panel + transport
  const hd=M.header; rr(hd.panelX0,hd.panelY0,hd.panelX1-hd.panelX0,hd.panelY1-hd.panelY0,10); stroke(P.blue,2);
  text(hd.transport, hd.transportX, hd.transportY, 16, P.cyan);

  // binary-dot panels (header-mid / header-tr / footer-left) — partial purple corners + dots
  for(const z of (M.binaryDots||[])) bdots(z, P.white, D.STYLE.layers.binaryDots);

  // timer arc + clock/date/day
  const t=M.timer; g.strokeStyle=P.blue; g.lineWidth=8; g.beginPath(); g.arc(t.cx,t.cy,t.r,-Math.PI*0.16,Math.PI*1.16,false); g.stroke(); g.lineWidth=2;

  // numbers grid + sparklines (wavy data line + straight baseline)
  const n=M.numbers;
  for(let r=0;r<n.rows;r++) for(let cc=0;cc<n.cols;cc++){ const x=n.x0+cc*n.colGap, y=n.y0+r*n.rowGap;
    text(String(n.values[r][cc]), x, y, n.size||22, P.white);
    spark(n.sparkX+cc*n.sparkColGap, y+n.sparkDown, n.sparkW, n.sparkBase, r*3+cc, P.text); }
  g.lineWidth=2;

  // checklist — filled panel + red bars + squares + numbers
  const cl=M.checklist; g.fillStyle=P.panel; rr(cl.x,cl.y,cl.w,cl.h,8); g.fill(); stroke(P.blue,2);
  g.strokeStyle=P.blue; g.lineWidth=1.5; L(cl.rightTabX,cl.y,cl.rightTabX,cl.y+cl.h); g.lineWidth=2;
  for(let i=0;i<cl.rows;i++){ const cy=cl.bar0Y+i*cl.barStepY;
    g.strokeStyle=P.cyan; g.lineWidth=1.5; g.strokeRect(cl.sqL-8,cy-8,16,16); g.strokeRect(cl.sqR-8,cy-8,16,16);
    g.fillStyle=P.red; g.shadowColor='rgba(255,45,54,.8)'; g.shadowBlur=5; rr(cl.barL,cy-8,cl.barR-cl.barL,16,7); g.fill(); g.shadowBlur=0;
    text(String(i+1), cl.numX, cy-8, 14, P.cyan); }
  g.lineWidth=2;

  // footer — readout box + auth cells (postal-code: a digit boxed in each cell, 2 groups + dash)
  const ft=M.footer; rr(ft.readout.x,ft.readout.y,ft.readout.w,ft.readout.h,8); stroke(P.blue,2);
  { const a=ft.auth, digits=a.text.replace('-',''); let di=0;
    g.strokeStyle=P.blue; g.lineWidth=1.5;
    const grp=(x,n)=>{ for(let i=0;i<n;i++){ const cx=x+i*a.cellW;
      g.strokeRect(cx, a.cellTop, a.cellW, a.cellH);
      text(digits[di++]||'', cx+a.cellW/2-a.size*0.28, a.digitTop, a.size, P.white); } };
    grp(a.g1x,a.g1n); grp(a.g2x,a.g2n);
    text('-', a.dashX, a.digitTop, a.size, P.white); g.lineWidth=2; }

  // boxes — outlined + bold number + the locked constellation glyph (white line-figure, dialing refs)
  const bx=M.boxes;
  for(let i=0;i<bx.count;i++){ const y=bx.top0+i*bx.stepY; rr(bx.left,y,bx.right-bx.left,bx.h,10); stroke(P.blue,2);
    text(String(i+1), bx.left+bx.numDX, y+bx.numDY, bx.numSize||30, P.white);
    const gn=bx.glyphNames&&bx.glyphNames[i]; if(gn) boxGlyph(gn, (bx.left+bx.right)/2, y+bx.h/2, bx.h*(bx.glyphSize||0.6), P.white); }

  // gate — concentric rings + segmented tick band + chevron Vs
  g.strokeStyle=P.white;
  for(const k of M.gate.rings){ g.lineWidth=k===1?2.5:1.2; g.strokeStyle=k===1?P.blue:'rgba(180,210,255,.7)'; g.beginPath(); g.arc(M.gate.cx,M.gate.cy,M.gate.R*k,0,7); g.stroke(); }
  if(M.gate.ticks){ const tk=M.gate.ticks; g.strokeStyle='rgba(150,190,255,.55)'; g.lineWidth=1;
    for(let i=0;i<tk.count;i++){ const a=i/tk.count*Math.PI*2, cx=Math.cos(a), sy=Math.sin(a);
      g.beginPath(); g.moveTo(M.gate.cx+M.gate.R*tk.r0*cx, M.gate.cy+M.gate.R*tk.r0*sy);
      g.lineTo(M.gate.cx+M.gate.R*tk.r1*cx, M.gate.cy+M.gate.R*tk.r1*sy); g.stroke(); } }
  g.lineWidth=2;
  for(const a of M.gate.chevrons){ const tp=M.gate.tips&&M.gate.tips[a]; if(!tp) continue; const used=!M.gate.unused.includes(a);
    const ang=a*Math.PI/180, ux=Math.cos(ang), uy=-Math.sin(ang);            // outward unit
    const px=-uy, py=ux;                                                       // perpendicular
    g.strokeStyle=used?P.white:'rgba(120,140,170,.6)'; g.lineWidth=2.5;
    g.beginPath(); g.moveTo(tp[0]-px*14-ux*10, tp[1]-py*14-uy*10); g.lineTo(tp[0]+ux*6, tp[1]+uy*6); g.lineTo(tp[0]+px*14-ux*10, tp[1]+py*14-uy*10); g.stroke(); }
  g.lineWidth=2;

  // circuit — blue idle traces
  g.strokeStyle='rgba(90,150,255,.85)'; g.lineWidth=1.5;
  D.CIRCUIT.forEach((rt)=>{ if(rt.pts) poly(rt.pts); }); g.lineWidth=2;

  // all standalone texts in cyan
  for(const tt of (M.texts||[])) text(tt.t, tt.x, tt.y, tt.size||14, P.cyan);
  g.globalAlpha=1;
}

function draw(img){
  const isMask = D.UNDER==='mask.png';
  g.fillStyle = isMask ? '#ffffff' : D.STYLE.schema.bg; g.fillRect(0,0,D.W,D.H);
  if(img){ g.save();
    if(isMask){ g.globalAlpha=0.32; g.drawImage(img,0,0,D.W,D.H); }       // crisp mask: just dim it
    else { g.globalAlpha=0.95; g.filter='brightness(1.9) saturate(0.7)'; g.drawImage(img,0,0,D.W,D.H); } // dim photo: brighten
    g.restore(); }
  g.lineWidth=2; g.textBaseline='top';

  // Colour per HUD layer comes from trace.json style.layers (names match the trace.json keys).
  const COL = D.STYLE.layers;

  // frame — plain rounded rectangle (rounded corners, NO chamfer)
  const f=M.frame; g.strokeStyle=COL.frame; rr(f.x0,f.y0,f.x1-f.x0,f.y1-f.y0,f.r); g.stroke();

  // rail — left panel divider + circuit bus (left rail + top rail), dashed for the bus
  g.strokeStyle=COL.rail; L(M.rail.x, 135, M.rail.x, f.y1-20);
  g.setLineDash([6,4]);
  L(M.rail.busX, M.rail.topY, M.rail.busX, M.gate.cy+40);
  L(M.rail.busX, M.rail.topY, M.boxes.lanesX[3], M.rail.topY);
  g.setLineDash([]);

  // logoBay
  g.strokeStyle=COL.logoBay; rr(M.logoBay.x,M.logoBay.y,M.logoBay.w,M.logoBay.h,8); g.stroke();

  // header — panel + transport glyphs
  const hd=M.header; g.strokeStyle=COL.header;
  rr(hd.panelX0,hd.panelY0,hd.panelX1-hd.panelX0,hd.panelY1-hd.panelY0,10); g.stroke();
  g.fillStyle=COL.header; g.font='16px monospace'; g.textBaseline='top';
  g.fillText(hd.transport, hd.transportX, hd.transportY);   // transport glyphs

  // binaryDots — partial-corner dot panels (header-mid / header-tr / footer-left)
  for(const z of (M.binaryDots||[])) bdots(z, COL.binaryDots, COL.binaryDots);

  // timer — arc only (the 17:56 / date / day text lives in texts[])
  const t=M.timer; g.strokeStyle=COL.timer;
  g.beginPath(); g.arc(t.cx,t.cy,t.r, -Math.PI*0.16, Math.PI*1.16, false); g.stroke();

  // numbers — 2x3 grid of values + a sparkline (wavy + baseline) under each
  const n=M.numbers; g.fillStyle=COL.numbers;
  for(let r=0;r<n.rows;r++) for(let cc=0;cc<n.cols;cc++){
    const x=n.x0+cc*n.colGap, y=n.y0+r*n.rowGap;
    g.font=(n.size||22)+'px monospace'; g.fillStyle=COL.numbers; g.fillText(String(n.values[r][cc]), x, y);
    spark(n.sparkX+cc*n.sparkColGap, y+n.sparkDown, n.sparkW, n.sparkBase, r*3+cc, COL.numbers);
  }

  // checklist — panel + 7 rows [sq][red bar][num][sq] + right-tab divider
  const cl=M.checklist; g.strokeStyle=COL.checklist; rr(cl.x,cl.y,cl.w,cl.h,8); g.stroke();
  L(cl.rightTabX, cl.y, cl.rightTabX, cl.y+cl.h);
  for(let i=0;i<cl.rows;i++){ const cy=cl.bar0Y+i*cl.barStepY;
    g.strokeStyle=COL.checklist; g.strokeRect(cl.sqL-8,cy-8,16,16); g.strokeRect(cl.sqR-8,cy-8,16,16);
    g.fillStyle='#ff3b3b'; rr(cl.barL,cy-8,cl.barR-cl.barL,16,7); g.fill();
    g.fillStyle='#7fd0ff'; g.font='13px monospace'; g.fillText(String(i+1), cl.numX, cy-7);
  }

  // footer — readout box + segmented auth cells (LST / AUTH / USER / SYS text live in texts[])
  const ft=M.footer; g.strokeStyle=COL.footer;
  rr(ft.readout.x,ft.readout.y,ft.readout.w,ft.readout.h,8); g.stroke();
  { const a=ft.auth; const grp=(x,n)=>{ for(let i=0;i<n;i++) g.strokeRect(x+i*a.cellW, a.cellTop, a.cellW, a.cellH); };
    grp(a.g1x,a.g1n); grp(a.g2x,a.g2n); }

  // boxes — 7 result boxes + bold number at lower-left
  const bx=M.boxes; g.strokeStyle=COL.boxes;
  for(let i=0;i<bx.count;i++){ const y=bx.top0+i*bx.stepY; rr(bx.left,y,bx.right-bx.left,bx.h,10); g.stroke();
    g.fillStyle=COL.boxes; g.font=(bx.numSize||30)+'px monospace'; g.fillText(String(i+1), bx.left+bx.numDX, y+bx.numDY); }

  // gate — rings + chevron tip markers (measured)
  g.strokeStyle=COL.gate; g.lineWidth=1.5;
  for(const k of M.gate.rings){ g.beginPath(); g.arc(M.gate.cx,M.gate.cy,M.gate.R*k,0,7); g.stroke(); }
  g.lineWidth=2;

  // circuit — explicit measured polylines, one colour per route
  const pal=D.STYLE.circuitPalette;
  D.CIRCUIT.forEach((rt,i)=>{ g.strokeStyle=pal[i%pal.length]; g.lineWidth=2.5; if(rt.pts) poly(rt.pts); g.lineWidth=2; });
  // blue dots = each circuit's CHEVRON anchor (its last point), like chevron 7
  g.fillStyle='#00e5ff'; D.CIRCUIT.forEach(rt=>{ if(rt.pts){ const p=rt.pts[rt.pts.length-1]; g.beginPath(); g.arc(p[0],p[1],4,0,7); g.fill(); } });

  // texts — every standalone label at its measured TOP-LEFT anchor, sized to the mask
  g.textBaseline='top'; g.textAlign='left';
  for(const tt of (M.texts||[])){ g.font=(tt.size||14)+'px monospace';
    g.fillStyle=COL.texts; g.fillText(tt.t, tt.x, tt.y);
    g.fillStyle='#ffd24d'; g.beginPath(); g.arc(tt.x, tt.y, 2, 0, 7); g.fill(); }    // anchor dot
  g.font='13px monospace';

  // LEGEND — element list (names match trace.json keys), placed in the empty gate void
  const lx=M.gate.cx-118, ly=M.gate.cy-118;
  g.globalAlpha=0.82; g.fillStyle='#000'; g.fillRect(lx-8,ly-8,240,250); g.globalAlpha=1;
  const leg=Object.keys(COL).map(k=>[k, k==='circuit'?'rainbow':COL[k]]);   // derived from style.layers
  g.font='13px monospace'; g.textAlign='left';
  leg.forEach((e,i)=>{ g.fillStyle=e[1]==='rainbow'?'#fff':e[1]; g.fillRect(lx,ly+i*20,12,12);
    g.fillStyle='#cfe0ff'; g.fillText(e[0], lx+18, ly+i*20); });
}
const render=(im)=> D.SCHEMA ? schema(D.MATCH?im:null) : draw(${RAW?'null':'im'});
const img=new Image(); img.onload=()=>render(img); img.onerror=()=>render(null); img.src='/img';
</script>`;
// ╚═══════════════════════════ LLM-EDIT REGION END ═══════════════════════════╝

const server = http.createServer((req, res) => {
  const p = new URL(req.url, "http://x").pathname;
  if (p === "/_t.html") { res.writeHead(200, { "content-type": "text/html" }); res.end(HTML); return; }
  if (p === "/img") { res.writeHead(200, { "content-type": "image/png" }); res.end(readFileSync(SRC + UNDER)); return; }
  res.writeHead(404); res.end("404");
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const out = `${OUTDIR}${SCHEMA ? ARG : "trace_" + ARG}.png`;
const findChrome = () => { for (const c of ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"]) if (existsSync(c)) return c; return "chrome"; };
const code = await new Promise((resolve) => {
  const proc = spawn(findChrome(), ["--headless=new", "--disable-gpu", "--enable-unsafe-swiftshader", "--hide-scrollbars", `--window-size=${W},${H}`, `--screenshot=${out}`, "--virtual-time-budget=1000", `http://localhost:${port}/_t.html`], { stdio: "ignore" });
  const timer = setTimeout(() => proc.kill("SIGKILL"), 30000);
  proc.on("error", (e) => { clearTimeout(timer); console.error(e.message); resolve(-1); });
  proc.on("exit", (c) => { clearTimeout(timer); resolve(c); });
});
console.log(code === 0 && existsSync(out) ? `✓ ${out}` : `✗ failed (${code})`);
server.close(); process.exit(0);
