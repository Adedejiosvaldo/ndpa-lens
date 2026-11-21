import { ObjectStore, sha256Hex } from "@ndpa/storage";
import type { StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EvidenceWriter } from "../src/index.js";
import { startSeaweed } from "./seaweed.js";

let container: StartedTestContainer;
let store: ObjectStore;

beforeAll(async () => {
  const s = await startSeaweed();
  container = s.container;
  store = new ObjectStore(s.config);
  await store.ensureBucket();
}, 180_000);

afterAll(async () => {
  await container?.stop();
});

describe("EvidenceWriter (PRD §7, PACK-03)", () => {
  it("stores files under the scan layout and records their SHA-256", async () => {
    const w = new EvidenceWriter(store, "org-1", "scan-1");
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const shot = await w.put("screenshot", png, { pageId: "page-1", consentState: "reject", contentType: "image/png" });
    const pre = await w.put("preflight", { status: 200 });
    expect(shot).toMatchObject({ key: "orgs/org-1/scans/scan-1/page-1/reject/screenshot.png", sha256: sha256Hex(png), bytes: 7, consentState: "reject" });
    expect(pre.key).toBe("orgs/org-1/scans/scan-1/preflight.json");
    expect(w.files).toHaveLength(2);
  });

  it("verifies stored bytes still match their recorded hash", async () => {
    const w = new EvidenceWriter(store, "org-1", "scan-2");
    const f = await w.put("dom", "<html>evidence</html>", { pageId: "p", consentState: "none", contentType: "text/html" });
    expect(await w.verify(f)).toBe(true);
    await store.put(f.key, new TextEncoder().encode("<html>tampered</html>"), "text/html");
    expect(await w.verify(f)).toBe(false);
  });
});
