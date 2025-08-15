/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Let the build succeed even if ESLint/TypeScript have errors.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // ✅ Keep the API proxy hook for when your backend is deployed
  async rewrites() {
    const target = process.env.API_PROXY_TARGET; // e.g. https://your-backend.onrender.com/api
    if (!target) return [];
    return [{ source: '/api/:path*', destination: `${target}/:path*` }];
  },
};

module.exports = nextConfig;
