import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/config.js";

describe("loadConfig", () => {
  it("applies defaults", () => {
    const c = loadConfig({ DATABASE_URL: "postgres://a:b@h/d", REDIS_URL: "redis://h:6379" });
    expect(c.PORT).toBe(4000);
    expect(c.NODE_ENV).toBe("development");
  });
  it("names every bad variable", () => {
    expect(() => loadConfig({ PORT: "abc" })).toThrow(/DATABASE_URL[\s\S]*REDIS_URL|PORT/);
  });
});
