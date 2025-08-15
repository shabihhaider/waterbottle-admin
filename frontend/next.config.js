/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // When you deploy the backend, set API_PROXY_TARGET in Vercel to e.g.
    // https://your-backend.onrender.com/api
    const target = process.env.API_PROXY_TARGET;
    if (!target) return [];
    return [
      { source: '/api/:path*', destination: `${target}/:path*` },
    ];
  },
};

module.exports = nextConfig;
