// trace.js — VALIDATION PASS (no app code).
// Draws the hand-authored vector model from trace.json over tmp/target.png in distinct colors,
// with a legend, so every HUD line/path can be confirmed BEFORE writing app code.
//
//   node scripts/trace.js            # -> tmp/trace.png  (target underneath, 50% dimmed)
//   node scripts/trace.js raw        # -> overlay on black only
//
// Edit trace.json -> re-run -> eyeball tmp/trace.png. layout.json is derived once validated.

import http from "node:http";
import { spawn } from "node:child_process";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SRC = ROOT + "source/";
const OUTDIR = ROOT + "tmp/trace/";
mkdirSync(OUTDIR, { recursive: true });
// underlay: "target" (default, dim photo brightened) | "mask" (crisp trace) | "raw" (black)
const ARG = process.argv[2] || "target";
const RAW = ARG === "raw";
const UNDER = ARG === "mask" ? "mask.png" : "target.png";

const T = JSON.parse(readFileSync(ROOT + "trace.json", "utf8"));
const W = T.canvas.w, H = T.canvas.h;
// shape into the names the draw code expects
const MODEL = { frame: T.frame, rail: T.rail, logoBay: T.logoBay, header: T.header, timer: T.timer, numbers: T.numbers, status: T.status, checklist: T.checklist, footer: T.footer, boxes: T.boxes, gate: T.gate, texts: T.texts };
const CIRCUIT = T.circuit, LOCK_ORDER = T.lockOrder;

// ============================================================================
const ops = JSON.stringify({ W, H, MODEL, CIRCUIT, LOCK_ORDER, RAW, UNDER });

