// frontend/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // ✅ Ignore lint/type errors during production build on Vercel
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // DO NOT set `output: "export"` here (it would disable API routes)
};

export default nextConfig;
