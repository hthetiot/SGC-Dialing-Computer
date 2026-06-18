// Static server for local dev. Serves ./public by default, or ./dist when SERVE_DIST=1.
// Usage: bun run scripts/serve.js   |   SERVE_DIST=1 bun run scripts/serve.js
import { fileURLToPath } from 'url'

const dir = process.env.SERVE_DIST ? "../dist/" : "../public/";
const ROOT = fileURLToPath(new URL(dir, import.meta.url))

const PORT = Number(process.env.PORT ?? 8787);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon", ".css": "text/css; charset=utf-8",
};
const typeFor = (p) => TYPES[p.slice(p.lastIndexOf("."))] ?? "application/octet-stream";
Bun.serve({
  port: PORT,
  async fetch(req) {
    let { pathname } = new URL(req.url);
    if (pathname === "/") pathname = "/index.html";
    const file = Bun.file(ROOT + pathname.slice(1));
    if (await file.exists())
      return new Response(file, { headers: { "content-type": typeFor(pathname), "cache-control": "no-cache" } });
    return new Response("404 Not Found", { status: 404 });
  },
});
console.log(`SGC dialer → http://localhost:${PORT}  (serving ${process.env.SERVE_DIST ? "dist/" : "public/"})`);
