import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer, type StartedRedisContainer } from "@testcontainers/redis";
import type { AppConfig } from "../src/config/config.js";

export interface Deps {
  pg: StartedPostgreSqlContainer;
  redis: StartedRedisContainer;
  config: AppConfig;
}

/** Real Postgres 16 and Redis 7 for integration tests (PRD §12: Testcontainers). */
export async function startDeps(): Promise<Deps> {
  const [pg, redis] = await Promise.all([
    new PostgreSqlContainer("postgres:16-alpine").start(),
    new RedisContainer("redis:7-alpine").start(),
  ]);
  return {
    pg,
    redis,
    config: {
      NODE_ENV: "test",
      PORT: 0,
      LOG_LEVEL: "silent",
      DATABASE_URL: pg.getConnectionUri(),
      REDIS_URL: redis.getConnectionUrl(),
      WEB_URL: "http://localhost:3000",
    },
  };
}

export async function stopDeps(d: Deps | undefined): Promise<void> {
  await Promise.all([d?.pg.stop(), d?.redis.stop()]);
}
