import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { expect } from "vitest";
import { uuidv7 } from "../src/common/ids.js";
import type { Client } from "./harness.js";

export interface TenantRoute {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
}

/** Every operation under /v1/orgs/{orgId}, read from the live OpenAPI document. */
export async function orgScopedRoutes(app: INestApplication): Promise<TenantRoute[]> {
  const doc = (await request(app.getHttpServer()).get("/v1/docs/openapi.json")).body as {
    paths: Record<string, Record<string, unknown>>;
  };
  const out: TenantRoute[] = [];
  for (const [path, ops] of Object.entries(doc.paths)) {
    if (!path.includes("{orgId}")) continue;
    for (const method of Object.keys(ops)) out.push({ method: method as TenantRoute["method"], path });
  }
  return out;
}

/**
 * PRD §12 tenant isolation: a member of another organisation must get 404 on
 * every org-scoped route of `orgId`. Path parameters other than orgId are filled
 * from `params` (real ids from the victim org) or a fresh uuid.
 */
export async function expectTenantIsolation(
  app: INestApplication,
  outsider: Client,
  orgId: string,
  params: Record<string, string> = {},
): Promise<TenantRoute[]> {
  const routes = await orgScopedRoutes(app);
  expect(routes.length).toBeGreaterThan(0);
  for (const r of routes) {
    const url = r.path.replace(/\{(\w+)\}/g, (_, name: string) => (name === "orgId" ? orgId : (params[name] ?? uuidv7())));
    const res = r.method === "get" ? await outsider.get(url) : await outsider.send(r.method, url, {});
    expect(res.status, `${r.method.toUpperCase()} ${r.path}`).toBe(404);
    expect(res.body.code, `${r.method.toUpperCase()} ${r.path}`).toBe("not_found");
  }
  return routes;
}
