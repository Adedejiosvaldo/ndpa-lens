import { ObjectStore } from "@ndpa/storage";
import type { StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Client, createTestApp, ownerWithMfa, signedInUser, type TestApp } from "./harness.js";
import { startSeaweed } from "./seaweed.js";
import { type Deps, startDeps, stopDeps } from "./setup.js";
import { expectTenantIsolation } from "./tenant-harness.js";

let deps: Deps;
let s3: StartedTestContainer;
let t: TestApp;
let owner: { client: Client; userId: string; orgId: string };
let analyst: Client;
let outsider: Client;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#7a2e1d"/></svg>';

beforeAll(async () => {
  const [d, sw] = await Promise.all([startDeps(), startSeaweed()]);
  deps = d;
  s3 = sw.container;
  const config = {
    ...deps.config,
    S3_ENDPOINT: sw.config.endpoint,
    S3_BUCKET: sw.config.bucket,
    S3_ACCESS_KEY_ID: sw.config.accessKeyId,
    S3_SECRET_ACCESS_KEY: sw.config.secretAccessKey,
  };
  await new ObjectStore(sw.config).ensureBucket();
  t = await createTestApp(config);
  owner = await ownerWithMfa(t, "brand-owner@a.test");
  // Analyst in the same org
  await owner.client.post(`/v1/orgs/${owner.orgId}/invitations`, { email: "brand-analyst@a.test", role: "analyst" });
  const token = t.outbox.token("brand-analyst@a.test", /invited you/);
  analyst = await signedInUser(t, "brand-analyst@a.test", { organisation: false });
  await analyst.post(`/v1/invitations/${encodeURIComponent(token)}/accept`);
  outsider = (await ownerWithMfa(t, "brand-outsider@b.test")).client;
}, 240_000);

afterAll(async () => {
  await t?.app.close();
  await Promise.all([stopDeps(deps), s3?.stop()]);
});

async function rawPut(c: Client, path: string, bytes: Buffer | string, type: string) {
  const token = await c.ensureCsrf();
  const request = (await import("supertest")).default;
  const res = await request(t.app.getHttpServer())
    .put(path)
    .set("Cookie", c.cookieHeader)
    .set("X-CSRF-Token", token)
    .set("Content-Type", type)
    .send(bytes);
  return res;
}

describe("ORG-02 licence submission", () => {
  it("lets only the Owner submit, and sets the status to pending", async () => {
    expect((await analyst.post(`/v1/orgs/${owner.orgId}/licence`, { licenceNumber: "NDPC/DPCO/2026/0148" })).status).toBe(403);
    expect((await owner.client.post(`/v1/orgs/${owner.orgId}/licence`, { licenceNumber: "x" })).status).toBe(400);
    const res = await owner.client.post(`/v1/orgs/${owner.orgId}/licence`, { licenceNumber: "ndpc/dpco/2026/0148" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ licenceNumber: "NDPC/DPCO/2026/0148", licenceStatus: "pending" });
    const org = await owner.client.get(`/v1/orgs/${owner.orgId}`);
    expect(org.body).toMatchObject({ dpcoLicenceNo: "NDPC/DPCO/2026/0148", licenceStatus: "pending" });
  });
});

describe("BRAND-01 branding", () => {
  it("lets Admins and Owners save firm name, colour and contact block", async () => {
    const body = { firmName: "Adeyemi & Co", primaryColour: "#7A2E1D", contactBlock: "12 Awolowo Road, Ikoyi, Lagos", showLicenceOnCover: true };
    expect((await analyst.send("put", `/v1/orgs/${owner.orgId}/branding`, body)).status).toBe(403);
    const res = await owner.client.send("put", `/v1/orgs/${owner.orgId}/branding`, body);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ firmName: "Adeyemi & Co", primaryColour: "#7a2e1d", logo: null, logoUrl: null });
    // Every member can read it (they see it on packs).
    expect((await analyst.get(`/v1/orgs/${owner.orgId}/branding`)).body.firmName).toBe("Adeyemi & Co");
  });

  it("refuses colours too light to read on a white cover", async () => {
    const res = await owner.client.send("put", `/v1/orgs/${owner.orgId}/branding`, { firmName: "X", primaryColour: "#f5e663" });
    expect(res.status).toBe(400);
    expect(res.body.errors[0]).toMatchObject({ path: "primaryColour" });
  });

  it("stores a PNG logo by content hash and serves it only through a short-lived URL", async () => {
    const res = await rawPut(owner.client, `/v1/orgs/${owner.orgId}/branding/logo`, PNG, "image/png");
    expect(res.status).toBe(200);
    expect(res.body.logo.key).toMatch(new RegExp(`^orgs/${owner.orgId}/branding/logo-[0-9a-f]{64}\\.png$`));
    expect(res.body.logoUrl).toMatch(/X-Amz-Expires=300/);
    const fetched = await fetch(res.body.logoUrl);
    expect(fetched.status).toBe(200);
    expect(Buffer.from(await fetched.arrayBuffer()).equals(PNG)).toBe(true);
    // Saving branding later keeps the logo.
    const again = await owner.client.send("put", `/v1/orgs/${owner.orgId}/branding`, { firmName: "Adeyemi & Co", primaryColour: "#7a2e1d" });
    expect(again.body.logo.key).toBe(res.body.logo.key);
  });

  it("accepts a plain SVG and rejects unsafe ones, fakes and oversized files", async () => {
    expect((await rawPut(owner.client, `/v1/orgs/${owner.orgId}/branding/logo`, SVG, "image/svg+xml")).status).toBe(200);
    for (const bad of [
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.test/x.png"/></svg>',
      '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>x</div></foreignObject></svg>',
    ]) {
      const r = await rawPut(owner.client, `/v1/orgs/${owner.orgId}/branding/logo`, bad, "image/svg+xml");
      expect(r.status, bad).toBe(400);
      expect(r.body.code).toBe("validation_failed");
    }
    expect((await rawPut(owner.client, `/v1/orgs/${owner.orgId}/branding/logo`, Buffer.from("not a png"), "image/png")).status).toBe(400);
    const big = Buffer.concat([PNG, Buffer.alloc(1024 * 1024 + 10)]);
    const tooBig = await rawPut(owner.client, `/v1/orgs/${owner.orgId}/branding/logo`, big, "image/png");
    expect(tooBig.status).toBe(413);
    expect(tooBig.body.code).toBe("validation_failed");
    expect((await rawPut(analyst, `/v1/orgs/${owner.orgId}/branding/logo`, PNG, "image/png")).status).toBe(403);
  });

  it("records branding and licence changes in the org audit log", async () => {
    const log = await owner.client.get(`/v1/orgs/${owner.orgId}/audit-log?limit=100`);
    const actions = log.body.items.map((i: { action: string }) => i.action);
    for (const a of ["licence.submitted", "branding.updated", "branding.logo_uploaded"]) expect(actions).toContain(a);
  });
});

describe("tenant isolation", () => {
  it("returns 404 to another organisation on every org route, branding included", async () => {
    const routes = await expectTenantIsolation(t.app, outsider, owner.orgId);
    expect(routes.some((r) => r.path.endsWith("/branding/logo"))).toBe(true);
  });
});
