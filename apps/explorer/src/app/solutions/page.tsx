'use client';

import React from 'react';
import Link from 'next/link';
import {
  Boxes,
  Coins,
  Zap,
  Wallet,
  Shield,
  Gamepad2,
  CreditCard,
  Building2,
  BarChart3,
  Bot,
  Map,
  Smartphone,
  FlaskConical,
  Briefcase,
  Music,
  Globe,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { HexagonCluster } from '../../components/ui/Logo';

const toolsCategories = [
  {
    title: 'Developer Tools',
    description: 'Build, test, and deploy applications on X3 STAR',
    icon: <Boxes className="w-8 h-8" />,
    href: '/solutions/tools',
    color: 'from-orange-500 to-amber-500',
  },
  {
    title: 'Token Extensions',
    description: 'Advanced token features and programmable assets',
    icon: <Coins className="w-8 h-8" />,
    href: '/solutions/token-extensions',
    color: 'from-purple-500 to-indigo-500',
  },
  {
    title: 'Actions & Blinks',
    description: 'Blockchain links and shareable actions',
    icon: <Zap className="w-8 h-8" />,
    href: '/solutions/actions',
    color: 'from-cyan-500 to-blue-500',
  },
  {
    title: 'Wallets',
    description: 'Secure wallet solutions for users and developers',
    icon: <Wallet className="w-8 h-8" />,
    href: '/solutions/wallets',
    color: 'from-emerald-500 to-green-500',
  },
  {
    title: 'Permissioned Environments',
    description: 'Enterprise-grade private blockchain solutions',
    icon: <Shield className="w-8 h-8" />,
    href: '/solutions/permissioned',
    color: 'from-red-500 to-rose-500',
  },
  {
    title: 'Games Tooling',
    description: 'Everything you need to build blockchain games',
    icon: <Gamepad2 className="w-8 h-8" />,
    href: '/solutions/games',
    color: 'from-pink-500 to-fuchsia-500',
  },
  {
    title: 'Payments Tooling',
    description: 'Accept and send payments globally',
    icon: <CreditCard className="w-8 h-8" />,
    href: '/solutions/payments',
    color: 'from-green-500 to-emerald-500',
  },
  {
    title: 'Commerce Tooling',
    description: 'E-commerce integrations and NFT commerce',
    icon: <Building2 className="w-8 h-8" />,
    href: '/solutions/commerce',
    color: 'from-amber-500 to-yellow-500',
  },
];

const useCases = [
  {
    title: 'Tokenization',
    description: 'Tokenize any asset with programmable compliance',
    icon: <Coins className="w-6 h-6" />,
    href: '/solutions/tokenization',
  },
  {
    title: 'DePIN',
    description: 'Decentralized physical infrastructure networks',
    icon: <Globe className="w-6 h-6" />,
    href: '/solutions/depin',
  },
  {
    title: 'BTCFi',
    description: 'Bitcoin DeFi primitives and bridges',
    icon: <BarChart3 className="w-6 h-6" />,
    href: '/solutions/btcfi',
  },
  {
    title: 'Institutional Payments',
    description: 'Enterprise payment rails and settlement',
    icon: <Building2 className="w-6 h-6" />,
    href: '/solutions/institutional',
  },
  {
    title: 'Stablecoins',
    description: 'Stable asset issuance and management',
    icon: <Coins className="w-6 h-6" />,
    href: '/solutions/stablecoins',
  },
  {
    title: 'DeFi',
    description: 'Decentralized finance protocols and tools',
    icon: <BarChart3 className="w-6 h-6" />,
    href: '/solutions/defi',
  },
  {
    title: 'Consumer Apps',
    description: 'User-friendly blockchain applications',
    icon: <Smartphone className="w-6 h-6" />,
    href: '/solutions/consumer',
  },
  {
    title: 'AI & ML',
    description: 'AI-powered blockchain applications',
    icon: <Bot className="w-6 h-6" />,
    href: '/solutions/ai',
  },
  {
    title: 'DeSci',
    description: 'Decentralized science and research',
    icon: <FlaskConical className="w-6 h-6" />,
    href: '/solutions/desci',
  },
  {
    title: 'Enterprise',
    description: 'Enterprise blockchain solutions',
    icon: <Briefcase className="w-6 h-6" />,
    href: '/solutions/enterprise',
  },
  {
    title: 'Gaming & Entertainment',
    description: 'Games, metaverse, and entertainment',
    icon: <Gamepad2 className="w-6 h-6" />,
    href: '/solutions/gaming',
  },
  {
    title: 'Artists & Creators',
    description: 'NFTs, royalties, and creator tools',
    icon: <Music className="w-6 h-6" />,
    href: '/solutions/creators',
  },
];

const resources = [
  {
    title: 'Solutions Hub',
    description: 'Explore all X3 STAR solutions and integrations',
    href: '/solutions/hub',
  },
  {
    title: 'Partner Directory',
    description: 'Find verified X3 STAR ecosystem partners',
    href: '/solutions/partners',
  },
  {
    title: 'Case Studies',
    description: 'Real-world success stories and implementations',
    href: '/solutions/case-studies',
  },
];

export default function SolutionsPage() {
  return (
    <div className="min-h-screen pt-20">
      {/* Hero */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 mesh-gradient opacity-30" />
        <div className="absolute right-0 top-1/4 w-96 h-96 opacity-30">
          <HexagonCluster className="w-full h-full" />
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="badge badge-purple mb-4">Solutions</div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Build Without Limits
            </h1>
            <p className="text-xl text-gray-400 mb-8">
              Comprehensive tools and solutions for every use case. From DeFi to gaming, 
              from enterprise to consumer apps—X3 STAR has you covered.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/developers/docs" className="btn-primary">
                Start Building
              </Link>
              <Link href="/solutions/hub" className="btn-secondary">
                Explore Solutions Hub
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Tools */}
      <section className="py-16 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white mb-8">Tools & Infrastructure</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {toolsCategories.map((tool, index) => (
              <Link
                key={index}
                href={tool.href}
                className="glass-card-hover p-6 card-lift group"
              >
                <div className={`p-3 rounded-xl bg-gradient-to-br ${tool.color} bg-opacity-20 w-fit mb-4`}>
                  <span className="text-white">{tool.icon}</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-orange-400 transition-colors">
                  {tool.title}
                </h3>
                <p className="text-sm text-gray-400">{tool.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white mb-8">Use Cases</h2>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {useCases.map((useCase, index) => (
              <Link
                key={index}
                href={useCase.href}
                className="flex items-center p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-500/30 transition-all group"
              >
                <div className="p-2 rounded-lg bg-orange-500/20 text-orange-400 mr-3">
                  {useCase.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-white group-hover:text-orange-400 transition-colors">
                    {useCase.title}
                  </h3>
                  <p className="text-xs text-gray-500">{useCase.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-orange-400 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Real World Assets */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="badge badge-success mb-4">Real World Assets</div>
              <h2 className="text-3xl font-bold text-white mb-4">
                Bridge Physical and Digital
              </h2>
              <p className="text-gray-400 mb-6">
                Tokenize real estate, commodities, art, and more. X3 STAR's dual VM 
                architecture enables compliant RWA tokenization with programmable 
                transfer restrictions and cross-chain liquidity.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  'Compliant token transfers with on-chain rules',
                  'Cross-VM liquidity for tokenized assets',
                  'Integration with traditional finance rails',
                  'Institutional-grade custody solutions',
                ].map((item, i) => (
                  <li key={i} className="flex items-center text-gray-300">
                    <Map className="w-5 h-5 text-emerald-500 mr-3" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/solutions/rwa" className="btn-primary">
                Explore RWA Solutions
              </Link>
            </div>
            <div className="glass-card p-8">
              <h3 className="font-semibold text-white mb-4">Supported Asset Classes</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { name: 'Real Estate', icon: '🏢' },
                  { name: 'Commodities', icon: '⚡' },
                  { name: 'Art & Collectibles', icon: '🎨' },
                  { name: 'Securities', icon: '📈' },
                  { name: 'Carbon Credits', icon: '🌱' },
                  { name: 'Intellectual Property', icon: '💡' },
                ].map((asset) => (
                  <div key={asset.name} className="p-4 rounded-xl bg-white/5 flex items-center">
                    <span className="text-2xl mr-3">{asset.icon}</span>
                    <span className="text-sm text-gray-300">{asset.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile */}
      <section className="py-16 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="glass-card p-8">
                <div className="flex items-center justify-center space-x-4">
                  <div className="w-48 h-96 rounded-3xl bg-slate-800 border-4 border-slate-700 p-2">
                    <div className="w-full h-full rounded-2xl bg-gradient-to-br from-orange-500/20 to-purple-500/20 flex items-center justify-center">
                      <span className="text-6xl">📱</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="badge badge-info mb-4">Mobile</div>
              <h2 className="text-3xl font-bold text-white mb-4">
                Mobile-First Blockchain
              </h2>
              <p className="text-gray-400 mb-6">
                Build mobile apps that leverage blockchain without complexity. 
                X3 STAR's mobile SDKs make it easy to integrate wallet functionality, 
                NFTs, and payments into any mobile application.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/solutions/mobile" className="btn-primary">
                  Mobile SDK
                </Link>
                <Link href="/developers/cookbook" className="btn-secondary">
                  View Examples
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white mb-8">Resources</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {resources.map((resource, index) => (
              <Link
                key={index}
                href={resource.href}
                className="glass-card-hover p-6 card-lift group"
              >
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-orange-400 transition-colors">
                  {resource.title}
                </h3>
                <p className="text-sm text-gray-400 mb-4">{resource.description}</p>
                <span className="text-orange-400 flex items-center text-sm">
                  Learn more <ArrowRight className="ml-2 w-4 h-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 border-t border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to build your solution?
          </h2>
          <p className="text-gray-400 mb-8">
            Connect with our solutions team to discuss your project requirements.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/contact" className="btn-primary">
              Contact Sales
            </Link>
            <Link href="/developers/docs" className="btn-secondary">
              Read Documentation
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
