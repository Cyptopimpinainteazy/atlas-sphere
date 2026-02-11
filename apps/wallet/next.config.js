/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@atlas-sphere/shared', '@atlas-sphere/ts-sdk'],

  images: {
    domains: ["assets.atlas-sphere.io"],
    formats: ["image/avif", "image/webp"],
  },

  env: {
    NEXT_PUBLIC_CHAIN_RPC: process.env.NEXT_PUBLIC_CHAIN_RPC || "ws://localhost:9944",
    NEXT_PUBLIC_EVM_RPC: process.env.NEXT_PUBLIC_EVM_RPC || "http://localhost:8545",
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID || "42",
    NEXT_PUBLIC_POLKADEX_API: process.env.NEXT_PUBLIC_POLKADEX_API || "https://api.polkadex.trade",
  },
};

module.exports = nextConfig;
