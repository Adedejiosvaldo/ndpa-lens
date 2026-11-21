import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image.
  output: "standalone",
  // Pin tracing to this folder so a lockfile higher up can't change the bundle layout.
  outputFileTracingRoot: path.join(__dirname),
  // Playwright must load from node_modules at runtime, never bundled (it reads its own package.json).
  serverExternalPackages: ["playwright", "playwright-core"],
  // Workspace packages resolve outside node_modules, so Next would bundle the
  // scan engine (and Playwright with it). Keep it a runtime require on the server.
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(Array.isArray(config.externals) ? config.externals : [config.externals]), { "@ndpa/scan-engine": "commonjs @ndpa/scan-engine" }];
    }
    return config;
  },
};

export default nextConfig;
