import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ATTESTATION_VERSION, ExtraUrls, normaliseHostname } from "../src/clients/clients.dto.js";
import { ClientsService } from "../src/clients/clients.service.js";
import { DbService } from "../src/db/db.service.js";
import { type Client, createTestApp, ownerWithMfa, signedInUser, type TestApp } from "./harness.js";
import { type Deps, startDeps, stopDeps } from "./setup.js";
import { expectTenantIsolation } from "./tenant-harness.js";

let deps: Deps;
let t: TestApp;
let owner: pg.Pool;
let founder: { client: Client; orgId: string };
let analyst: Client;
let viewer: Client;
let outsider: Client;

async function join(email: string, role: string) {
  await founder.client.post(`/v1/orgs/${founder.orgId}/invitations`, { email, role });
  const token = t.outbox.token(email, /invited you/);
  const c = await signedInUser(t, email, { organisation: false });
  await c.post(`/v1/invitations/${encodeURIComponent(token)}/accept`);
  return c;
}

const base = () => `/v1/orgs/${founder.orgId}`;
const newClient = (c: Client, name = "Harbour Assurance Plc") =>
  c.post(`${base()}/clients`, { name, rcNumber: "rc 123456", sector: "insurance", ndpcTier: "uhl", contact: { name: "Ngozi Eze", email: "NGOZI@harbour.ng" } });

beforeAll(async () => {
  deps = await startDeps();
  t = await createTestApp(deps.config);
  owner = new pg.Pool({ connectionString: deps.ownerUrl });
  founder = await ownerWithMfa(t, "cli-owner@a.test");
  analyst = await join("cli-analyst@a.test", "analyst");
  viewer = await join("cli-viewer@a.test", "viewer");
  outsider = (await ownerWithMfa(t, "cli-outsider@b.test")).client;
}, 240_000);

afterAll(async () => {
  await t?.app.close();
  await owner?.end();
  await stopDeps(deps);
});

describe("hostname and named-page validation", () => {
  it("normalises pasted addresses and refuses internal ones", () => {
    expect(normaliseHostname("https://WWW.Harbour.ng/about?x=1")).toBe("www.harbour.ng");
    expect(normaliseHostname("harbour.ng.")).toBe("harbour.ng");
    for (const bad of ["localhost", "10.0.0.1", "http://[::1]/", "intranet", "server.local", "a.test", "not a host"]) {
      expect(normaliseHostname(bad), bad).toBeNull();
    }
  });

  it("keeps named pages on the same site, deduplicated", () => {
    const r = ExtraUrls("harbour.ng").safeParse(["/checkout", "https://www.harbour.ng/signup#top", "https://harbour.ng/checkout", "https://evil.test/x"]);
    expect(r.success).toBe(false);
    const ok = ExtraUrls("harbour.ng").parse(["/checkout", "https://www.harbour.ng/signup#top", "https://harbour.ng/checkout"]);
    expect(ok).toEqual(["https://harbour.ng/checkout", "https://www.harbour.ng/signup"]);
  });
});

describe("CLI-01 clients", () => {
  it("lets Analysts create; Viewers can read but not create", async () => {
    expect((await newClient(viewer)).status).toBe(403);
    const res = await newClient(analyst);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Harbour Assurance Plc", rcNumber: "RC 123456", sector: "insurance", ndpcTier: "uhl", contact: { email: "ngozi@harbour.ng" }, domains: [] });
    expect((await viewer.get(`${base()}/clients/${res.body.id}`)).status).toBe(200);
  });

  it("validates sector, tier and RC number", async () => {
    const r = await analyst.post(`${base()}/clients`, { name: "X", sector: "crypto", ndpcTier: "huge", rcNumber: "abc" });
    expect(r.status).toBe(400);
    expect(r.body.errors.map((e: { path: string }) => e.path).sort()).toEqual(["ndpcTier", "rcNumber", "sector"]);
  });
});