const HTML = `<!doctype html><meta charset=utf8><style>html,body{margin:0;background:#000}</style>
<canvas id=c></canvas><script>
const D = ${ops}, M = D.MODEL;
const c = document.getElementById('c'); c.width = D.W; c.height = D.H;
const g = c.getContext('2d');
const tip = (a) => [ M.gate.cx + M.gate.R*M.gate.chevR*Math.cos(a*Math.PI/180),
                     M.gate.cy - M.gate.R*M.gate.chevR*Math.sin(a*Math.PI/180) ];
function rr(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
function L(x0,y0,x1,y1){g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();}
function poly(pts){g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.stroke();}
function lab(t,x,y,col){g.fillStyle=col;g.font='12px monospace';g.fillText(t,x,y);}

function draw(img){
  const isMask = D.UNDER==='mask.png';
  g.fillStyle = isMask ? '#ffffff' : '#02060f'; g.fillRect(0,0,D.W,D.H);
  if(img){ g.save();
    if(isMask){ g.globalAlpha=0.32; g.drawImage(img,0,0,D.W,D.H); }       // crisp mask: just dim it
    else { g.globalAlpha=0.95; g.filter='brightness(1.9) saturate(0.7)'; g.drawImage(img,0,0,D.W,D.H); } // dim photo: brighten
    g.restore(); }
  g.lineWidth=2; g.textBaseline='top';

  // FRAME (red) — plain rounded rectangle (rounded corners, NO chamfer)
  g.strokeStyle='#ff2e2e';
  const f=M.frame;
  rr(f.x0, f.y0, f.x1-f.x0, f.y1-f.y0, f.r); g.stroke();

  // RAIL bus (orange): left divider + top rail + left circuit rail
  g.strokeStyle='#ff9e2c';
  L(M.rail.x, 135, M.rail.x, f.y1-20);                     // main left divider (below header)
  g.setLineDash([6,4]);
  L(M.rail.busX, M.rail.topY, M.rail.busX, M.gate.cy+40);  // circuit left rail
  L(M.rail.busX, M.rail.topY, M.boxes.lanesX[3], M.rail.topY); // top rail
  g.setLineDash([]);
  lab('rail/bus', M.rail.x+4, 139, '#ff9e2c');

  // LOGO BAY (yellow)
  g.strokeStyle='#ffe23b'; rr(M.logoBay.x,M.logoBay.y,M.logoBay.w,M.logoBay.h,8); g.stroke();
  lab('logoBay', M.logoBay.x, M.logoBay.y-14, '#ffe23b');

  // HEADER (gold)
  g.strokeStyle='#d8b24a'; const hd=M.header;
  rr(hd.panelX0,hd.panelY0,hd.panelX1-hd.panelX0,hd.panelY1-hd.panelY0,10); g.stroke();
  lab('transport', hd.transportX, hd.transportY-2, '#d8b24a');
  g.strokeRect(hd.binaryX0,hd.binaryY0,hd.binaryX1-hd.binaryX0,hd.binaryY1-hd.binaryY0); // binary dot panel
  lab('binary dots', hd.binaryX0, hd.binaryY0-14, '#d8b24a');

  // TIMER ARC (green) + clock
  g.strokeStyle='#22ff88'; const t=M.timer;
  g.beginPath(); g.arc(t.cx,t.cy,t.r, -Math.PI*0.16, Math.PI*1.16, false); g.stroke();
  lab('17:56', t.clockX, t.clockY, '#22ff88');
  lab('date', t.clockX, t.dateY, '#22ff88'); lab('day', t.clockX, t.dayY, '#22ff88');

  // NUMBERS grid (teal) 2x3 + sparklines
  g.strokeStyle='#19d3c5'; const n=M.numbers;
  for(let r=0;r<n.rows;r++) for(let ccol=0;ccol<n.cols;ccol++){
    const x=n.x0+ccol*n.colGap, y=n.y0+r*n.rowGap;
    g.fillStyle='#19d3c5'; g.fillText('#', x, y);
    L(x-8,y+n.sparkDown, x+90, y+n.sparkDown);  // sparkline baseline
  }
  lab('numbersGrid', n.x0, n.y0-16, '#19d3c5');

  // STATUS — text only, NO box (magenta marker at the text anchor)
  const st=M.status; g.fillStyle='#ff45ff'; g.beginPath(); g.arc(st.cx,st.y,3,0,7); g.fill();

  // CHECKLIST (pink): panel + 7 rows [sq][redbar][num][sq] + right tab divider
  const cl=M.checklist; g.strokeStyle='#ff7ad0'; rr(cl.x,cl.y,cl.w,cl.h,8); g.stroke();
  L(cl.rightTabX, cl.y, cl.rightTabX, cl.y+cl.h);                            // right-tab vertical divider
  for(let i=0;i<cl.rows;i++){
    const cy=cl.bar0Y+i*cl.barStepY;
    g.strokeStyle='#ff7ad0'; g.strokeRect(cl.sqL-8, cy-8, 16,16);            // left square
    g.strokeRect(cl.sqR-8, cy-8, 16,16);                                     // right square
    g.fillStyle='#ff3b3b'; rr(cl.barL, cy-8, cl.barR-cl.barL, 16, 7); g.fill(); // RED bar
    g.fillStyle='#7fd0ff'; g.fillText(String(i+1), cl.numX, cy-7);           // blue number
  }
  lab('checklist x7 (red bars)', cl.x, cl.y-16, '#ff7ad0');

  // FOOTER (cyan)
  g.strokeStyle='#00e5ff'; const ft=M.footer;
  g.fillStyle='#00e5ff'; g.beginPath(); g.arc(ft.lst1X,ft.lstY,3,0,7); g.fill(); g.beginPath(); g.arc(ft.lst2X,ft.lstY,3,0,7); g.fill();
  rr(ft.readout.x,ft.readout.y,ft.readout.w,ft.readout.h,8); g.stroke();      // readout box
  lab('readout', ft.readout.x+4, ft.readout.y+4, '#00e5ff');
  const cw=(ft.authCellX1-ft.authCellX0)/ft.authCells;
  for(let i=0;i<ft.authCells;i++){ if(i===ft.dashCell) continue; g.strokeRect(ft.authCellX0+i*cw+1, ft.authY-6, cw-2, 30); }
  lab('auth cells', ft.authCellX0, ft.authY-20, '#00e5ff');

  // RESULT BOXES (lime) + numbers
  g.strokeStyle='#7CFC00'; const bx=M.boxes;
  for(let i=0;i<bx.count;i++){ const y=bx.top0+i*bx.stepY; rr(bx.left,y,bx.right-bx.left,bx.h,10); g.stroke();
    g.fillStyle='#7CFC00'; g.fillText(String(i+1), bx.left+bx.numDX, y+bx.numDY); }
  lab('resultBoxes', bx.left-4, bx.top0-16, '#7CFC00');

  // GATE (white rings + chevrons)
  g.strokeStyle='#ffffff'; g.lineWidth=1.5;
  for(const k of M.gate.rings){ g.beginPath(); g.arc(M.gate.cx,M.gate.cy,M.gate.R*k,0,7); g.stroke(); }
  for(const a of M.gate.chevrons){ const[x,y]=tip(a); const used=!M.gate.unused.includes(a);
    g.fillStyle=used?'#fff':'#666'; g.beginPath(); g.arc(x,y,5,0,7); g.fill();
    g.fillStyle=used?'#fff':'#666'; g.fillText(a+'°', x-8, y-18); }
  g.lineWidth=2;

  // CIRCUIT (per-route colors) — explicit measured polylines from trace.json
  const palette=['#ff5d5d','#ffd24d','#7CFC00','#36d0ff','#b06bff','#ff8ad0','#ffffff'];
  D.CIRCUIT.forEach((rt,i)=>{
    g.strokeStyle=palette[i]; g.lineWidth=2.5;
    if(rt.pts) poly(rt.pts);
    g.lineWidth=2;
  });
  // chevron tip markers (measured)
  if(M.gate.tips){ g.fillStyle='#00e5ff'; for(const k in M.gate.tips){ const[tx,ty]=M.gate.tips[k]; g.beginPath(); g.arc(tx,ty,3,0,7); g.fill(); } }

  // TEXT ANCHORS (orange) — every text element drawn at its measured anchor
  if(M.texts){ g.font='13px monospace'; g.textBaseline='top';
    for(const tt of M.texts){ const sz=tt.size||14; g.font=sz+'px monospace';
      g.textAlign=tt.align==='center'?'center':'left';
      g.fillStyle='#ff7a1a'; g.fillText(tt.t, tt.x, tt.y);
      g.fillStyle='#ffd24d'; g.beginPath(); g.arc(tt.x, tt.y, 2.5, 0, 7); g.fill();   // anchor dot
    }
    g.textAlign='left'; g.font='13px monospace';
  }

  // LEGEND — placed in the empty gate void so it covers no HUD content
  const lx = M.gate.cx - 120, ly = M.gate.cy - 118;
  g.globalAlpha=0.82; g.fillStyle='#000'; g.fillRect(lx-8, ly-8, 248, 246); g.globalAlpha=1;
  const leg=[['#ff2e2e','outerFrame (rounded)'],['#ff9e2c','rail / circuit bus'],['#ffe23b','logoBay'],['#d8b24a','header'],['#22ff88','timer+clock'],['#19d3c5','numbers grid'],['#ff45ff','STATUS box'],['#ff7ad0','checklist x7'],['#00e5ff','footer'],['#7CFC00','result boxes'],['#ffffff','gate rings/chevrons'],['rainbow','circuit traces (7)']];
  g.font='13px monospace'; leg.forEach((e,i)=>{ g.fillStyle=e[0]==='rainbow'?'#fff':e[0]; g.fillRect(lx,ly+i*19,12,12); g.fillStyle='#cfe0ff'; g.fillText(e[1], lx+18, ly+i*19); });
}
const img=new Image(); img.onload=()=>draw(${RAW?'null':'img'}); img.onerror=()=>draw(null); img.src='/img';
</script>`;

