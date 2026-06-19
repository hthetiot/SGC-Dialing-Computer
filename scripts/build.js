// build.js — Produces a self-contained dist/ with an inlined index.html.
//
// Steps:
//   1. Bundle the local module graph (entry: public/src/main.js) into one ESM file,
//      keeping `three` and `lil-gui` external so they still load from the CDN import map.
//   2. Inline layout.json and the gate SVG as window globals so the app needs ZERO
//      runtime asset fetches — it works from any path, any static host, even file:// for
//      the non-module bits (modules still need http for the import map, but no 404s on
//      local files).
//   3. Emit dist/index.html with the import map, the inlined assets, and the bundle.
//   4. Copy the PWA bits (manifest, sw.js rewritten for the flat dist layout, icons).

import { mkdir, rm, copyFile, readFile, writeFile, readdir } from "node:fs/promises";

import { fileURLToPath } from 'url'

const ROOT = fileURLToPath(new URL("../", import.meta.url))

const PUB = ROOT + "public/";
const DIST = ROOT + "dist/";

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST + "icons", { recursive: true });

  // 1. Bundle local graph, three/lil-gui external.
  const out = await Bun.build({
    entrypoints: [PUB + "src/main.js"],
    target: "browser",
    format: "esm",
    minify: false,
    external: ["three", "three/addons/*", "lil-gui"],
  });
  if (!out.success) {
    console.error("Bundle failed:");
    for (const m of out.logs) console.error(m);
    process.exit(1);
  }
  const bundle = await out.outputs[0].text();

  // 2. Inline assets.
  const layoutJSON = await readFile(PUB + "assets/layout.json", "utf8");
  const gateSVG = await readFile(PUB + "assets/gate.svg", "utf8");

  // 3. Compose index.html from the dev template, swapping the module script for the
  //    inlined globals + bundle, and pointing the manifest/sw to the flat dist paths.
  let html = await readFile(PUB + "index.html", "utf8");

  const inlineHead = `
  <script id="sgc-assets">
    window.__SGC_LAYOUT__ = ${layoutJSON};
    window.__SGC_GATE_SVG__ = ${JSON.stringify(gateSVG)};
  </script>`;

  // Insert the asset globals just before the closing </head>.
  html = html.replace("</head>", inlineHead + "\n</head>");

  // Replace the external module script with the inlined bundle.
  html = html.replace(
    /<script type="module" src="\.\/src\/main\.js"><\/script>/,
    `<script type="module">\n${bundle}\n</script>`
  );

  await writeFile(DIST + "index.html", html, "utf8");

  // 4. PWA: manifest + icons (sw.js becomes a thin shell for the flat layout).
  await copyFile(PUB + "manifest.webmanifest", DIST + "manifest.webmanifest");
  for (const f of await readdir(PUB + "icons")) {
    await copyFile(PUB + "icons/" + f, DIST + "icons/" + f);
  }
  // Flat-layout service worker: cache just index.html + manifest + icons + CDN at runtime.
  const sw = `// Auto-generated for dist/. App logic is inlined in index.html.
const CACHE = "sgc-dialer-dist-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) =>
    Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    const u = new URL(e.request.url);
    if (res.ok && (u.origin === location.origin || u.host.includes("cdn.jsdelivr.net"))) {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy));
    }
    return res;
  }).catch(() => caches.match("./index.html"))));
});
`;
  await writeFile(DIST + "sw.js", sw, "utf8");

  const bytes = (await readFile(DIST + "index.html")).length;
  console.log(`✓ dist/index.html written (${(bytes / 1024).toFixed(0)} KB, self-contained)`);
  console.log(`  Inlined: layout.json, gate.svg, ${out.outputs.length} JS bundle`);
  console.log(`  Copied:  manifest.webmanifest, sw.js, icons/`);
  console.log(`  Open dist/index.html via any static server (needs http for the CDN import map).`);
}

main();
