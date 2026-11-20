import { Body, Controller, type INestApplication, Post, Query, Get } from "@nestjs/common";
import { sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { RequiresIdempotencyKey } from "../src/common/idempotency.js";
import { decodeCursor, encodeCursor, PageQuery, toPage } from "../src/common/pagination.js";
import { ZodPipe } from "../src/common/zod.pipe.js";
import { DbService } from "../src/db/db.service.js";
import { Client, createTestApp } from "./harness.js";
import { type Deps, startDeps, stopDeps } from "./setup.js";

let deps: Deps;
let app: INestApplication;

beforeAll(async () => {
  deps = await startDeps();
  app = (await createTestApp(deps.config)).app;
});

afterAll(async () => {
  await app?.close();
  await stopDeps(deps);
});

describe("GET /v1/health", () => {
  it("is 200 when Postgres and Redis are up", async () => {
    const res = await request(app.getHttpServer()).get("/v1/health").expect(200);
    expect(res.body).toEqual({ status: "ok", checks: { database: "up", redis: "up" } });
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("is 503 when Postgres is unreachable", async () => {
    const broken = (await createTestApp({ ...deps.config, DATABASE_URL: "postgres://x:y@127.0.0.1:1/none" })).app;
    try {
      const res = await request(broken.getHttpServer()).get("/v1/health").expect(503);
      expect(res.body.checks).toEqual({ database: "down", redis: "up" });
    } finally {
      await broken.close();
    }
  });
});

describe("problem+json", () => {
  it("returns not_found for unknown routes and echoes a safe X-Request-Id", async () => {
    const res = await request(app.getHttpServer()).get("/v1/nope").set("X-Request-Id", "req-123").expect(404);
    expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(res.headers["x-request-id"]).toBe("req-123");
    expect(res.body).toMatchObject({ status: 404, code: "not_found", instance: "/v1/nope", requestId: "req-123" });
  });

  it("replaces an unsafe X-Request-Id", async () => {
    const res = await request(app.getHttpServer()).get("/v1/nope").set("X-Request-Id", "<script>").expect(404);
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("does not advertise Express", async () => {
    const res = await request(app.getHttpServer()).get("/v1/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("OpenAPI", () => {
  it("serves an OpenAPI 3.1 document", async () => {
    const res = await request(app.getHttpServer()).get("/v1/docs/openapi.json").expect(200);
    expect(res.body.openapi).toBe("3.1.0");
    expect(res.body.paths).toHaveProperty("/v1/health");
  });
});

describe("DbService.withOrg", () => {
  const orgA = "01936f6e-8c2a-7b3e-9a1f-2c3d4e5f6a7b";

  it("sets app.org_id inside the transaction only", async () => {
    const db = app.get(DbService);
    const inside = await db.withOrg(orgA, async (tx) => {
      const r = await tx.execute<{ v: string }>(sql`select current_setting('app.org_id', true) as v`);
      return r.rows[0]?.v;
    });
    expect(inside).toBe(orgA);

    // Use every pooled connection afterwards: none may still carry the setting.
    const after = await Promise.all(
      Array.from({ length: 10 }, () => db.pool.query<{ v: string | null }>("select current_setting('app.org_id', true) as v")),
    );
    for (const r of after) expect(r.rows[0]?.v ?? "").toBe("");
  });

  it("rolls back on error and still clears the setting", async () => {
    const db = app.get(DbService);
    await expect(
      db.withOrg(orgA, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const r = await db.pool.query<{ v: string | null }>("select current_setting('app.org_id', true) as v");
    expect(r.rows[0]?.v ?? "").toBe("");
  });
});

// A throwaway controller to exercise the shared pipes and interceptors.
const Body1 = z.object({ name: z.string().min(2) });

@Controller("_test")
class ProbeController {
  @Post("validate")
  validate(@Body(new ZodPipe(Body1)) body: z.infer<typeof Body1>) {
    return body;
  }

  @Post("spend")
  @RequiresIdempotencyKey()
  spend() {
    return { ok: true };
  }

  @Get("page")
  page(@Query(new ZodPipe(PageQuery)) q: z.infer<typeof PageQuery>) {
    return { limit: q.limit, after: decodeCursor(q.cursor) };
  }
}

describe("shared request plumbing", () => {
  let probe: INestApplication;

  let client: Client;

  beforeAll(async () => {
    probe = (await createTestApp(deps.config, [ProbeController])).app;
    client = new Client(probe);
  });

  afterAll(async () => {
    await probe?.close();
  });

  it("turns Zod failures into validation_failed with field errors", async () => {
    const res = await client.post("/v1/_test/validate", { name: "a" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("validation_failed");
    expect(res.body.errors[0].path).toBe("name");
  });

  it("requires an Idempotency-Key on spending routes", async () => {
    const missing = await client.post("/v1/_test/spend");
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe("idempotency_key_required");
    const ok = await client.post("/v1/_test/spend", undefined, { "Idempotency-Key": "abc12345-xyz" });
    expect(ok.status).toBe(201);
  });

  it("caps page size at 100 and rejects bad cursors", async () => {
    await request(probe.getHttpServer()).get("/v1/_test/page?limit=101").expect(400);
    const ok = await request(probe.getHttpServer()).get("/v1/_test/page").expect(200);
    expect(ok.body.limit).toBe(25);
    const bad = await request(probe.getHttpServer()).get("/v1/_test/page?cursor=nope").expect(400);
    expect(bad.body.errors[0].path).toBe("cursor");
  });
});

describe("pagination helpers", () => {
  it("round-trips cursors and builds pages from limit + 1 rows", () => {
    const id = "01936f6e-8c2a-7b3e-9a1f-2c3d4e5f6a7b";
    expect(decodeCursor(encodeCursor(id))).toBe(id);
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(toPage(rows, 2)).toEqual({ items: [{ id: "a" }, { id: "b" }], nextCursor: encodeCursor("b") });
    expect(toPage(rows, 3).nextCursor).toBeNull();
  });
});
