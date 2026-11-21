// PRD §11: initial JS under 250 KB gzipped on every route. Run after `next build`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const LIMIT = 250 * 1024;
const dir = new URL(`../${process.env.NEXT_DIST_DIR || ".next"}/`, import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(join(dir, "app-build-manifest.json"), "utf8"));
const size = new Map();
const gz = (f) => size.get(f) ?? size.set(f, gzipSync(readFileSync(join(dir, f))).length).get(f);

let worst = { page: "", bytes: 0 };
for (const [page, files] of Object.entries(manifest.pages)) {
  const bytes = [...new Set(files.filter((f) => f.endsWith(".js")))].reduce((n, f) => n + gz(f), 0);
  if (bytes > worst.bytes) worst = { page, bytes };
  if (bytes > LIMIT) {
    console.error(`✗ ${page}: ${(bytes / 1024).toFixed(1)} KB gzipped (limit 250 KB)`);
    process.exitCode = 1;
  }
}
console.log(`Largest initial JS: ${worst.page} ${(worst.bytes / 1024).toFixed(1)} KB gzipped (limit 250 KB)`);
