import { Id } from "@ndpa/schema";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "../src/db/migrate.js";
import { auditLog, invitations, memberships, organisations, users } from "../src/db/schema.js";
import { type Deps, startDeps, stopDeps } from "./setup.js";

let deps: Deps;
let owner: pg.Pool;
let api: pg.Pool;
let auth: pg.Pool;
const ids = { orgA: "", orgB: "", alice: "", bob: "" };

/** Run as ndpa_api inside one org, exactly like DbService.withOrg. */
async function asOrg<T>(orgId: string | null, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await api.connect();
  try {
    await c.query("begin");
    if (orgId) await c.query("select set_config('app.org_id', $1, true)", [orgId]);
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

beforeAll(async () => {
  deps = await startDeps();
  owner = new pg.Pool({ connectionString: deps.ownerUrl });
  api = new pg.Pool({ connectionString: deps.apiUrl });
  auth = new pg.Pool({ connectionString: deps.authUrl });

  // Fixtures through the Better Auth role, as sign-up will do in Step 07.
  const db = drizzle(auth);
  const [alice, bob] = await db
    .insert(users)
    .values([
      { name: "Alice", email: "alice@a.test" },
      { name: "Bob", email: "bob@b.test" },
    ])
    .returning({ id: users.id });
  const [orgA, orgB] = await db
    .insert(organisations)
    .values([
      { name: "A Partners", slug: "a-partners" },
      { name: "B Advisory", slug: "b-advisory" },
    ])
    .returning({ id: organisations.id });
  Object.assign(ids, { orgA: orgA!.id, orgB: orgB!.id, alice: alice!.id, bob: bob!.id });
  await db.insert(memberships).values([
    { organizationId: ids.orgA, userId: ids.alice, role: "owner" },
    { organizationId: ids.orgB, userId: ids.bob, role: "owner" },
  ]);
  const week = new Date(Date.now() + 7 * 864e5);
  await db.insert(invitations).values([
    { organizationId: ids.orgA, email: "new@a.test", role: "analyst", expiresAt: week, inviterId: ids.alice, tokenHash: "a".repeat(64) },
    { organizationId: ids.orgB, email: "new@b.test", role: "viewer", expiresAt: week, inviterId: ids.bob, tokenHash: "b".repeat(64) },
  ]);
  await db.insert(auditLog).values([
    { orgId: ids.orgA, actorUserId: ids.alice, actorType: "user", action: "org.created" },
    { orgId: ids.orgB, actorUserId: ids.bob, actorType: "user", action: "org.created" },
  ]);
});

afterAll(async () => {
  await Promise.all([owner?.end(), api?.end(), auth?.end()]);
  await stopDeps(deps);
});

describe("migrations", () => {
  it("are idempotent: a second run is a no-op", async () => {
    await runMigrations(deps.ownerUrl);
    const r = await owner.query("select count(*)::int as n from drizzle.__drizzle_migrations");
    expect(r.rows[0].n).toBe(7);
  });

  it("generate uuid v7 ids", async () => {
    expect(Id.safeParse(ids.orgA).success).toBe(true);
    expect(Id.safeParse(ids.alice).success).toBe(true);
  });

  it("the app roles cannot bypass RLS", async () => {
    const r = await owner.query("select rolname, rolsuper, rolbypassrls from pg_roles where rolname in ('ndpa_api','ndpa_auth') order by 1");
    expect(r.rows).toEqual([
      { rolname: "ndpa_api", rolsuper: false, rolbypassrls: false },
      { rolname: "ndpa_auth", rolsuper: false, rolbypassrls: false },
    ]);
  });
});

describe("ndpa_api tenant isolation (RLS)", () => {
  const tables = ["organisations", "memberships", "invitations", "audit_log"] as const;

  it("sees nothing when no organisation is set (fails closed)", async () => {
    for (const t of tables) {
      const r = await asOrg(null, (c) => c.query(`select count(*)::int as n from ${t}`));
      expect(r.rows[0].n, t).toBe(0);
    }
  });

  it("sees only its own organisation's rows", async () => {
    await asOrg(ids.orgA, async (c) => {
      expect((await c.query("select id from organisations")).rows).toEqual([{ id: ids.orgA }]);
      expect((await c.query("select user_id from memberships")).rows).toEqual([{ user_id: ids.alice }]);
      expect((await c.query("select email from invitations")).rows).toEqual([{ email: "new@a.test" }]);
      expect((await c.query("select org_id from audit_log")).rows).toEqual([{ org_id: ids.orgA }]);
    });
  });

  it("cannot read another org even when asking for it by id", async () => {
    await asOrg(ids.orgA, async (c) => {
      expect((await c.query("select * from organisations where id = $1", [ids.orgB])).rowCount).toBe(0);
      expect((await c.query("select * from memberships where org_id = $1", [ids.orgB])).rowCount).toBe(0);
    });
  });

  it("cannot write into another org", async () => {
    await expect(
      asOrg(ids.orgA, (c) => c.query("insert into memberships (org_id, user_id, role) values ($1, $2, 'viewer')", [ids.orgB, ids.alice])),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asOrg(ids.orgA, (c) => c.query("insert into audit_log (org_id, actor_type, action) values ($1, 'user', 'x')", [ids.orgB])),
    ).rejects.toThrow(/row-level security/);
    const upd = await asOrg(ids.orgA, (c) => c.query("update organisations set name = 'hijacked' where id = $1", [ids.orgB]));
    expect(upd.rowCount).toBe(0);
    const del = await asOrg(ids.orgA, (c) => c.query("delete from memberships where org_id = $1", [ids.orgB]));
    expect(del.rowCount).toBe(0);
  });

  it("cannot move its own rows into another org", async () => {
    await expect(
      asOrg(ids.orgA, (c) => c.query("update memberships set org_id = $1 where org_id = $2", [ids.orgB, ids.orgA])),
    ).rejects.toThrow(/row-level security/);
  });

  it("has no access to credentials, sessions or private user columns", async () => {
    for (const q of [
      "select * from sessions",
      "select * from accounts",
      "select * from verifications",
      "select * from two_factors",
      "select * from users",
      "select is_platform_admin from users",
    ]) {
      await expect(asOrg(ids.orgA, (c) => c.query(q)), q).rejects.toThrow(/permission denied/);
    }
    const ok = await asOrg(ids.orgA, (c) => c.query("select name, email from users where id = $1", [ids.alice]));
    expect(ok.rows).toEqual([{ name: "Alice", email: "alice@a.test" }]);
  });

  it("works through Drizzle with the same transaction-local setting", async () => {
    const db = drizzle(api);
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.org_id', ${ids.orgB}, true)`);
      return tx.select({ id: memberships.userId }).from(memberships);
    });
    expect(rows).toEqual([{ id: ids.bob }]);
    // Outside the transaction the setting is gone again.
    const after = await db.select().from(memberships).where(eq(memberships.organizationId, ids.orgB));
    expect(after).toEqual([]);
  });
});

