// Downloads this month's DB-IP Lite country and ASN databases (CC BY 4.0) into
// packages/vendors/data/. Run at image build (Step 33) or locally:
//   pnpm --filter @ndpa/vendors geoip:download
import { createWriteStream, mkdirSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";

const month = new Date().toISOString().slice(0, 7);
const out = new URL("../data/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
for (const kind of ["country", "asn"]) {
  const url = `https://download.db-ip.com/free/dbip-${kind}-lite-${month}.mmdb.gz`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  await pipeline(res.body, createGunzip(), createWriteStream(`${out}dbip-${kind}-lite.mmdb`));
  console.log(`Saved data/dbip-${kind}-lite.mmdb (${month})`);
}
