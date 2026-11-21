import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/config.js";

describe("loadConfig", () => {
  it("applies defaults", () => {
    const c = loadConfig({
      DATABASE_URL: "postgres://a:b@h/d",
      AUTH_DATABASE_URL: "postgres://c:d@h/d",
      REDIS_URL: "redis://h:6379",
      BETTER_AUTH_SECRET: "x".repeat(32),
      SMTP_URL: "smtp://h:25",
      EMAIL_FROM: "a@b.c",
      S3_ENDPOINT: "http://s3.test",
      S3_BUCKET: "bucket",
      S3_ACCESS_KEY_ID: "k",
      S3_SECRET_ACCESS_KEY: "s",
    });
    expect(c.S3_FORCE_PATH_STYLE).toBe(true);
    expect(c.PORT).toBe(4000);
    expect(c.NODE_ENV).toBe("development");
    expect(c.TRUST_PROXY).toBe("loopback");
  });
  it("names every bad variable", () => {
    expect(() => loadConfig({ PORT: "abc" })).toThrow(/DATABASE_URL[\s\S]*REDIS_URL|PORT/);
  });
});
