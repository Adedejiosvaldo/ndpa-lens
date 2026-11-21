import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end: the real API and web app against throwaway Postgres, Redis and
 * Mailpit containers (started in e2e/global-setup.ts). Needs Docker and a
 * built API and web app (`pnpm turbo build`).
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 800 },
  },
});
