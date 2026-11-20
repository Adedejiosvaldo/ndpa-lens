import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// SWC so Nest's decorator metadata (constructor injection) works in tests.
export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Integration tests share Testcontainers; run files one at a time.
    fileParallelism: false,
  },
});
