import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client, createTestApp, ownerWithMfa, signedInUser, type TestApp } from "./harness.js";
import { type Deps, startDeps, stopDeps } from "./setup.js";
import { expectTenantIsolation } from "./tenant-harness.js";

let deps: Deps;
let t: TestApp;
let owner: pg.Pool;

type Member = { client: Client; userId: string };
let alice: Member & { orgId: string }; // Owner of A (MFA)
let bob: Member & { orgId: string }; // Owner of B (MFA)
let erin: Member; // Admin of A
let carol: Member; // Analyst of A
let dave: Member; // Viewer of A

/** Invite `email` to `orgId`, sign them up without an org, accept. */
async function join(inviter: Client, orgId: string, email: string, role: string): Promise<Member> {
  const inv = await inviter.post(`/v1/orgs/${orgId}/invitations`, { email, role });
  expect(inv.status).toBe(201);
  const token = t.outbox.token(email, /invited you/);
  const client = await signedInUser(t, email, { organisation: false });
  const acc = await client.post(`/v1/invitations/${encodeURIComponent(token)}/accept`);
  expect(acc.status).toBe(200);
  expect(acc.body).toEqual({ orgId, role });
  const me = await client.get("/v1/me");
  return { client, userId: me.body.user.id };
}

beforeAll(async () => {
  deps = await startDeps();
  t = await createTestApp(deps.config);
  owner = new pg.Pool({ connectionString: deps.ownerUrl });
  alice = await ownerWithMfa(t, "alice@a.test");
  bob = await ownerWithMfa(t, "bob@b.test");
  erin = await join(alice.client, alice.orgId, "erin@a.test", "admin");
  carol = await join(alice.client, alice.orgId, "carol@a.test", "analyst");
  dave = await join(alice.client, alice.orgId, "dave@a.test", "viewer");
});

afterAll(async () => {
  await t?.app.close();
  await owner?.end();
  await stopDeps(deps);
});

