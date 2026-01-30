'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Zap,
  Shield,
  Layers,
  Globe,
  Code,
  Cpu,
  Database,
  Lock,
  Rocket,
  Users,
  BarChart3,
  ChevronRight,
  Play,
  CheckCircle,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';

// Hero stats
const heroStats = [
  { label: 'Block Time', value: '6s', suffix: '' },
  { label: 'TPS Capacity', value: '50,000+', suffix: '' },
  { label: 'Validators', value: '100+', suffix: '' },
  { label: 'Total Value Locked', value: '$1.2B', suffix: '' },
];

// Core features
const coreFeatures = [
  {
    icon: <Layers className="w-8 h-8" />,
    title: 'Dual VM Execution',
    description: 'Run EVM (Ethereum) and SVM (Solana) smart contracts side-by-side with deterministic ordering. Deploy your Solidity or Rust programs without changes.',
    badge: 'Revolutionary',
  },
  {
    icon: <Zap className="w-8 h-8" />,
    title: 'Atomic Cross-VM Operations',
    description: 'Execute transactions that span both VMs atomically. No bridges, no wrapped tokens, no fragmented liquidity. True composability.',
    badge: 'Unique',
  },
  {
    icon: <Shield className="w-8 h-8" />,
    title: 'Native Asset Layer',
    description: 'Assets exist once in the canonical ledger and are accessible from both VMs. Unified liquidity pools, seamless transfers.',
    badge: 'Secure',
  },
  {
    icon: <Globe className="w-8 h-8" />,
    title: 'Cross-Chain Composability',
    description: 'Built-in message lanes enable atomic transactions spanning multiple blockchains. True interoperability without trusted intermediaries.',
    badge: 'Scalable',
  },
];

// Use cases
const useCases = [
  {
    title: 'DeFi 2.0',
    description: 'Build DEXs that aggregate liquidity from EVM and SVM protocols in a single transaction.',
    icon: <BarChart3 className="w-6 h-6" />,
    href: '/solutions/defi',
  },
  {
    title: 'Gaming & NFTs',
    description: 'Create games with Solana-speed gameplay and Ethereum-compatible NFT marketplaces.',
    icon: <Sparkles className="w-6 h-6" />,
    href: '/solutions/games',
  },
  {
    title: 'Enterprise',
    description: 'Deploy permissioned environments with cross-chain capabilities for institutional use.',
    icon: <Lock className="w-6 h-6" />,
    href: '/solutions/enterprise',
  },
  {
    title: 'AI & ML',
    description: 'Build AI-powered dApps with on-chain ML inference and cross-VM data pipelines.',
    icon: <Cpu className="w-6 h-6" />,
    href: '/solutions/ai',
  },
];

// Ecosystem partners
const partners = [
  'Chainlink', 'The Graph', 'Alchemy', 'QuickNode', 'Tenderly', 'Phantom', 'MetaMask', 'Ledger'
];

// Latest updates
const updates = [
  {
    date: 'Dec 2024',
    title: 'Testnet v1 Launch',
    description: 'Public testnet now live with 3+ validators and faucet service.',
    type: 'release',
  },
  {
    date: 'Nov 2024',
    title: 'Atlas Kernel MVP',
    description: 'Core Comit submission and canonical ledger primitives implemented.',
    type: 'milestone',
  },
  {
    date: 'Oct 2024',
    title: 'Security Audit Complete',
    description: 'Third-party audit of Atlas Kernel pallet completed successfully.',
    type: 'security',
  },
];

