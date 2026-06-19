// clean.js — wipe the disposable tmp/ output tree (script outputs only; source/ is never touched).
// Usage: npm run clean  |  node scripts/clean.js

import { rmSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TMP = fileURLToPath(new URL("../tmp/", import.meta.url));
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
console.log("✓ cleaned tmp/");