describe("CLI-02 domains and named pages", () => {
  let clientId: string;
  beforeAll(async () => {
    clientId = (await newClient(analyst, "Lekki Health Ltd")).body.id;
  });

  it("adds a domain with named pages and refuses duplicates in the org", async () => {
    const r = await analyst.post(`${base()}/clients/${clientId}/domains`, { hostname: "https://LekkiHealth.ng/", extraUrls: ["/book-appointment", "/careers"] });
    expect(r.status).toBe(201);
    expect(r.body.domains[0]).toMatchObject({ hostname: "lekkihealth.ng", extraUrls: ["https://lekkihealth.ng/book-appointment", "https://lekkihealth.ng/careers"], authorisation: null });
    const dup = await analyst.post(`${base()}/clients/${clientId}/domains`, { hostname: "lekkihealth.ng" });
    expect(dup.status).toBe(409);
    const other = (await newClient(analyst, "Other Co")).body.id;
    const dup2 = await analyst.post(`${base()}/clients/${other}/domains`, { hostname: "lekkihealth.ng" });
    expect(dup2.body.detail).toMatch(/another of your clients/);
  });

  it("refuses internal hostnames and off-site named pages", async () => {
    const r1 = await analyst.post(`${base()}/clients/${clientId}/domains`, { hostname: "192.168.1.10" });
    expect(r1.status).toBe(400);
    expect(r1.body.errors[0].path).toBe("hostname");
    const r2 = await analyst.post(`${base()}/clients/${clientId}/domains`, { hostname: "lekkiclinic.ng", extraUrls: ["https://evil.test/"] });
    expect(r2.status).toBe(400);
    expect(r2.body.errors[0].path).toBe("extraUrls.0");
  });

  it("edits named pages and removes a domain", async () => {
    const d = (await analyst.get(`${base()}/clients/${clientId}`)).body.domains[0];
    const r = await analyst.send("patch", `${base()}/domains/${d.id}`, { extraUrls: ["/contact"] });
    expect(r.body.domains[0].extraUrls).toEqual(["https://lekkihealth.ng/contact"]);
    expect((await viewer.delete(`${base()}/domains/${d.id}`)).status).toBe(403);
    expect((await analyst.delete(`${base()}/domains/${d.id}`)).status).toBe(204);
    expect((await analyst.get(`${base()}/clients/${clientId}`)).body.domains).toEqual([]);
  });
});

describe("CLI-03 authorisation attestation", () => {
  let clientId: string;
  let domainId: string;
  beforeAll(async () => {
    clientId = (await newClient(analyst, "Eko Bet Ltd")).body.id;
    domainId = (await analyst.post(`${base()}/clients/${clientId}/domains`, { hostname: "ekobet.ng" })).body.domains[0].id;
  });

  it("shows the exact statement, naming the firm, client and domain", async () => {
    const r = await viewer.get(`${base()}/domains/${domainId}/authorisation`);
    expect(r.body.statementVersion).toBe(ATTESTATION_VERSION);
    expect(r.body.statement).toMatch(/cli-owner Partners is engaged by Eko Bet Ltd to assess the website at ekobet\.ng/);
  });

  it("requires a tick and the current version; records user, time and IP", async () => {
    expect((await analyst.post(`${base()}/domains/${domainId}/authorisation`, { statementVersion: ATTESTATION_VERSION, confirm: false })).status).toBe(400);
    expect((await analyst.post(`${base()}/domains/${domainId}/authorisation`, { statementVersion: "1999-01-01", confirm: true })).status).toBe(400);
    expect((await viewer.post(`${base()}/domains/${domainId}/authorisation`, { statementVersion: ATTESTATION_VERSION, confirm: true })).status).toBe(403);
    const r = await analyst.post(`${base()}/domains/${domainId}/authorisation`, { statementVersion: ATTESTATION_VERSION, confirm: true });
    expect(r.status).toBe(201);
    const row = await owner.query("select a.ip::text as ip, a.statement, u.email from authorisations a join users u on u.id = a.user_id where a.domain_id = $1", [domainId]);
    expect(row.rows[0]).toMatchObject({ ip: "203.0.113.10/32", email: "cli-analyst@a.test" });
    expect(row.rows[0].statement).toMatch(/Eko Bet Ltd/);
    const detail = await viewer.get(`${base()}/clients/${clientId}`);
    expect(detail.body.domains[0].authorisation).toMatchObject({ current: true, by: "cli-analyst", statementVersion: ATTESTATION_VERSION });
  });

  it("is append-only: the API role cannot edit or delete an attestation", async () => {
    const api = new pg.Pool({ connectionString: deps.apiUrl });
    try {
      const c = await api.connect();
      await c.query("begin");
      await c.query("select set_config('app.org_id', $1, true)", [founder.orgId]);
      await expect(c.query("update authorisations set statement = 'x'")).rejects.toThrow(/permission denied/);
      await c.query("rollback");
      c.release();
    } finally {
      await api.end();
    }
  });
});

