// dev.js — Bun dev server with live reload.
// Serves ./public, watches source files, and pushes a reload event over SSE so the browser
// refreshes whenever you save. Use: `bun run dev` → http://localhost:8787

import { watch } from "node:fs";
import { fileURLToPath } from 'url'

const ROOT = fileURLToPath(new URL("../public/", import.meta.url))
const PORT = Number(process.env.PORT ?? 8787);

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon", ".css": "text/css; charset=utf-8",
};
const typeFor = (p) => TYPES[p.slice(p.lastIndexOf("."))] ?? "application/octet-stream";

// connected SSE clients
const clients = new Set();
function notifyReload() {
  for (const c of clients) {
    try { c.enqueue(`data: reload\n\n`); } catch { /* client gone */ }
  }
}

// Live-reload client snippet injected into HTML responses.
const RELOAD_SNIPPET = `
<script>
(() => {
  const es = new EventSource("/__livereload");
  es.onmessage = (e) => { if (e.data === "reload") location.reload(); };
  es.onerror = () => { /* retry handled by EventSource */ };
})();
</script>`;

Bun.serve({
  port: PORT,
  async fetch(req) {
    const { pathname } = new URL(req.url);

    // SSE endpoint for live reload
    if (pathname === "/__livereload") {
      let controller;
      const stream = new ReadableStream({
        start(c) { controller = c; clients.add(c); },
        cancel() { clients.delete(controller); },
      });
      return new Response(stream, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          "connection": "keep-alive",
        },
      });
    }

    const p = pathname === "/" ? "/index.html" : pathname;
    const file = Bun.file(ROOT + p.slice(1));
    if (await file.exists()) {
      // inject reload snippet into HTML
      if (p.endsWith(".html")) {
        let html = await file.text();
        html = html.includes("</body>")
          ? html.replace("</body>", RELOAD_SNIPPET + "\n</body>")
          : html + RELOAD_SNIPPET;
        return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
      }
      return new Response(file, { headers: { "content-type": typeFor(p), "cache-control": "no-cache" } });
    }
    return new Response("404 Not Found", { status: 404 });
  },
});

// Watch source + assets, debounce, then notify clients.
let timer = null;
const onChange = () => {
  clearTimeout(timer);
  timer = setTimeout(() => { console.log("↻ change detected → reloading"); notifyReload(); }, 80);
};
for (const sub of ["src", "assets", "icons", ""]) {
  try { watch(ROOT + sub, { recursive: false }, onChange); } catch { /* dir may not exist */ }
}
watch(ROOT + "src", { recursive: true }, onChange);

console.log(`SGC dialer dev (live reload) → http://localhost:${PORT}`);
