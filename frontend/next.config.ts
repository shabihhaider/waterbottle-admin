// frontend/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // DO NOT set `output: "export"` — it disables API routes on Vercel.
  // Leaving output undefined keeps the Node runtime available for /api/*.
};

export default nextConfig;
