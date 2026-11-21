// Capture an evidence bundle for every fixture variant into golden/<id>.json.
// Re-run after engine changes: pnpm --filter @ndpa/checks golden:capture
import { mkdir, writeFile } from "node:fs/promises";
import { collectEvidence, EvidenceWriter } from "@ndpa/scan-engine";
import { startFixtures, VARIANTS } from "fixtures";
import { chromium } from "playwright";
import { createHash } from "node:crypto";

const only = process.argv.slice(2);
const store = { put: async (key, bytes) => ({ key, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.byteLength }) };
const f = await startFixtures();
const browser = await chromium.launch({ args: [`--host-resolver-rules=${f.hostResolverRules}`, "--ignore-certificate-errors"] });
const policy = { contactUrl: "https://ndpalens.test/scanner", resolve: async () => ["127.0.0.1"], allowPrivate: (ip) => ip === "127.0.0.1" };
await mkdir(new URL("../golden/", import.meta.url), { recursive: true });
try {
  for (const v of VARIANTS) {
    if (only.length && !only.includes(v.id)) continue;
    const t = Date.now();
    const bundle = await collectEvidence({
      url: f.url(v.id),
      policy,
      writer: new EvidenceWriter(store, "org-golden", `scan-${v.id}`),
      browser,
      tlsCa: f.caCert,
      concurrency: 4,
    });
    // Ports change every run; normalise so goldens are stable.
    const json = JSON.stringify(bundle, null, 1).replaceAll(`:${f.httpsPort}`, ":443");
    await writeFile(new URL(`../golden/${v.id}.json`, import.meta.url), json);
    console.log(`${v.id.padEnd(9)} ${bundle.pages.length} captures, ${bundle.flows.length} flows, ${Date.now() - t} ms`);
  }
} finally {
  await browser.close();
  await f.close();
}
