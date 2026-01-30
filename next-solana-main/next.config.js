/**
 * Next.js configuration to proxy API routes to the local agent-api server.
 * This adds a rewrite so client code calling /api/influencers is forwarded to the agent-api
 * running on AGENT_API_PORT (default 3001).
 */

const API_PORT = process.env.AGENT_API_PORT || 3001;

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/influencers/:path*',
        destination: `http://localhost:${API_PORT}/influencers/:path*`
      },
      {
        source: '/api/influencers',
        destination: `http://localhost:${API_PORT}/influencers`
      }
    ];
  }
};

export default nextConfig;
