import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image.
  output: "standalone",
  // Pin tracing to this folder so a lockfile higher up can't change the bundle layout.
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
