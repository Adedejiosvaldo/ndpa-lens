// Browse the fixtures locally: pnpm --filter fixtures dev
import { startFixtures, VARIANTS } from "./server.mjs";

const f = await startFixtures();
console.log(`Fixtures on https://<variant>.fixtures.test:${f.httpsPort} (self-signed CA).`);
console.log(`Launch Chromium with: --host-resolver-rules="${f.hostResolverRules}" --ignore-certificate-errors`);
for (const v of VARIANTS) console.log(`  ${v.id.padEnd(9)} ${f.url(v.id)}  ${v.note}`);