describe("ORG-01 organisation created at sign-up", () => {
  it("makes the founder its Owner with the sign-up details", async () => {
    const me = await alice.client.get("/v1/me");
    expect(me.body.memberships).toEqual([{ orgId: alice.orgId, name: "alice Partners", role: "owner" }]);
    const org = await alice.client.get(`/v1/orgs/${alice.orgId}`);
    expect(org.status).toBe(200);
    expect(org.body).toMatchObject({ name: "alice Partners", legalName: "alice Partners Ltd", address: "1 Marina, Lagos", licenceStatus: "unsubmitted" });
  });

  it("requires the Owner to enrol MFA before using the organisation", async () => {
    const founder = await signedInUser(t, "nomfa@a.test");
    const orgId = (await founder.get("/v1/me")).body.memberships[0].orgId;
    const res = await founder.get(`/v1/orgs/${orgId}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("mfa_enrolment_required");
  });
});

describe("PRD §2 permission matrix", () => {
  const A = () => alice.orgId;
  it("lets every member view the organisation", async () => {
    for (const m of [alice, erin, carol, dave]) expect((await m.client.get(`/v1/orgs/${A()}`)).status).toBe(200);
  });

  it("limits editing the profile, members, invitations and the audit log to Owner and Admin", async () => {
    for (const m of [carol, dave]) {
      expect((await m.client.send("patch", `/v1/orgs/${A()}`, { phone: "+234 800 000 0000" })).status).toBe(403);
      expect((await m.client.get(`/v1/orgs/${A()}/members`)).status).toBe(403);
      expect((await m.client.get(`/v1/orgs/${A()}/invitations`)).status).toBe(403);
      expect((await m.client.post(`/v1/orgs/${A()}/invitations`, { email: "x@a.test", role: "viewer" })).status).toBe(403);
      expect((await m.client.get(`/v1/orgs/${A()}/audit-log`)).status).toBe(403);
    }
    for (const m of [alice, erin]) {
      expect((await m.client.send("patch", `/v1/orgs/${A()}`, { phone: "+234 800 000 0001" })).status).toBe(200);
      expect((await m.client.get(`/v1/orgs/${A()}/members`)).status).toBe(200);
      expect((await m.client.get(`/v1/orgs/${A()}/audit-log`)).status).toBe(200);
    }
  });

  it("returns 403 with a reason, not 404, to members lacking the role", async () => {
    const res = await dave.client.get(`/v1/orgs/${A()}/members`);
    expect(res.body).toMatchObject({ code: "forbidden", detail: "This needs the admin role or higher." });
  });
});

describe("ORG-04 invitations", () => {
  it("expire in 7 days and are stored hashed", async () => {
    await alice.client.post(`/v1/orgs/${alice.orgId}/invitations`, { email: "frank@a.test", role: "viewer" });
    const token = t.outbox.token("frank@a.test", /invited you/);
    const r = await owner.query<{ days: number; token_hash: string }>(
      "select round(extract(epoch from expires_at - created_at) / 86400)::int as days, token_hash from invitations where email = 'frank@a.test'",
    );
    expect(r.rows[0]!.days).toBe(7);
    expect(token).not.toContain(r.rows[0]!.token_hash);
    const list = await alice.client.get(`/v1/orgs/${alice.orgId}/invitations`);
    expect(list.body.items.map((i: { email: string }) => i.email)).toContain("frank@a.test");
  });

  it("only works for the invited email, once, before expiry", async () => {
    await alice.client.post(`/v1/orgs/${alice.orgId}/invitations`, { email: "gina@a.test", role: "analyst" });
    const token = t.outbox.token("gina@a.test", /invited you/);
    const path = `/v1/invitations/${encodeURIComponent(token)}/accept`;

    const wrong = await signedInUser(t, "notgina@a.test", { organisation: false });
    expect((await wrong.post(path)).status).toBe(403);

    const gina = await signedInUser(t, "gina@a.test", { organisation: false });
    expect((await gina.post(path)).status).toBe(200);
    expect((await gina.post(path)).status).toBe(404);
  });

  it("refuses expired invitations with 410", async () => {
    await alice.client.post(`/v1/orgs/${alice.orgId}/invitations`, { email: "hal@a.test", role: "viewer" });
    const token = t.outbox.token("hal@a.test", /invited you/);
    await owner.query("update invitations set expires_at = now() - interval '1 minute' where email = 'hal@a.test'");
    const hal = await signedInUser(t, "hal@a.test", { organisation: false });
    const res = await hal.post(`/v1/invitations/${encodeURIComponent(token)}/accept`);
    expect(res.status).toBe(410);
    expect(res.body.code).toBe("invitation_expired");
  });

  it("replaces an earlier invitation to the same email, and can be cancelled", async () => {
    await alice.client.post(`/v1/orgs/${alice.orgId}/invitations`, { email: "ivy@a.test", role: "viewer" });
    const first = t.outbox.token("ivy@a.test", /invited you/);
    const second = await alice.client.post(`/v1/orgs/${alice.orgId}/invitations`, { email: "ivy@a.test", role: "analyst" });
    const ivy = await signedInUser(t, "ivy@a.test", { organisation: false });
    expect((await ivy.post(`/v1/invitations/${encodeURIComponent(first)}/accept`)).status).toBe(404);
    expect((await alice.client.delete(`/v1/orgs/${alice.orgId}/invitations/${second.body.id}`)).status).toBe(204);
    const latest = t.outbox.token("ivy@a.test", /invited you/);
    expect((await ivy.post(`/v1/invitations/${encodeURIComponent(latest)}/accept`)).status).toBe(404);
  });

  it("rejects inviting a member, or inviting as Owner", async () => {
    expect((await alice.client.post(`/v1/orgs/${alice.orgId}/invitations`, { email: "carol@a.test", role: "viewer" })).status).toBe(409);
    expect((await alice.client.post(`/v1/orgs/${alice.orgId}/invitations`, { email: "z@a.test", role: "owner" })).status).toBe(400);
  });
});

describe("ORG-05 roles, removal and the last Owner", () => {
  it("lets an Admin change roles but not an Owner's", async () => {
    expect((await erin.client.send("patch", `/v1/orgs/${alice.orgId}/members/${dave.userId}`, { role: "analyst" })).status).toBe(204);
    expect((await erin.client.send("patch", `/v1/orgs/${alice.orgId}/members/${dave.userId}`, { role: "viewer" })).status).toBe(204);
    expect((await erin.client.send("patch", `/v1/orgs/${alice.orgId}/members/${alice.userId}`, { role: "admin" })).status).toBe(403);
    expect((await erin.client.send("patch", `/v1/orgs/${alice.orgId}/members/${alice.userId}`, { role: "owner" })).status).toBe(400);
  });

  it("never leaves an organisation without an Owner", async () => {
    const demote = await alice.client.send("patch", `/v1/orgs/${alice.orgId}/members/${alice.userId}`, { role: "admin" });
    expect(demote.status).toBe(409);
    expect(demote.body.code).toBe("last_owner");
    const leave = await alice.client.delete(`/v1/orgs/${alice.orgId}/members/${alice.userId}`);
    expect(leave.body.code).toBe("last_owner");
    expect((await erin.client.delete(`/v1/orgs/${alice.orgId}/members/${alice.userId}`)).status).toBe(403);
  });

  it("lets members leave, and only Admins remove others", async () => {
    const extra = await join(alice.client, alice.orgId, "jo@a.test", "viewer");
    expect((await dave.client.delete(`/v1/orgs/${alice.orgId}/members/${extra.userId}`)).status).toBe(403);
    expect((await extra.client.delete(`/v1/orgs/${alice.orgId}/members/${extra.userId}`)).status).toBe(204);
    expect((await extra.client.get(`/v1/orgs/${alice.orgId}`)).status).toBe(404);

    const extra2 = await join(alice.client, alice.orgId, "kim@a.test", "analyst");
    expect((await erin.client.delete(`/v1/orgs/${alice.orgId}/members/${extra2.userId}`)).status).toBe(204);
  });
});

describe("ORG-05 ownership transfer", () => {
  it("needs the new Owner to accept; the old Owner becomes Admin", async () => {
    const { client: owner2, userId: o2, orgId } = await ownerWithMfa(t, "lena@c.test");
    const mo = await join(owner2, orgId, "mo@c.test", "analyst");

    expect((await mo.client.post(`/v1/orgs/${orgId}/ownership-transfer`, { userId: mo.userId })).status).toBe(403);
    expect((await owner2.post(`/v1/orgs/${orgId}/ownership-transfer`, { userId: mo.userId })).status).toBe(202);
    expect((await owner2.post(`/v1/orgs/${orgId}/ownership-transfer`, { userId: mo.userId })).status).toBe(409);
    expect(t.outbox.to("mo@c.test").some((m) => /become an Owner/.test(m.subject))).toBe(true);

    // Only the named member can accept.
    expect((await owner2.post(`/v1/orgs/${orgId}/ownership-transfer/accept`)).status).toBe(404);
    expect((await mo.client.post(`/v1/orgs/${orgId}/ownership-transfer/accept`)).status).toBe(204);

    const roles = await owner.query("select u.email, m.role from memberships m join users u on u.id = m.user_id where m.org_id = $1 order by u.email", [orgId]);
    expect(roles.rows).toEqual([
      { email: "lena@c.test", role: "admin" },
      { email: "mo@c.test", role: "owner" },
    ]);
    // The new Owner must now enrol MFA (AUTH-05).
    expect((await mo.client.get(`/v1/orgs/${orgId}`)).body.code).toBe("mfa_enrolment_required");
    expect(o2).toBeTruthy();
  });

  it("can be cancelled by the Owner", async () => {
    const { client: o, orgId } = await ownerWithMfa(t, "nia@d.test");
    const m = await join(o, orgId, "ola@d.test", "viewer");
    await o.post(`/v1/orgs/${orgId}/ownership-transfer`, { userId: m.userId });
    expect((await o.get(`/v1/orgs/${orgId}/ownership-transfer`)).body.pending.toUserId).toBe(m.userId);
    expect((await o.delete(`/v1/orgs/${orgId}/ownership-transfer`)).status).toBe(204);
    expect((await m.client.post(`/v1/orgs/${orgId}/ownership-transfer/accept`)).status).toBe(404);
  });
});

describe("audit log", () => {
  it("records org events and pages with a cursor", async () => {
    const p1 = await alice.client.get(`/v1/orgs/${alice.orgId}/audit-log?limit=2`);
    expect(p1.status).toBe(200);
    expect(p1.body.items).toHaveLength(2);
    expect(p1.body.nextCursor).toBeTruthy();
    const p2 = await alice.client.get(`/v1/orgs/${alice.orgId}/audit-log?limit=100&cursor=${p1.body.nextCursor}`);
    const ids = new Set(p1.body.items.map((i: { id: string }) => i.id));
    expect(p2.body.items.some((i: { id: string }) => ids.has(i.id))).toBe(false);
    const actions = [...p1.body.items, ...p2.body.items].map((i: { action: string }) => i.action);
    for (const a of ["org.created", "invitation.created", "invitation.accepted", "member.role_changed", "member.left", "member.removed", "org.updated"]) {
      expect(actions, a).toContain(a);
    }
    // Never another org's events.
    expect((await bob.client.get(`/v1/orgs/${bob.orgId}/audit-log`)).body.items.every((i: { action: string }) => i.action === "org.created")).toBe(true);
  });
});

describe("PRD §12 tenant isolation", () => {
  it("returns 404 to another organisation's Owner on every org route", async () => {
    const routes = await expectTenantIsolation(t.app, bob.client, alice.orgId, {
      userId: carol.userId,
      invitationId: "00000000-0000-7000-8000-000000000000",
    });
    // Guard against the harness silently testing nothing.
    expect(routes.length).toBeGreaterThanOrEqual(13);
  });

  it("returns 404 for malformed and unknown organisation ids", async () => {
    expect((await bob.client.get("/v1/orgs/not-a-uuid")).status).toBe(404);
    expect((await bob.client.get("/v1/orgs/01936f6e-8c2a-7b3e-9a1f-2c3d4e5f6a7b")).status).toBe(404);
  });
});
