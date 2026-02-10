/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Image optimization
  images: {
    domains: ["assets.atlas-sphere.io"],
    formats: ["image/avif", "image/webp"],
  },

  // Environment variables exposed to browser
  env: {
    NEXT_PUBLIC_CHAIN_RPC:
      process.env.NEXT_PUBLIC_CHAIN_RPC || "ws://localhost:9944",
    NEXT_PUBLIC_EVM_RPC:
      process.env.NEXT_PUBLIC_EVM_RPC || "http://localhost:8545",
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID || "42",
  },
  webpack: (config) => {
    // Ensure imports from transpiled monorepo packages resolve to the app's node_modules
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      clsx: require.resolve('clsx'),
      'framer-motion': require.resolve('framer-motion'),
      'lucide-react': require.resolve('lucide-react'),
    };
    return config;
  },
};

module.exports = nextConfig;
