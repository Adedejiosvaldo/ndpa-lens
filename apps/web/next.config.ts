import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev and production builds must not share an output folder: a running
  // `next dev` rewrites .next and breaks a production build being tested.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@ndpa/schema"],
};

export default nextConfig;
