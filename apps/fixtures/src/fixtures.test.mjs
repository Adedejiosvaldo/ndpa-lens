import assert from "node:assert/strict";
import https from "node:https";
import { after, before, test } from "node:test";
import { startFixtures, VARIANTS } from "./server.mjs";

const CHECKS = Array.from({ length: 20 }, (_, i) => `C-${String(i + 1).padStart(2, "0")}`);
let f;
before(async () => (f = await startFixtures()));
after(async () => f?.close());

const get = (variant, path, trust = true) =>
  new Promise((res, rej) =>
    https
      .get(
        { host: "127.0.0.1", port: f.httpsPort, path, servername: `${variant}.fixtures.test`, headers: { host: `${variant}.fixtures.test:${f.httpsPort}` }, ca: f.caCert, agent: false, rejectUnauthorized: trust },
        (r) => {
          let b = "";
          r.on("data", (d) => (b += d));
          r.on("end", () => res({ status: r.statusCode, headers: r.headers, body: b }));
        },
      )
      .on("error", rej),
  );

test("every check has a passing and a failing labelled variant", () => {
  for (const c of CHECKS) {
    assert.ok(VARIANTS.some((v) => v.expect[c] === "pass"), `${c} has no pass variant`);
    assert.ok(VARIANTS.some((v) => v.expect[c] === "fail"), `${c} has no fail variant`);
  }
  assert.equal(new Set(VARIANTS.map((v) => v.id)).size, VARIANTS.length);
});

test("each fail variant changes exactly what its label says", async () => {
  const base = await get("baseline", "/");
  assert.equal(base.status, 200);
  assert.match(base.body, /Privacy policy/);
  assert.ok(base.headers["strict-transport-security"]);
  assert.doesNotMatch((await get("c07-fail", "/")).body, /Privacy policy/);
  assert.match((await get("c13-fail", "/signup")).body, /name="marketing" checked/);
  assert.match((await get("c14-fail", "/signup")).body, /action="http:\/\//);
  assert.equal((await get("c15-fail", "/")).headers["strict-transport-security"], undefined);
  assert.equal((await get("c16-fail", "/")).headers["x-frame-options"], undefined);
  assert.doesNotMatch((await get("c09-fail", "/privacy")).body, /Data Protection Officer/);
  assert.doesNotMatch((await get("c10-fail", "/privacy")).body, /outside Nigeria/);
  assert.doesNotMatch((await get("c18-fail", "/privacy")).body, /rights request/);
  await assert.rejects(get("c19-fail", "/"), /expired/);
});

test("forms are never accepted", async () => {
  const r = await new Promise((res, rej) => {
    const req = https.request({ host: "127.0.0.1", port: f.httpsPort, path: "/signup", method: "POST", servername: "baseline.fixtures.test", headers: { host: "baseline.fixtures.test" }, ca: f.caCert, agent: false }, (r) => res(r.statusCode));
    req.on("error", rej);
    req.end("email=x");
  });
  assert.equal(r, 405);
});