describe("audit_log is append-only", () => {
  it("refuses UPDATE and DELETE for both app roles", async () => {
    await expect(asOrg(ids.orgA, (c) => c.query("update audit_log set action = 'x'"))).rejects.toThrow(/permission denied/);
    await expect(asOrg(ids.orgA, (c) => c.query("delete from audit_log"))).rejects.toThrow(/permission denied/);
    await expect(auth.query("update audit_log set action = 'x'")).rejects.toThrow(/permission denied/);
    await expect(auth.query("delete from audit_log")).rejects.toThrow(/permission denied/);
    await expect(auth.query("select * from audit_log")).rejects.toThrow(/permission denied/);
  });

  it("lets both roles append", async () => {
    await asOrg(ids.orgA, (c) => c.query("insert into audit_log (org_id, actor_type, action) values ($1, 'user', 'test.append')", [ids.orgA]));
    await auth.query("insert into audit_log (org_id, actor_type, action) values (null, 'user', 'auth.login')");
    const r = await owner.query("select count(*)::int as n from audit_log");
    expect(r.rows[0].n).toBe(4);
  });
});

describe("ndpa_auth (Better Auth)", () => {
  it("reads identity rows across organisations", async () => {
    const r = await auth.query("select count(*)::int as n from memberships");
    expect(r.rows[0].n).toBe(2);
    const s = await auth.query("select count(*)::int as n from sessions");
    expect(s.rows[0].n).toBe(0);
  });
});