describe("scan precondition (for Step 22)", () => {
  it("needs an active client and a current attestation on every domain", async () => {
    const svc = t.app.get(ClientsService);
    const db = t.app.get(DbService);
    const clientId = (await newClient(analyst, "Ikeja Retail Ltd")).body.id;
    const d1 = (await analyst.post(`${base()}/clients/${clientId}/domains`, { hostname: "ikejaretail.ng" })).body.domains[0].id;
    const run = (ids: string[]) => db.withOrg(founder.orgId, (tx) => svc.assertScannable(tx, clientId, ids));
    await expect(run([])).rejects.toMatchObject({ code: "validation_failed" });
    await expect(run([d1])).rejects.toMatchObject({ code: "attestation_required" });
    await analyst.post(`${base()}/domains/${d1}/authorisation`, { statementVersion: ATTESTATION_VERSION, confirm: true });
    await expect(run([d1])).resolves.toBeUndefined();
    await analyst.delete(`${base()}/clients/${clientId}`);
    await expect(run([d1])).rejects.toMatchObject({ code: "client_archived" });
  });
});

describe("CLI-04 archive and CLI-05 list", () => {
  it("archived clients drop out of the list, keep history and refuse changes", async () => {
    const id = (await newClient(analyst, "Archived Holdings")).body.id;
    expect((await viewer.delete(`${base()}/clients/${id}`)).status).toBe(403);
    expect((await analyst.delete(`${base()}/clients/${id}`)).status).toBe(204);
    const active = await viewer.get(`${base()}/clients`);
    expect(active.body.items.map((c: { name: string }) => c.name)).not.toContain("Archived Holdings");
    const archived = await viewer.get(`${base()}/clients?archived=true`);
    expect(archived.body.items.map((c: { name: string }) => c.name)).toContain("Archived Holdings");
    const edit = await analyst.send("patch", `${base()}/clients/${id}`, { name: "New" });
    expect(edit.body.code).toBe("client_archived");
    expect((await analyst.post(`${base()}/clients/${id}/domains`, { hostname: "archived.ng" })).body.code).toBe("client_archived");
  });

  it("searches by name, RC number or domain, and filters by sector and tier", async () => {
    const byDomain = await viewer.get(`${base()}/clients?search=ekobet`);
    expect(byDomain.body.items.map((c: { name: string }) => c.name)).toEqual(["Eko Bet Ltd"]);
    // Regression: the count once compared a domain's client_id with its own id and was always 0.
    expect(byDomain.body.items[0].domainCount).toBeGreaterThanOrEqual(1);
    const byName = await viewer.get(`${base()}/clients?search=harbour`);
    expect(byName.body.items[0]).toMatchObject({ name: "Harbour Assurance Plc", domainCount: 0, lastScanAt: null });
    const sector = await viewer.get(`${base()}/clients?sector=insurance&tier=uhl`);
    expect(sector.body.items.every((c: { sector: string; ndpcTier: string }) => c.sector === "insurance" && c.ndpcTier === "uhl")).toBe(true);
    const weird = await viewer.get(`${base()}/clients?search=${encodeURIComponent("%_")}`);
    expect(weird.body.items).toEqual([]);
  });

  it("pages with a cursor", async () => {
    const p1 = await viewer.get(`${base()}/clients?limit=2`);
    expect(p1.body.items).toHaveLength(2);
    const p2 = await viewer.get(`${base()}/clients?limit=50&cursor=${p1.body.nextCursor}`);
    const ids = new Set(p1.body.items.map((c: { id: string }) => c.id));
    expect(p2.body.items.some((c: { id: string }) => ids.has(c.id))).toBe(false);
  });
});

describe("tenant isolation", () => {
  it("returns 404 to another organisation on every client and domain route", async () => {
    const c = (await newClient(analyst, "Isolation Co")).body;
    const d = (await analyst.post(`${base()}/clients/${c.id}/domains`, { hostname: "isolation.ng" })).body.domains[0];
    const routes = await expectTenantIsolation(t.app, outsider, founder.orgId, { clientId: c.id, domainId: d.id, userId: c.id, invitationId: c.id });
    expect(routes.some((r) => r.path.includes("/domains/{domainId}/authorisation"))).toBe(true);
  });

  it("the database refuses a domain pointing at another org's client", async () => {
    const theirs = (await newClient(analyst, "Cross Co")).body.id;
    const outsiderOrg = (await outsider.get("/v1/me")).body.memberships[0].orgId;
    const api = new pg.Pool({ connectionString: deps.apiUrl });
    try {
      const c = await api.connect();
      await c.query("begin");
      await c.query("select set_config('app.org_id', $1, true)", [outsiderOrg]);
      await expect(c.query("insert into domains (org_id, client_id, hostname) values ($1, $2, 'sneaky.ng')", [outsiderOrg, theirs])).rejects.toThrow(/same organisation/);
      await c.query("rollback");
      c.release();
    } finally {
      await api.end();
    }
  });
});
