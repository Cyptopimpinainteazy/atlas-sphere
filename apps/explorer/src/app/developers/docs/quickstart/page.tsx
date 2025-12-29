'use client';

import DocLayout, { CodeBlock, Callout } from '@/components/docs/DocLayout';
import Link from 'next/link';
import { Terminal, Code, CheckCircle } from 'lucide-react';

export default function QuickstartPage() {
  return (
    <DocLayout 
      title="Quick Start" 
      description="Get up and running with X3 Atlas Sphere in under 5 minutes"
      lastUpdated="December 2024"
    >
      <div className="space-y-8">
        {/* Prerequisites */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Prerequisites</h2>
          <p className="text-gray-400 mb-4">Before you begin, make sure you have:</p>
          <ul className="space-y-2">
            {[
              'Node.js 18+ installed',
              'A code editor (VS Code recommended)',
              'Basic knowledge of JavaScript/TypeScript',
              'MetaMask or Phantom wallet (optional)',
            ].map((item, i) => (
              <li key={i} className="flex items-center text-gray-400">
                <CheckCircle className="w-5 h-5 text-emerald-500 mr-2 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Step 1: Install SDK */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Step 1: Install the SDK</h2>
          <p className="text-gray-400 mb-4">
            Install the X3 Atlas Sphere SDK using npm or yarn:
          </p>
          <CodeBlock language="bash" title="Terminal">
{`# Using npm
npm install @x3/atlas-sdk @polkadot/api

# Using yarn
yarn add @x3/atlas-sdk @polkadot/api

# Using pnpm
pnpm add @x3/atlas-sdk @polkadot/api`}
          </CodeBlock>
        </section>

        {/* Step 2: Connect to Network */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Step 2: Connect to the Network</h2>
          <p className="text-gray-400 mb-4">
            Create a connection to the X3 Atlas Sphere testnet:
          </p>
          <CodeBlock language="typescript" title="connect.ts">
{`import { AtlasClient } from '@x3/atlas-sdk';

// Connect to testnet
const client = new AtlasClient({
  rpcUrl: 'https://rpc.testnet.atlas-sphere.io',
  wsUrl: 'wss://rpc.testnet.atlas-sphere.io',
});

// Check connection
const connected = await client.isConnected();
console.log('Connected:', connected);

// Get network info
const info = await client.getNetworkInfo();
console.log('Chain:', info.chain);
console.log('Block:', info.blockNumber);`}
          </CodeBlock>
        </section>

        {/* Step 3: Get Test Tokens */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Step 3: Get Test Tokens</h2>
          <p className="text-gray-400 mb-4">
            Visit our faucet to get testnet ATLAS tokens:
          </p>
          <div className="glass-card p-6 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white mb-1">Testnet Faucet</h3>
              <p className="text-sm text-gray-500">Get 100 ATLAS tokens for testing</p>
            </div>
            <Link 
              href="https://faucet.testnet.atlas-sphere.io" 
              className="btn-primary"
              target="_blank"
            >
              Get Tokens
            </Link>
          </div>
          
          <Callout type="info" title="Faucet Limits">
            The faucet provides 100 ATLAS per request with a 24-hour cooldown per address.
          </Callout>
        </section>

        {/* Step 4: Query the Chain */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Step 4: Query the Chain</h2>
          <p className="text-gray-400 mb-4">
            Query blockchain data using the SDK:
          </p>
          <CodeBlock language="typescript" title="query.ts">
{`// Get account balance
const balance = await client.getBalance('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
console.log('Balance:', balance.free.toString(), 'ATLAS');

// Get latest blocks
const blocks = await client.getRecentBlocks(10);
blocks.forEach(block => {
  console.log(\`Block #\${block.number}: \${block.hash}\`);
});

// Subscribe to new blocks
client.subscribeBlocks((block) => {
  console.log('New block:', block.number);
});`}
          </CodeBlock>
        </section>

        {/* Step 5: Send Transaction */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Step 5: Send a Transaction</h2>
          <p className="text-gray-400 mb-4">
            Send your first transaction on X3 Atlas Sphere:
          </p>
          <CodeBlock language="typescript" title="transfer.ts">
{`import { Keyring } from '@polkadot/keyring';

// Create a keyring for signing
const keyring = new Keyring({ type: 'sr25519' });
const alice = keyring.addFromUri('//Alice'); // Dev account

// Send a transfer
const tx = await client.transfer({
  to: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
  amount: '10000000000000', // 10 ATLAS (12 decimals)
});

// Sign and submit
const hash = await tx.signAndSend(alice);
console.log('Transaction hash:', hash.toHex());

// Wait for confirmation
const receipt = await client.waitForTransaction(hash);
console.log('Confirmed in block:', receipt.blockNumber);`}
          </CodeBlock>
          
          <Callout type="warning" title="Security Note">
            Never use development accounts (//Alice, //Bob) in production. Always use properly 
            generated and secured private keys for real transactions.
          </Callout>
        </section>

        {/* What's Next */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">What&apos;s Next?</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Link href="/developers/docs/dual-vm" className="glass-card-hover p-4 block card-lift">
              <Code className="w-6 h-6 text-orange-400 mb-2" />
              <h3 className="font-semibold text-white mb-1">Dual VM Guide</h3>
              <p className="text-xs text-gray-500">Deploy on EVM and SVM</p>
            </Link>
            <Link href="/developers/docs/comits" className="glass-card-hover p-4 block card-lift">
              <Terminal className="w-6 h-6 text-orange-400 mb-2" />
              <h3 className="font-semibold text-white mb-1">Comit Transactions</h3>
              <p className="text-xs text-gray-500">Cross-VM atomic operations</p>
            </Link>
            <Link href="/developers/cookbook" className="glass-card-hover p-4 block card-lift">
              <Code className="w-6 h-6 text-orange-400 mb-2" />
              <h3 className="font-semibold text-white mb-1">Cookbook</h3>
              <p className="text-xs text-gray-500">Example code snippets</p>
            </Link>
          </div>
        </section>
      </div>
    </DocLayout>
  );
}
