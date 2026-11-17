import path from "node:path";
import type { NextConfig } from "next";

const remotePatterns: NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
> = [
  {
    protocol: "https",
    hostname: "images.unsplash.com",
  },
  {
    protocol: "https",
    hostname: "cdn.pixabay.com",
  },
  {
    protocol: "https",
    hostname: "pub-cd48f39d564544edbef113f433562d43.r2.dev",
    pathname: "/**",
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Emit a self-contained server bundle only for container builds; local builds
  // skip it because tracing the pnpm store creates symlinks Windows dev
  // machines reject. outputFileTracingRoot points at the monorepo root so the
  // workspace dependency layout is traced into the standalone bundle.
  output: process.env.NEXT_STANDALONE === "1" ? "standalone" : undefined,
  outputFileTracingRoot: path.join(__dirname, "../../"),
  images: {
    remotePatterns,
    qualities: [60, 75],
    minimumCacheTTL: 3600,
  },
  allowedDevOrigins: ["remarks-girls-remix-valley.trycloudflare.com"],
};

export default nextConfig;