const server = http.createServer((req, res) => {
  const p = new URL(req.url, "http://x").pathname;
  if (p === "/_t.html") { res.writeHead(200, { "content-type": "text/html" }); res.end(HTML); return; }
  if (p === "/img") { res.writeHead(200, { "content-type": "image/png" }); res.end(readFileSync(SRC + UNDER)); return; }
  res.writeHead(404); res.end("404");
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const out = `${OUTDIR}trace_${ARG}.png`;
const findChrome = () => { for (const c of ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"]) if (existsSync(c)) return c; return "chrome"; };
const code = await new Promise((resolve) => {
  const proc = spawn(findChrome(), ["--headless=new", "--disable-gpu", "--enable-unsafe-swiftshader", "--hide-scrollbars", `--window-size=${W},${H}`, `--screenshot=${out}`, "--virtual-time-budget=1000", `http://localhost:${port}/_t.html`], { stdio: "ignore" });
  const timer = setTimeout(() => proc.kill("SIGKILL"), 30000);
  proc.on("error", (e) => { clearTimeout(timer); console.error(e.message); resolve(-1); });
  proc.on("exit", (c) => { clearTimeout(timer); resolve(c); });
});
console.log(code === 0 && existsSync(out) ? `✓ ${out}` : `✗ failed (${code})`);
server.close(); process.exit(0);
