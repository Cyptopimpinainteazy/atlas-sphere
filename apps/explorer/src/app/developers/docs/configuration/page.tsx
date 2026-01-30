'use client';

import DocLayout, { CodeBlock, Callout } from '@/components/docs/DocLayout';

export default function ConfigurationPage() {
  return (
    <DocLayout 
      title="Configuration" 
      description="Configure your development environment for X3 Atlas Sphere"
      lastUpdated="December 2024"
    >
      <div className="space-y-8">
        {/* Network Configuration */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Network Endpoints</h2>
          <p className="text-gray-400 mb-4">
            X3 Atlas Sphere provides different network endpoints for various use cases:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1a1a1a]">
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Network</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">RPC URL</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Chain ID</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#111111]">
                  <td className="py-3 px-4 text-white">Testnet</td>
                  <td className="py-3 px-4 text-gray-400 font-mono text-sm">https://rpc.testnet.atlas-sphere.io</td>
                  <td className="py-3 px-4 text-gray-400">9933</td>
                </tr>
                <tr className="border-b border-[#111111]">
                  <td className="py-3 px-4 text-white">Testnet WS</td>
                  <td className="py-3 px-4 text-gray-400 font-mono text-sm">wss://rpc.testnet.atlas-sphere.io</td>
                  <td className="py-3 px-4 text-gray-400">9944</td>
                </tr>
                <tr className="border-b border-[#111111]">
                  <td className="py-3 px-4 text-white">Local Dev</td>
                  <td className="py-3 px-4 text-gray-400 font-mono text-sm">http://127.0.0.1:9933</td>
                  <td className="py-3 px-4 text-gray-400">9933</td>
                </tr>
                <tr className="border-b border-[#111111]">
                  <td className="py-3 px-4 text-white">Local Dev WS</td>
                  <td className="py-3 px-4 text-gray-400 font-mono text-sm">ws://127.0.0.1:9944</td>
                  <td className="py-3 px-4 text-gray-400">9944</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* SDK Configuration */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">SDK Configuration</h2>
          <p className="text-gray-400 mb-4">
            Configure the Atlas SDK with your preferred settings:
          </p>
          <CodeBlock language="typescript" title="config.ts">
{`import { AtlasClient, AtlasConfig } from '@x3/atlas-sdk';

const config: AtlasConfig = {
  // Network endpoints
  rpcUrl: process.env.ATLAS_RPC_URL || 'https://rpc.testnet.atlas-sphere.io',
  wsUrl: process.env.ATLAS_WS_URL || 'wss://rpc.testnet.atlas-sphere.io',
  
  // Connection options
  autoConnect: true,
  reconnect: true,
  reconnectDelay: 1000,
  maxReconnectAttempts: 10,
  
  // Request options
  timeout: 30000,
  retries: 3,
  
  // Logging
  debug: process.env.NODE_ENV === 'development',
};

export const client = new AtlasClient(config);`}
          </CodeBlock>
        </section>

        {/* Environment Variables */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Environment Variables</h2>
          <p className="text-gray-400 mb-4">
            Create a <code className="text-orange-400">.env</code> file in your project root:
          </p>
          <CodeBlock language="bash" title=".env">
{`# Network Configuration
ATLAS_RPC_URL=https://rpc.testnet.atlas-sphere.io
ATLAS_WS_URL=wss://rpc.testnet.atlas-sphere.io

# EVM Configuration (for Hardhat/ethers)
EVM_RPC_URL=https://evm.testnet.atlas-sphere.io
EVM_CHAIN_ID=42069

# Development Keys (NEVER use in production!)
DEV_SEED_PHRASE="bottom drive obey lake curtain smoke basket hold race lonely fit walk"
DEV_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# API Keys (optional)
ALCHEMY_API_KEY=your_alchemy_key
INFURA_API_KEY=your_infura_key`}
          </CodeBlock>

          <Callout type="danger" title="Security Warning">
            Never commit your <code>.env</code> file to version control. Add it to your 
            <code>.gitignore</code> immediately. Never use development seed phrases or 
            private keys for real assets.
          </Callout>
        </section>

        {/* Hardhat Configuration */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Hardhat Configuration</h2>
          <p className="text-gray-400 mb-4">
            Configure Hardhat to work with X3 Atlas Sphere EVM:
          </p>
          <CodeBlock language="typescript" title="hardhat.config.ts">
{`import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Local development
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    // X3 Atlas Testnet
    atlasTestnet: {
      url: process.env.EVM_RPC_URL || "https://evm.testnet.atlas-sphere.io",
      chainId: 42069,
      accounts: process.env.DEV_PRIVATE_KEY 
        ? [process.env.DEV_PRIVATE_KEY] 
        : [],
      gasPrice: 1000000000, // 1 gwei
    },
  },
  etherscan: {
    apiKey: {
      atlasTestnet: "not-needed", // X3scan doesn't require API key
    },
    customChains: [
      {
        network: "atlasTestnet",
        chainId: 42069,
        urls: {
          apiURL: "https://api.x3scan.io/api",
          browserURL: "https://x3scan.io",
        },
      },
    ],
  },
};

export default config;`}
          </CodeBlock>
        </section>

        {/* TypeScript Configuration */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">TypeScript Configuration</h2>
          <p className="text-gray-400 mb-4">
            Recommended <code className="text-orange-400">tsconfig.json</code> for X3 projects:
          </p>
          <CodeBlock language="json" title="tsconfig.json">
{`{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`}
          </CodeBlock>
        </section>

        {/* Wallet Configuration */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Wallet Configuration</h2>
          <p className="text-gray-400 mb-4">
            Configure MetaMask to connect to X3 Atlas Sphere:
          </p>
          <div className="glass-card p-6">
            <h3 className="font-semibold text-white mb-4">Add X3 Atlas Testnet to MetaMask</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-[#1a1a1a]">
                <span className="text-gray-500">Network Name</span>
                <span className="text-white font-mono">X3 Atlas Testnet</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1a1a1a]">
                <span className="text-gray-500">RPC URL</span>
                <span className="text-white font-mono">https://evm.testnet.atlas-sphere.io</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1a1a1a]">
                <span className="text-gray-500">Chain ID</span>
                <span className="text-white font-mono">42069</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1a1a1a]">
                <span className="text-gray-500">Currency Symbol</span>
                <span className="text-white font-mono">ATLAS</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Block Explorer</span>
                <span className="text-white font-mono">https://x3scan.io</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DocLayout>
  );
}
