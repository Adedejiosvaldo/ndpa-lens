import type { StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ObjectStore, sha256Hex } from "../src/index.js";
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

describe("ObjectStore", () => {
  it("stores bytes, reports their SHA-256 and reads them back", async () => {
    const bytes = new TextEncoder().encode("evidence");
    const r = await store.put("orgs/a/x.txt", bytes, "text/plain");
    expect(r).toEqual({ key: "orgs/a/x.txt", sha256: sha256Hex(bytes), bytes: 8 });
    expect(new TextDecoder().decode(await store.get("orgs/a/x.txt"))).toBe("evidence");
  });

  it("keeps the bucket private and serves through a pre-signed URL", async () => {
    await store.put("orgs/a/y.txt", new TextEncoder().encode("hello"), "text/plain");
    const anon = await fetch(`${store.config.endpoint}/${store.config.bucket}/orgs/a/y.txt`);
    expect(anon.status).toBe(403);
    const url = await store.presignGet("orgs/a/y.txt", { seconds: 60 });
    expect(url).toMatch(/X-Amz-Expires=60/);
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("hello");
  });

  it("ensureBucket is idempotent and ping works", async () => {
    await store.ensureBucket();
    await expect(store.ping()).resolves.toBeUndefined();
  });
});
