import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer, type StartedRedisContainer } from "@testcontainers/redis";
import type { AppConfig } from "../src/config/config.js";
import { configureRoles, runMigrations } from "../src/db/migrate.js";

export interface Deps {
  pg: StartedPostgreSqlContainer;
  redis: StartedRedisContainer;
  config: AppConfig;
  /** Superuser (container default): migrations and fixtures only. */
  ownerUrl: string;
  apiUrl: string;
  authUrl: string;
}

const PASSWORDS = { api: "test-api-password-0123", auth: "test-auth-password-0123" };

function asRole(uri: string, role: string, password: string): string {
  const u = new URL(uri);
  u.username = role;
  u.password = password;
  return u.toString();
}

/** Real Postgres 16 (migrated, roles configured) and Redis 7 (PRD §12). */
export async function startDeps(): Promise<Deps> {
  const [pg, redis] = await Promise.all([
    new PostgreSqlContainer("postgres:16-alpine").start(),
    new RedisContainer("redis:7-alpine").start(),
  ]);
  const ownerUrl = pg.getConnectionUri();
  await runMigrations(ownerUrl);
  await configureRoles(ownerUrl, PASSWORDS);
  const apiUrl = asRole(ownerUrl, "ndpa_api", PASSWORDS.api);
  const authUrl = asRole(ownerUrl, "ndpa_auth", PASSWORDS.auth);
  return {
    pg,
    redis,
    ownerUrl,
    apiUrl,
    authUrl,
    config: {
      NODE_ENV: "test",
      PORT: 0,
      LOG_LEVEL: "silent",
      DATABASE_URL: apiUrl,
      AUTH_DATABASE_URL: authUrl,
      REDIS_URL: redis.getConnectionUrl(),
      WEB_URL: "http://web.test",
      API_URL: "http://api.test",
      BETTER_AUTH_SECRET: "test-secret-0123456789-0123456789-abcdef",
      SMTP_URL: "smtp://127.0.0.1:1",
      EMAIL_FROM: "NDPA Lens <no-reply@ndpa.test>",
      // Tests simulate client IPs with X-Forwarded-For.
      TRUST_PROXY: true,
    },
  };
}

export async function stopDeps(d: Deps | undefined): Promise<void> {
  await Promise.all([d?.pg.stop(), d?.redis.stop()]);
}