export default function HomePage() {
  return (
    <div className="relative bg-black">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0 mesh-gradient" />
        <div className="absolute inset-0 grid-pattern opacity-30" />
        
        {/* Animated orbs - Orange/Red */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-600/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-600/15 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/30 mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-2" />
              <span className="text-sm text-orange-300">Testnet v1 Now Live</span>
              <ArrowRight className="w-4 h-4 ml-2 text-orange-400" />
            </div>

            {/* Main heading */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight">
              <span className="text-white">The First</span>
              <br />
              <span className="gradient-text">Dual VM Blockchain</span>
            </h1>

            {/* Subheading */}
            <p className="text-xl md:text-2xl text-gray-500 max-w-3xl mx-auto mb-12">
              X3 Atlas Sphere unites EVM and SVM execution in a single Layer-1.
              Build cross-chain applications with atomic transactions, unified liquidity,
              and unprecedented composability.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link href="/developers/docs" className="btn-primary flex items-center text-lg px-8 py-4">
                Start Building
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <Link href="/learn/getting-started" className="btn-secondary flex items-center text-lg px-8 py-4">
                <Play className="mr-2 w-5 h-5" />
                Watch Demo
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {heroStats.map((stat) => (
                <div key={stat.label} className="stat-card">
                  <div className="text-3xl md:text-4xl font-bold gradient-text mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="w-6 h-10 rounded-full border-2 border-[#333333] flex items-start justify-center p-2">
            <div className="w-1 h-3 rounded-full bg-orange-500/60 animate-bounce" />
          </div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0a0a0a] to-black" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                <span className="text-white">The blockchain </span>
                <span className="gradient-text">trilemma is solved</span>
              </h2>
              <p className="text-lg text-gray-500 mb-8">
                Traditional blockchains force you to choose between ecosystems. 
                X3 Atlas Sphere eliminates this friction by enabling native 
                interoperability between the two largest smart contract platforms.
              </p>
              <ul className="space-y-4">
                {[
                  'Deploy Solidity contracts alongside Solana programs',
                  'Atomic transactions spanning both VMs',
                  'Unified liquidity without wrapping tokens',
                  'Single account abstraction for all assets',
                ].map((item, i) => (
                  <li key={i} className="flex items-start space-x-3">
                    <CheckCircle className="w-6 h-6 text-orange-500 flex-shrink-0" />
                    <span className="text-gray-400">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="glass-card p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                      <Code className="w-5 h-5 text-orange-400" />
                    </div>
                    <span className="font-semibold text-white">Comit Transaction</span>
                  </div>
                  <span className="badge badge-success">Atomic</span>
                </div>
                <div className="code-block text-xs">
                  <pre className="text-gray-400">
{`// Single atomic transaction
{
  "comit_id": "0x1234...",
  "evm_payload": {
    "contract": "0xUniswap...",
    "method": "swap",
    "params": ["ETH", "USDC", 1000]
  },
  "svm_payload": {
    "program": "JupiterAgg...",
    "instruction": "route",
    "accounts": ["SOL", "USDC"]
  },
  "prepare_root": "0xabc..."
}`}
                  </pre>
                </div>
                <div className="mt-4 flex items-center text-sm text-gray-500">
                  <Zap className="w-4 h-4 mr-2 text-orange-500" />
                  Both operations execute atomically or both revert
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Section */}
      <section className="py-24 relative bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="section-title gradient-text">Next-Level Features</h2>
            <p className="section-subtitle mx-auto">
              Purpose-built for the multi-chain future with revolutionary capabilities
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {coreFeatures.map((feature, index) => (
              <div
                key={index}
                className="card-feature card-lift group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 text-orange-400 group-hover:from-orange-500/30 group-hover:to-red-500/30 transition-colors">
                    {feature.icon}
                  </div>
                  <span className="badge badge-fire">{feature.badge}</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-500">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Diagram Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#080505] to-black" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="section-title text-white">How It Works</h2>
            <p className="section-subtitle mx-auto">
              The Atlas Kernel orchestrates dual VM execution with deterministic ordering
            </p>
          </div>

          <div className="glass-card p-8 md:p-12">
            <div className="grid md:grid-cols-3 gap-8">
              {/* EVM Side */}
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 mx-auto mb-4 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <span className="text-2xl font-bold text-white">EVM</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Ethereum VM</h3>
                <p className="text-sm text-gray-500">
                  Frontier-based execution for Solidity, Vyper, and all EVM-compatible contracts
                </p>
                <div className="mt-4 space-y-2">
                  <div className="badge badge-info">Solidity</div>
                  <div className="badge badge-info">Vyper</div>
                  <div className="badge badge-info">ERC-20/721</div>
                </div>
              </div>

              {/* Atlas Kernel */}
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 mx-auto mb-4 flex items-center justify-center shadow-lg shadow-orange-500/25 animate-glow">
                  <Cpu className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Atlas Kernel</h3>
                <p className="text-sm text-gray-500">
                  Orchestrates cross-VM operations with canonical ledger and atomic execution
                </p>
                <div className="mt-4 space-y-2">
                  <div className="badge badge-fire">Comits</div>
                  <div className="badge badge-fire">Canonical Ledger</div>
                  <div className="badge badge-fire">Atomic Exec</div>
                </div>
              </div>

              {/* SVM Side */}
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mx-auto mb-4 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <span className="text-2xl font-bold text-white">SVM</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Solana VM</h3>
                <p className="text-sm text-gray-500">
                  Sealevel execution for Rust programs with parallel transaction processing
                </p>
                <div className="mt-4 space-y-2">
                  <div className="badge badge-success">Anchor</div>
                  <div className="badge badge-success">Rust</div>
                  <div className="badge badge-success">SPL Tokens</div>
                </div>
              </div>
            </div>

            {/* Connection lines visualization */}
            <div className="hidden md:flex justify-center items-center my-8">
              <div className="flex items-center space-x-4">
                <div className="h-0.5 w-24 bg-gradient-to-r from-blue-500 to-orange-500" />
                <div className="blockchain-node" />
                <div className="h-0.5 w-12 bg-orange-500" />
                <div className="blockchain-node" style={{ animationDelay: '0.5s' }} />
                <div className="h-0.5 w-12 bg-orange-500" />
                <div className="blockchain-node" style={{ animationDelay: '1s' }} />
                <div className="h-0.5 w-24 bg-gradient-to-r from-orange-500 to-emerald-500" />
              </div>
            </div>

            <div className="text-center mt-8">
              <Link href="/learn/architecture" className="inline-flex items-center text-orange-400 hover:text-orange-300 font-medium">
                Learn more about the architecture
                <ArrowUpRight className="ml-1 w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-24 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="section-title text-white">Build Anything</h2>
            <p className="section-subtitle mx-auto">
              From DeFi to gaming, X3 Atlas Sphere powers the next generation of decentralized applications
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {useCases.map((useCase, index) => (
              <Link
                key={index}
                href={useCase.href}
                className="glass-card-hover p-6 card-lift group"
              >
                <div className="p-3 rounded-xl bg-[#1a1a1a] w-fit mb-4 group-hover:bg-orange-500/20 transition-colors">
                  <span className="text-gray-500 group-hover:text-orange-400 transition-colors">
                    {useCase.icon}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{useCase.title}</h3>
                <p className="text-sm text-gray-500 mb-4">{useCase.description}</p>
                <span className="inline-flex items-center text-sm text-orange-400 group-hover:text-orange-300">
                  Learn more <ChevronRight className="ml-1 w-4 h-4" />
                </span>
              </Link>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/solutions" className="btn-secondary">
              View All Solutions
            </Link>
          </div>
        </div>
      </section>

      {/* Developer Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0a0a0a] to-black" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="badge badge-info mb-4">For Developers</span>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
                Ship faster with familiar tools
              </h2>
              <p className="text-lg text-gray-500 mb-8">
                Use your existing Ethereum or Solana development workflow. 
                X3 Atlas Sphere provides full compatibility with both ecosystems' 
                tooling and SDKs.
              </p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                {[
                  { label: 'Hardhat', desc: 'EVM Development' },
                  { label: 'Anchor', desc: 'SVM Development' },
                  { label: 'ethers.js', desc: 'Web3 Integration' },
                  { label: 'Solana Web3', desc: 'Program Calls' },
                ].map((tool, i) => (
                  <div key={i} className="p-4 rounded-xl bg-[#111111] border border-[#1a1a1a]">
                    <div className="font-semibold text-white">{tool.label}</div>
                    <div className="text-sm text-gray-500">{tool.desc}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-4">
                <Link href="/developers/docs" className="btn-primary">
                  Read Documentation
                </Link>
                <Link href="/developers/cookbook" className="btn-secondary">
                  View Cookbook
                </Link>
              </div>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                </div>
                <span className="text-xs text-gray-600">quickstart.ts</span>
              </div>
              <div className="code-block text-sm">
                <pre className="text-gray-400">
{`import { AtlasClient, Comit } from '@x3/atlas-sdk';

// Connect to X3 Atlas Sphere
const client = new AtlasClient({
  rpcUrl: 'https://rpc.testnet.atlas-sphere.io',
});

// Create a cross-VM Comit transaction
const comit = new Comit({
  evmPayload: {
    to: '0x1234...',
    data: uniswapRouter.swap(...),
  },
  svmPayload: {
    programId: 'Jupiter...',
    instruction: Buffer.from([...]),
  },
});

// Submit atomically
const receipt = await client.submitComit(comit);
console.log('Comit finalized:', receipt.hash);`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Updates Section */}
      <section className="py-24 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
            <div>
              <h2 className="section-title text-white">Latest Updates</h2>
              <p className="section-subtitle">
                Stay up to date with X3 Atlas Sphere development
              </p>
            </div>
            <Link href="/blog" className="mt-4 md:mt-0 text-orange-400 hover:text-orange-300 flex items-center">
              View all updates <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {updates.map((update, index) => (
              <div key={index} className="glass-card-hover p-6 card-lift">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-600">{update.date}</span>
                  <span className={`badge ${
                    update.type === 'release' ? 'badge-success' :
                    update.type === 'milestone' ? 'badge-fire' :
                    'badge-warning'
                  }`}>
                    {update.type}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{update.title}</h3>
                <p className="text-sm text-gray-500">{update.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0a0505] to-black" />
        <div className="absolute inset-0 mesh-gradient opacity-30" />
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="text-white">Ready to build the </span>
            <span className="gradient-text">future of Web3?</span>
          </h2>
          <p className="text-xl text-gray-500 mb-12">
            Join thousands of developers building on X3 Atlas Sphere. 
            Get started with our testnet today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/developers/docs" className="btn-primary text-lg px-8 py-4">
              Read Documentation
            </Link>
            <Link href="https://faucet.testnet.atlas-sphere.io" className="btn-secondary text-lg px-8 py-4">
              Get Testnet Tokens
            </Link>
          </div>

          {/* Trust badges */}
          <div className="mt-16 pt-12 border-t border-[#1a1a1a]">
            <p className="text-sm text-gray-600 mb-6">Trusted by leading Web3 projects</p>
            <div className="flex flex-wrap justify-center items-center gap-8 opacity-40">
              {partners.map((partner) => (
                <span key={partner} className="text-lg font-semibold text-gray-500">
                  {partner}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}