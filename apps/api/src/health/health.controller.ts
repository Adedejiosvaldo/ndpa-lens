import { Controller, Get, Res } from "@nestjs/common";
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { DbService } from "../db/db.service.js";
import { RedisService } from "../redis/redis.service.js";

type CheckState = "up" | "down";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly db: DbService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOkResponse({ description: "All dependencies reachable" })
  @ApiServiceUnavailableResponse({ description: "A dependency is down" })
  async health(@Res({ passthrough: true }) res: Response) {
    const [database, redis] = await Promise.all([state(this.db.ping()), state(this.redis.ping())]);
    const ok = database === "up" && redis === "up";
    res.status(ok ? 200 : 503).setHeader("Cache-Control", "no-store");
    return { status: ok ? "ok" : "degraded", checks: { database, redis } };
  }
}

async function state(p: Promise<void>): Promise<CheckState> {
  try {
    await withTimeout(p, 3_000);
    return "up";
  } catch {
    return "down";
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}
