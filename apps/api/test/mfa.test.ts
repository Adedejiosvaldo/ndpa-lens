import { Controller, Get, UseGuards } from "@nestjs/common";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SessionGuard } from "../src/auth/session.guard.js";
import { seedPlatformAdmin } from "../src/scripts/seed-platform-admin.js";
import { Client, createTestApp, signedInUser, type TestApp } from "./harness.js";
import { type Deps, startDeps, stopDeps } from "./setup.js";
import { totp } from "./totp.js";

const PASSWORD = "a-long-safe-passphrase-1";

/** Any protected route that is not exempt from mandatory MFA. */
@Controller("_test")
class SecureProbe {
  @Get("secure")
  @UseGuards(SessionGuard)
  secure() {
    return { ok: true };
  }
}

let deps: Deps;
let t: TestApp;
let owner: pg.Pool;

beforeAll(async () => {
  deps = await startDeps();
  t = await createTestApp(deps.config, [SecureProbe]);
  owner = new pg.Pool({ connectionString: deps.ownerUrl });
});

afterAll(async () => {
  await t?.app.close();
  await owner?.end();
  await stopDeps(deps);
});

async function enrol(c: Client, password = PASSWORD) {
  const res = await c.post("/v1/auth/mfa/enrol", { password });
  expect(res.status).toBe(200);
  const confirm = await c.post("/v1/auth/mfa/confirm", { code: totp(res.body.manualKey) });
  expect(confirm.status).toBe(200);
  return res.body as { manualKey: string; recoveryCodes: string[]; otpauthUri: string };
}

async function makeOwner(email: string) {
  await owner.query(
    `with o as (insert into organisations (name, slug) values ($1, $1) returning id)
     insert into memberships (org_id, user_id, role) select o.id, u.id, 'owner' from o, users u where u.email = $2`,
    [`org-${email}`, email],
  );
}

