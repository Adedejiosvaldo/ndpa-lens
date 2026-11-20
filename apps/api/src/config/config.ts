import { z } from "zod";

const trustProxy = z
  .string()
  .default("loopback")
  .transform((v): boolean | number | string => (v === "true" ? true : v === "false" ? false : /^\d+$/.test(v) ? Number(v) : v));

/** Environment the API needs. Validated once at boot; the process exits on bad config. */
export const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  /** ndpa_api role: tenant-scoped by RLS. */
  DATABASE_URL: z.string().url(),
  /** ndpa_auth role: Better Auth's identity tables only. */
  AUTH_DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  WEB_URL: z.string().url().default("http://localhost:3000"),
  API_URL: z.string().url().default("http://localhost:4000"),
  /** Signs/encrypts Better Auth tokens and TOTP secrets. 32+ random characters. */
  BETTER_AUTH_SECRET: z.string().min(32),
  SMTP_URL: z.string().url(),
  EMAIL_FROM: z.string().min(3),
  /** Express "trust proxy": which hops may set X-Forwarded-For (client IP for rate limits and audit). */
  TRUST_PROXY: trustProxy,
});
export type AppConfig = z.infer<typeof ConfigSchema>;

export const APP_CONFIG = Symbol("APP_CONFIG");

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid API configuration:\n${lines}`);
  }
  return parsed.data;
}
