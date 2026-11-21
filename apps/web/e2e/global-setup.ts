import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer } from "@testcontainers/redis";
import { GenericContainer, Wait } from "testcontainers";
import { API_URL, WEB_URL } from "./env";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const PASSWORDS = { api: "e2e-api-password-0123", auth: "e2e-auth-password-0123" };

function asRole(uri: string, role: string, password: string) {
  const u = new URL(uri);
  u.username = role;
  u.password = password;
  return u.toString();
}

async function waitFor(url: string, proc: ChildProcess, name: string) {
  for (let i = 0; i < 120; i++) {
    if (proc.exitCode !== null) throw new Error(`${name} exited with ${proc.exitCode}`);
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${name} did not start at ${url}`);
}

export default async function globalSetup() {
  const [pg, redis, mailpit] = await Promise.all([
    new PostgreSqlContainer("postgres:16-alpine").start(),
    new RedisContainer("redis:7-alpine").start(),
    new GenericContainer("axllent/mailpit:v1.27").withExposedPorts(1025, 8025).withWaitStrategy(Wait.forListeningPorts()).start(),
  ]);
  const owner = pg.getConnectionUri();
  const mailpitHttp = `http://${mailpit.getHost()}:${mailpit.getMappedPort(8025)}`;
  process.env.E2E_MAILPIT_URL = mailpitHttp;

  execFileSync("pnpm", ["--filter", "api", "db:setup"], {
    cwd: repo,
    stdio: "inherit",
    env: { ...process.env, MIGRATION_DATABASE_URL: owner, DB_API_PASSWORD: PASSWORDS.api, DB_AUTH_PASSWORD: PASSWORDS.auth },
  });

  const api = spawn("node", ["--enable-source-maps", "apps/api/dist/main.js"], {
    cwd: repo,
    stdio: ["ignore", "inherit", "inherit"],
    env: {
      ...process.env,
      NODE_ENV: "test",
      LOG_LEVEL: "warn",
      PORT: new URL(API_URL).port,
      DATABASE_URL: asRole(owner, "ndpa_api", PASSWORDS.api),
      AUTH_DATABASE_URL: asRole(owner, "ndpa_auth", PASSWORDS.auth),
      REDIS_URL: redis.getConnectionUrl(),
      WEB_URL,
      API_URL,
      BETTER_AUTH_SECRET: "e2e-secret-0123456789-0123456789-abcdef",
      SMTP_URL: `smtp://${mailpit.getHost()}:${mailpit.getMappedPort(1025)}`,
      EMAIL_FROM: "NDPA Lens <no-reply@ndpa.test>",
      TRUST_PROXY: "loopback",
    },
  });
  const web = spawn("pnpm", ["--filter", "web", "exec", "next", "start", "-p", new URL(WEB_URL).port], {
    cwd: repo,
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, NODE_ENV: "production" },
  });

  const teardown = async () => {
    api.kill("SIGTERM");
    web.kill("SIGTERM");
    await Promise.all([pg.stop(), redis.stop(), mailpit.stop()]);
  };
  try {
    await waitFor(`${API_URL}/v1/health`, api, "API");
    await waitFor(`${WEB_URL}/login`, web, "web");
  } catch (e) {
    // Playwright skips teardown when setup throws: don't leave servers holding the ports.
    await teardown();
    throw e;
  }
  return teardown;
}
