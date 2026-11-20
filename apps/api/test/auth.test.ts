import { createHash } from "node:crypto";
import pg from "pg";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { HibpPwnedPasswords } from "../src/auth/pwned.js";
import { seedPlatformAdmin } from "../src/scripts/seed-platform-admin.js";
import { Client, createTestApp, orgFor, signedInUser, type TestApp } from "./harness.js";
import { type Deps, startDeps, stopDeps } from "./setup.js";

const PASSWORD = "a-long-safe-passphrase-1";
const SESSION_COOKIE = "__Secure-ndpa.session_token";

let deps: Deps;
let t: TestApp;
let owner: pg.Pool;

beforeAll(async () => {
  deps = await startDeps();
  t = await createTestApp(deps.config);
  owner = new pg.Pool({ connectionString: deps.ownerUrl });
});

afterAll(async () => {
  await t?.app.close();
  await owner?.end();
  await stopDeps(deps);
});

const audit = async (email: string) =>
  (
    await owner.query<{ action: string }>(
      "select a.action from audit_log a join users u on u.id = a.actor_user_id where u.email = $1 order by a.created_at",
      [email],
    )
  ).rows.map((r) => r.action);

describe("CSRF (PRD §8)", () => {
  it("rejects unsafe requests without a matching token", async () => {
    const server = t.app.getHttpServer();
    const none = await request(server).post("/v1/auth/login").send({ email: "x@x.test", password: "whatever-123" });
    expect(none.status).toBe(403);
    expect(none.body.code).toBe("csrf_invalid");

    const c = new Client(t.app);
    const token = await c.ensureCsrf();
    const wrong = await request(server)
      .post("/v1/auth/login")
      .set("Cookie", c.cookieHeader)
      .set("X-CSRF-Token", token + "x")
      .send({ email: "x@x.test", password: "whatever-123" });
    expect(wrong.status).toBe(403);
  });

  it("rejects a foreign Origin even with a valid token", async () => {
    const c = new Client(t.app);
    const res = await c.post("/v1/auth/login", { email: "x@x.test", password: "whatever-123" }, { Origin: "https://evil.test" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("csrf_invalid");
  });

  it("issues the token as an HttpOnly, Secure, SameSite=Lax cookie", async () => {
    const res = await request(t.app.getHttpServer()).get("/v1/auth/csrf");
    const cookie = (res.headers["set-cookie"] as unknown as string[])[0]!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });
});

describe("AUTH-01 sign-up", () => {
  it("requires at least 12 characters", async () => {
    const res = await new Client(t.app).post("/v1/auth/signup", { name: "S", email: "short@a.test", password: "elevenchars", organisation: orgFor("short@a.test") });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("validation_failed");
    expect(res.body.errors[0].path).toBe("password");
  });

  it("rejects breached passwords", async () => {
    const res = await new Client(t.app).post("/v1/auth/signup", { name: "B", email: "breach@a.test", password: "password123456", organisation: orgFor("breach@a.test") });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toMatch(/data breach/);
  });

  it("answers the same for new and existing emails (no enumeration)", async () => {
    const c = new Client(t.app);
    const first = await c.post("/v1/auth/signup", { name: "Ada", email: "ada@a.test", password: PASSWORD, organisation: orgFor("ada@a.test") });
    const again = await c.post("/v1/auth/signup", { name: "Ada", email: "ada@a.test", password: PASSWORD, organisation: orgFor("ada@a.test") });
    expect(first.status).toBe(202);
    expect(again.status).toBe(202);
    expect(again.body).toEqual(first.body);
    expect(again.headers["set-cookie"]).toBeUndefined();
    const subjects = t.outbox.to("ada@a.test").map((m) => m.subject);
    expect(subjects).toEqual(["Confirm your email for NDPA Lens", "You already have an NDPA Lens account"]);
    // ORG-01: one organisation, created only by the first (genuine) sign-up.
    const orgs = await owner.query(
      "select o.legal_name, m.role from memberships m join organisations o on o.id = m.org_id join users u on u.id = m.user_id where u.email = 'ada@a.test'",
    );
    expect(orgs.rows).toEqual([{ legal_name: "ada Partners Ltd", role: "owner" }]);
  });

  it("hashes passwords with argon2id", async () => {
    const r = await owner.query(
      "select a.password from accounts a join users u on u.id = a.user_id where u.email = 'ada@a.test'",
    );
    expect(r.rows[0].password).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });
});

describe("AUTH-02 email verification", () => {
  it("verifies, signs in and sets a secure session cookie", async () => {
    const c = new Client(t.app);
    await c.post("/v1/auth/signup", { name: "Vee", email: "vee@a.test", password: PASSWORD, organisation: orgFor("vee@a.test") });
    const before = await c.get("/v1/me");
    expect(before.status).toBe(401);

    const res = await c.post("/v1/auth/verify-email", { token: t.outbox.token("vee@a.test", /Confirm/) });
    expect(res.status).toBe(200);
    const session = (res.headers["set-cookie"] as unknown as string[]).find((x) => x.startsWith(SESSION_COOKIE))!;
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/Secure/i);
    expect(session).toMatch(/SameSite=Lax/i);

    const me = await c.get("/v1/me");
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ email: "vee@a.test", emailVerified: true, isPlatformAdmin: false });
    expect(await audit("vee@a.test")).toEqual(["auth.signup", "org.created", "auth.email_verified"]);
  });

  it("rejects a bad token", async () => {
    const res = await new Client(t.app).post("/v1/auth/verify-email", { token: "not-a-real-token-123" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("validation_failed");
  });
});

describe("AUTH-03 login rate limiting", () => {
  it("signs in with the right password", async () => {
    await signedInUser(t, "lin@a.test");
    const c = new Client(t.app);
    const res = await c.post("/v1/auth/login", { email: "lin@a.test", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("lin@a.test");
    expect((await c.get("/v1/me")).status).toBe(200);
  });

  it("blocks the account after 5 failures for 15 minutes and emails the owner once", async () => {
    await signedInUser(t, "lock@a.test");
    for (let i = 0; i < 5; i++) {
      const c = new Client(t.app, `198.51.100.${i + 1}`); // different IPs: the account limit trips
      const res = await c.post("/v1/auth/login", { email: "lock@a.test", password: "wrong-password-xx" });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("unauthenticated");
    }
    const sixth = await new Client(t.app, "198.51.100.99").post("/v1/auth/login", { email: "lock@a.test", password: PASSWORD });
    expect(sixth.status).toBe(429);
    expect(sixth.body.code).toBe("rate_limited");
    expect(Number(sixth.headers["retry-after"])).toBeGreaterThan(800);
    expect(t.outbox.to("lock@a.test").filter((m) => /paused/.test(m.subject))).toHaveLength(1);
    expect(await audit("lock@a.test")).toContain("auth.login_locked");
  });

  it("blocks an IP after 5 failures across accounts", async () => {
    await signedInUser(t, "ipvictim@a.test");
    const ip = "192.0.2.77";
    for (let i = 0; i < 5; i++) {
      await new Client(t.app, ip).post("/v1/auth/login", { email: `nobody${i}@a.test`, password: "wrong-password-xx" });
    }
    const blocked = await new Client(t.app, ip).post("/v1/auth/login", { email: "ipvictim@a.test", password: PASSWORD });
    expect(blocked.status).toBe(429);
    const elsewhere = await new Client(t.app, "192.0.2.78").post("/v1/auth/login", { email: "ipvictim@a.test", password: PASSWORD });
    expect(elsewhere.status).toBe(200);
  });

  it("sends no lockout email for unknown accounts", async () => {
    for (let i = 0; i < 5; i++) {
      await new Client(t.app, `233.252.0.${i}`).post("/v1/auth/login", { email: "ghost@a.test", password: "wrong-password-xx" });
    }
    expect(t.outbox.to("ghost@a.test")).toHaveLength(0);
  });
});

describe("AUTH-04 password reset", () => {
  it("answers 202 for unknown emails without sending anything", async () => {
    const res = await new Client(t.app).post("/v1/auth/password/forgot", { email: "unknown@a.test" });
    expect(res.status).toBe(202);
    expect(t.outbox.to("unknown@a.test")).toHaveLength(0);
  });

  it("uses a single-use, 30-minute, hashed token and signs out everywhere", async () => {
    const old = await signedInUser(t, "reset@a.test");
    expect((await old.get("/v1/me")).status).toBe(200);

    const c = new Client(t.app);
    expect((await c.post("/v1/auth/password/forgot", { email: "reset@a.test" })).status).toBe(202);
    const token = t.outbox.token("reset@a.test", /Reset your/);

    const row = await owner.query<{ identifier: string; ttl: number }>(
      "select identifier, extract(epoch from expires_at - created_at)::int as ttl from verifications order by created_at desc limit 1",
    );
    expect(row.rows[0]!.ttl).toBeGreaterThanOrEqual(1795);
    expect(row.rows[0]!.ttl).toBeLessThanOrEqual(1800);
    expect(row.rows[0]!.identifier).not.toContain(token); // stored hashed

    const breached = await c.post("/v1/auth/password/reset", { token, newPassword: "correcthorsebatterystaple" });
    expect(breached.status).toBe(400);

    const ok = await c.post("/v1/auth/password/reset", { token, newPassword: "a-brand-new-passphrase-2" });
    expect(ok.status).toBe(200);
    const reuse = await c.post("/v1/auth/password/reset", { token, newPassword: "another-new-passphrase-3" });
    expect(reuse.status).toBe(400);

    expect((await old.get("/v1/me")).status).toBe(401); // old sessions revoked
    const login = await c.post("/v1/auth/login", { email: "reset@a.test", password: "a-brand-new-passphrase-2" });
    expect(login.status).toBe(200);
    expect(await audit("reset@a.test")).toContain("auth.password_reset");
  });
});

describe("AUTH-06 sessions", () => {
  it("lists sessions without tokens and revokes another one", async () => {
    const a = await signedInUser(t, "sess@a.test");
    const b = new Client(t.app, "203.0.113.50");
    await b.post("/v1/auth/login", { email: "sess@a.test", password: PASSWORD });

    const list = await a.get("/v1/me/sessions");
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(2);
    expect(JSON.stringify(list.body)).not.toMatch(/token/i);
    const other = list.body.items.find((s: { current: boolean }) => !s.current);
    expect(other.ipAddress).toBe("203.0.113.50");

    expect((await a.delete(`/v1/me/sessions/${other.id}`)).status).toBe(204);
    expect((await b.get("/v1/me")).status).toBe(401);
    expect((await a.get("/v1/me")).status).toBe(200);
  });

  it("cannot revoke another user's session", async () => {
    const mine = await signedInUser(t, "own1@a.test");
    const theirs = await signedInUser(t, "own2@a.test");
    const theirId = (await theirs.get("/v1/me/sessions")).body.items[0].id;
    expect((await mine.delete(`/v1/me/sessions/${theirId}`)).status).toBe(404);
    expect((await theirs.get("/v1/me")).status).toBe(200);
  });

  it("ends a session after 12 hours idle", async () => {
    const c = await signedInUser(t, "idle@a.test");
    await owner.query("update sessions set expires_at = now() - interval '1 minute' where user_id = (select id from users where email = 'idle@a.test')");
    expect((await c.get("/v1/me")).status).toBe(401);
  });

  it("ends a session after 7 days even if active", async () => {
    const c = await signedInUser(t, "abs@a.test");
    await owner.query("update sessions set created_at = now() - interval '7 days 1 minute' where user_id = (select id from users where email = 'abs@a.test')");
    const res = await c.get("/v1/me");
    expect(res.status).toBe(401);
    const left = await owner.query("select count(*)::int as n from sessions s join users u on u.id = s.user_id where u.email = 'abs@a.test'");
    expect(left.rows[0].n).toBe(0);
  });

  it("uses a 12-hour sliding expiry", async () => {
    await signedInUser(t, "slide@a.test");
    const r = await owner.query<{ h: number }>(
      "select extract(epoch from s.expires_at - s.created_at)::int / 3600 as h from sessions s join users u on u.id = s.user_id where u.email = 'slide@a.test'",
    );
    expect(r.rows[0]!.h).toBe(12);
  });

  it("logs out", async () => {
    const c = await signedInUser(t, "bye@a.test");
    expect((await c.post("/v1/auth/logout")).status).toBe(204);
    expect((await c.get("/v1/me")).status).toBe(401);
    expect(await audit("bye@a.test")).toContain("auth.logout");
  });
});

describe("Platform Admin seed", () => {
  it("creates a verified admin who can sign in, and is idempotent", async () => {
    const first = await seedPlatformAdmin(deps.authUrl, "root@ndpa.test", "Root", "an-admin-passphrase-9");
    const again = await seedPlatformAdmin(deps.authUrl, "root@ndpa.test", "Root", "ignored-on-second-run");
    expect(first.created).toBe(true);
    expect(again).toEqual({ id: first.id, created: false });

    const c = new Client(t.app);
    expect((await c.post("/v1/auth/login", { email: "root@ndpa.test", password: "an-admin-passphrase-9" })).status).toBe(200);
    const me = await c.get("/v1/me");
    expect(me.body.user).toMatchObject({ isPlatformAdmin: true, emailVerified: true });
  });
});

describe("HIBP k-anonymity client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends only the 5-character prefix and matches the suffix", async () => {
    const sha = createHash("sha1").update("hunter2hunter2").digest("hex").toUpperCase();
    const fetchMock = vi.fn(async () => new Response(`0000000000000000000000000000000000A:3\r\n${sha.slice(5)}:42\r\n`));
    vi.stubGlobal("fetch", fetchMock);
    expect(await new HibpPwnedPasswords().isBreached("hunter2hunter2")).toBe(true);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(`https://api.pwnedpasswords.com/range/${sha.slice(0, 5)}`);
  });

  it("ignores padding entries with count 0 and fails open when HIBP is down", async () => {
    const sha = createHash("sha1").update("unique-pass-phrase-x").digest("hex").toUpperCase();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`${sha.slice(5)}:0\r\n`)));
    expect(await new HibpPwnedPasswords().isBreached("unique-pass-phrase-x")).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    expect(await new HibpPwnedPasswords().isBreached("anything-at-all-123")).toBe(false);
  });
});
