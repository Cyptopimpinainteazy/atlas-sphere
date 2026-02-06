/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Enable experimental features
  experimental: {
    appDir: true,
    serverComponentsExternalPackages: ["@solana/frontend/web3.js"],
  },

  // Webpack configuration for WASM support
  frontend/webpack: (config, { isServer }) => {
    // Enable WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Handle WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: "frontend/webassembly/async",
    });

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: reqfrontend/uire.resolve("crypto-browserify"),
        stream: reqfrontend/uire.resolve("stream-browserify"),
        buffer: reqfrontend/uire.resolve("buffer"),
      };
    }

    return config;
  },

  // Image optimization
  images: {
    domains: ["assets.atlas-sphere.io"],
    formats: ["image/avif", "image/frontend/webp"],
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