describe("AUTH-05 enrolment", () => {
  it("returns a QR URI, manual key and 10 recovery codes, and turns on after confirmation", async () => {
    const c = await signedInUser(t, "enrol@a.test");
    expect((await c.post("/v1/auth/mfa/enrol", { password: "wrong-password-xx" })).status).toBe(401);

    const res = await c.post("/v1/auth/mfa/enrol", { password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.otpauthUri).toMatch(/^otpauth:\/\/totp\/NDPA%20Lens:enrol%40a\.test\?/);
    expect(res.body.manualKey).toMatch(/^[A-Z2-7]+=*$/);
    expect(res.body.recoveryCodes).toHaveLength(10);
    expect((await c.get("/v1/me")).body.user.twoFactorEnabled).toBe(false);

    expect((await c.post("/v1/auth/mfa/confirm", { code: "000000" })).status).toBe(401);
    expect((await c.post("/v1/auth/mfa/confirm", { code: totp(res.body.manualKey) })).status).toBe(200);
    expect((await c.get("/v1/me")).body.user.twoFactorEnabled).toBe(true);

    const row = await owner.query(
      "select tf.secret, tf.backup_codes from two_factors tf join users u on u.id = tf.user_id where u.email = 'enrol@a.test'",
    );
    expect(row.rows[0].secret).not.toContain(res.body.manualKey); // stored encrypted
    for (const code of res.body.recoveryCodes) expect(row.rows[0].backup_codes).not.toContain(code);
  });
});

describe("AUTH-05 sign-in", () => {
  let key: string;
  let recovery: string[];

  beforeAll(async () => {
    const c = await signedInUser(t, "two@a.test");
    ({ manualKey: key, recoveryCodes: recovery } = await enrol(c));
  });

  it("asks for a second factor and creates no session until it is given", async () => {
    const c = new Client(t.app);
    const login = await c.post("/v1/auth/login", { email: "two@a.test", password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body).toEqual({ mfaRequired: true });
    expect((await c.get("/v1/me")).status).toBe(401);

    expect((await c.post("/v1/auth/mfa/verify", { code: "123456" })).status).toBe(401);
    const ok = await c.post("/v1/auth/mfa/verify", { code: totp(key, 1) });
    expect(ok.status).toBe(200);
    expect(ok.body.user.email).toBe("two@a.test");
    expect((await c.get("/v1/me")).status).toBe(200);
  });

  it("refuses verification without the pending sign-in cookie", async () => {
    const res = await new Client(t.app).post("/v1/auth/mfa/verify", { code: totp(key) });
    expect(res.status).toBe(401);
  });

  it("accepts each recovery code once", async () => {
    const a = new Client(t.app);
    await a.post("/v1/auth/login", { email: "two@a.test", password: PASSWORD });
    expect((await a.post("/v1/auth/mfa/verify", { recoveryCode: recovery[0] })).status).toBe(200);

    const b = new Client(t.app);
    await b.post("/v1/auth/login", { email: "two@a.test", password: PASSWORD });
    expect((await b.post("/v1/auth/mfa/verify", { recoveryCode: recovery[0] })).status).toBe(401);
    const actions = (
      await owner.query("select action from audit_log a join users u on u.id = a.actor_user_id where u.email = 'two@a.test'")
    ).rows.map((r) => r.action);
    expect(actions).toContain("mfa.recovery_code_used");
  });

  it("locks second-factor sign-in after 5 wrong codes", async () => {
    const c = await signedInUser(t, "brute@a.test");
    const { manualKey } = await enrol(c);
    const d = new Client(t.app, "203.0.113.200");
    await d.post("/v1/auth/login", { email: "brute@a.test", password: PASSWORD });
    for (let i = 0; i < 5; i++) await d.post("/v1/auth/mfa/verify", { code: "111111" });
    const locked = await d.post("/v1/auth/mfa/verify", { code: totp(manualKey, 1) });
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe("rate_limited");
  });
});

describe("AUTH-05 mandatory for Owners and Platform Admins", () => {
  it("blocks an Owner without MFA from everything but enrolment, profile and sign-out", async () => {
    const c = await signedInUser(t, "boss@a.test");
    await makeOwner("boss@a.test");
    const blocked = await c.get("/v1/_test/secure");
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("mfa_enrolment_required");
    expect((await c.get("/v1/me")).status).toBe(200);
    expect((await c.get("/v1/me/sessions")).status).toBe(200);

    await enrol(c);
    expect((await c.get("/v1/_test/secure")).status).toBe(200);
    // …and cannot turn it off again.
    const off = await c.post("/v1/auth/mfa/disable", { password: PASSWORD });
    expect(off.status).toBe(403);
  });

  it("blocks a Platform Admin until enrolled", async () => {
    await seedPlatformAdmin(deps.authUrl, "padmin@ndpa.test", "Admin", "an-admin-passphrase-9");
    const c = new Client(t.app);
    expect((await c.post("/v1/auth/login", { email: "padmin@ndpa.test", password: "an-admin-passphrase-9" })).body.mfaRequired).toBe(false);
    expect((await c.get("/v1/_test/secure")).body.code).toBe("mfa_enrolment_required");
    await enrol(c, "an-admin-passphrase-9");
    expect((await c.get("/v1/_test/secure")).status).toBe(200);
  });

  it("lets other users stay without MFA, or turn it off", async () => {
    const c = await signedInUser(t, "analyst@a.test");
    expect((await c.get("/v1/_test/secure")).status).toBe(200);
    await enrol(c);
    expect((await c.post("/v1/auth/mfa/disable", { password: PASSWORD })).status).toBe(200);
    const again = new Client(t.app);
    expect((await again.post("/v1/auth/login", { email: "analyst@a.test", password: PASSWORD })).body.mfaRequired).toBe(false);
  });
});

describe("recovery code rotation", () => {
  it("replaces all codes", async () => {
    const c = await signedInUser(t, "rotate@a.test");
    const { recoveryCodes: old } = await enrol(c);
    const res = await c.post("/v1/auth/mfa/recovery-codes", { password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.recoveryCodes).toHaveLength(10);

    const d = new Client(t.app);
    await d.post("/v1/auth/login", { email: "rotate@a.test", password: PASSWORD });
    expect((await d.post("/v1/auth/mfa/verify", { recoveryCode: old[1] })).status).toBe(401);
    expect((await d.post("/v1/auth/mfa/verify", { recoveryCode: res.body.recoveryCodes[0] })).status).toBe(200);
  });
});
