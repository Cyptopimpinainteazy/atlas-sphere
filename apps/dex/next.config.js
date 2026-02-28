/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure local monorepo packages are transpiled so their imports
  // (e.g., clsx, framer-motion) are resolved correctly by Next.js.
  transpilePackages: ['@x3-chain/shared', '@x3-chain/ts-sdk'],

  // Image optimization
  images: {
    domains: ["assets.x3-chain.io"],
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
};

module.exports = nextConfig;
