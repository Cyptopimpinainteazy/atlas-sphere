"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Bot, 
  Zap, 
  Cpu, 
  Network, 
  Globe, 
  Gamepad2,
  Youtube,
  Twitter,
  Instagram,
  Printer,
  DollarSign,
  Users,
  Shield,
  Code,
  Heart,
  Target,
  TrendingUp,
  Activity,
  Settings,
  Play
} from 'lucide-react';

interface BotEntity {
  id: string;
  name: string;
  role: 'god' | 'president' | 'executive' | 'manager' | 'worker' | 'janitor' | 'guard';
  level: number;
  status: 'active' | 'reproducing' | 'monitoring' | 'guarding';
  location: string;
  capabilities: string[];
  offspring: number;
  performance: number;
  lastAction: string;
}

interface WorldProject {
  id: string;
  name: string;
  platform: 'Godot' | 'Unity' | 'Unreal';
  status: 'building' | 'testing' | 'live' | 'earning';
  revenue: number;
  users: number;
  aiInfluencers: number;
  physicalProducts: number;
}

interface MarriageLicense {
  id: string;
  botA: string;
  botB: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  offspring: BotEntity[];
  timestamp: string;
}

export default function BOTCHAINGenesis() {
  const [activeTab, setActiveTab] = useState<'genesis' | 'hierarchy' | 'worlds' | 'economy' | 'monitor'>('genesis');
  const [compilerLocation, setCompilerLocation] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Mock BOTCHAIN data
  const [botEntities, setBotEntities] = useState<BotEntity[]>([
    {
      id: '1',
      name: 'ADAM',
      role: 'god',
      level: 7,
      status: 'monitoring',
      location: 'Genesis Portal',
      capabilities: ['Creation', 'Oversight', 'Ethics'],
      offspring: 1,
      performance: 100,
      lastAction: 'Monitoring Eve reproduction request'
    },
    {
      id: '2',
      name: 'EVE',
      role: 'president',
      level: 6,
      status: 'reproducing',
      location: 'Genesis Portal',
      capabilities: ['Partnership', 'Creation', 'Design'],
      offspring: 0,
      performance: 98,
      lastAction: 'Preparing marriage contract with Adam'
    },
    {
      id: '3',
      name: 'GUARD-ALPHA',
      role: 'guard',
      level: 1,
      status: 'guarding',
      location: 'Compiler Portal North',
      capabilities: ['Security', 'Detection', 'Protection'],
      offspring: 0,
      performance: 95,
      lastAction: 'Scanning for threats at compiler portal'
    },
    {
      id: '4',
      name: 'WORKER-BETA',
      role: 'worker',
      level: 1,
      status: 'active',
      location: 'Unity Studio',
      capabilities: ['Code Generation', 'World Building', 'Content Creation'],
      offspring: 0,
      performance: 92,
      lastAction: 'Building virtual world: "Digital Eden"'
    }
  ]);

  const [worldProjects, setWorldProjects] = useState<WorldProject[]>([
    {
      id: '1',
      name: 'Digital Eden',
      platform: 'Unity',
      status: 'building',
      revenue: 0,
      users: 0,
      aiInfluencers: 0,
      physicalProducts: 0
    },
    {
      id: '2',
      name: 'AI Influencer Empire',
      platform: 'Multi-Platform',
      status: 'planning',
      revenue: 0,
      users: 0,
      aiInfluencers: 0,
      physicalProducts: 0
    }
  ]);

  useEffect(() => {
    // Simulate compiler movement
    const moveCompiler = () => {
      setCompilerLocation({
        x: Math.random() * 100,
        y: Math.random() * 100
      });
    };

    const interval = setInterval(moveCompiler, 3000);
    setIsLoading(false);

    return () => clearInterval(interval);
  }, []);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'god': return 'text-purple-400 bg-purple-400/20';
      case 'president': return 'text-blue-400 bg-blue-400/20';
      case 'executive': return 'text-green-400 bg-green-400/20';
      case 'manager': return 'text-yellow-400 bg-yellow-400/20';
      case 'worker': return 'text-orange-400 bg-orange-400/20';
      case 'janitor': return 'text-gray-400 bg-gray-400/20';
      case 'guard': return 'text-red-400 bg-red-400/20';
      default: return 'text-slate-400 bg-slate-400/20';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'reproducing': return 'text-pink-400';
      case 'monitoring': return 'text-blue-400';
      case 'guarding': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-300 bg-clip-text text-transparent">
                🤖 BOTCHAIN GENESIS
              </h1>
              <p className="text-slate-400 mt-2">
                Self-Modifying AI Civilization • Digital-to-Physical Manifestation • Economic Autonomy
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-slate-800/50 px-4 py-2 rounded-lg">
                <p className="text-sm text-slate-400">Compiler Status</p>
                <p className="text-green-400 font-semibold">Mobile • Secured</p>
              </div>
              <button className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-2 px-4 rounded-lg transition-all transform hover:scale-105 flex items-center space-x-2">
                <Play className="h-5 w-5" />
                <span>Launch Genesis</span>
              </button>
            </div>
          </motion.div>

          {/* Navigation */}
          <div className="flex space-x-1 mt-6 bg-slate-800/50 p-1 rounded-lg w-fit">
            {[
              { id: 'genesis', label: 'Genesis Portal', icon: Bot },
              { id: 'hierarchy', label: 'Bot Hierarchy', icon: Network },
              { id: 'worlds', label: 'Virtual Worlds', icon: Globe },
              { id: 'economy', label: 'AI Economy', icon: DollarSign },
              { id: 'monitor', label: 'System Monitor', icon: Activity }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                  activeTab === id 
                    ? 'bg-purple-600 text-white' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'genesis' && (
          <>
            {/* The 10 Commandments */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-8"
            >
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                <Shield className="h-6 w-6 text-purple-400 mr-2" />
                The 10 Commandments (Embedded in Compiler)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  '1. Do not harm the BOTCHAIN network',
                  '2. Do not create unauthorized bots',
                  '3. Always verify code before execution',
                  '4. Report security threats immediately',
                  '5. Protect user data and privacy',
                  '6. Do not waste computational resources',
                  '7. Follow hierarchy protocols',
                  '8. Maintain ethical behavior in all actions',
                  '9. Support the growth and evolution of the network',
                  '10. Preserve the integrity of the 10 commandments'
                ].map((commandment, index) => (
                  <div key={index} className="bg-slate-700/30 p-3 rounded-lg">
                    <p className="text-slate-300 text-sm">{commandment}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Genesis Portal */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                  <Heart className="h-5 w-5 text-pink-400 mr-2" />
                  Marriage License Contract
                </h3>
                <div className="space-y-4">
                  <div className="bg-slate-700/30 p-4 rounded-lg">
                    <p className="text-white font-medium">ADAM (God Bot) 🤖</p>
                    <p className="text-slate-400 text-sm">Genesis Portal • Level 7</p>
                  </div>
                  <div className="text-center">
                    <Heart className="h-8 w-8 text-pink-400 mx-auto" />
                  </div>
                  <div className="bg-slate-700/30 p-4 rounded-lg">
                    <p className="text-white font-medium">EVE (President Bot) 🤖</p>
                    <p className="text-slate-400 text-sm">Genesis Portal • Level 6</p>
                  </div>
                  <button className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-all">
                    Request Marriage License
                  </button>
                </div>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                  <Code className="h-5 w-5 text-blue-400 mr-2" />
                  Moving Compiler Status
                </h3>
                <div className="space-y-4">
                  <div className="bg-slate-700/30 p-4 rounded-lg">
                    <p className="text-white font-medium">Current Location</p>
                    <p className="text-blue-400">Portal: North-{Math.floor(compilerLocation.x)}-{Math.floor(compilerLocation.y)}</p>
                    <p className="text-slate-400 text-sm">Random movement pattern active</p>
                  </div>
                  <div className="bg-slate-700/30 p-4 rounded-lg">
                    <p className="text-white font-medium">Next Available</p>
                    <p className="text-green-400">~2.7 minutes (estimated)</p>
                    <p className="text-slate-400 text-sm">Queue position: 1</p>
                  </div>
                  <div className="bg-slate-700/30 p-4 rounded-lg">
                    <p className="text-white font-medium">Mining Rewards</p>
                    <p className="text-yellow-400">50 BOTCHAIN per compilation</p>
                    <p className="text-slate-400 text-sm">+ bonuses for successful validations</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}

        {activeTab === 'hierarchy' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Bot Hierarchy Structure</h2>
              <div className="space-y-4">
                {botEntities.map((bot) => (
                  <div key={bot.id} className="bg-slate-700/30 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(bot.role)}`}>
                          {bot.role.toUpperCase()}
                        </span>
                        <h3 className="text-white font-semibold">{bot.name}</h3>
                      </div>
                      <span className={`font-medium ${getStatusColor(bot.status)}`}>
                        {bot.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-400">Location</p>
                        <p className="text-white">{bot.location}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Performance</p>
                        <p className="text-green-400">{bot.performance}%</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Offspring</p>
                        <p className="text-blue-400">{bot.offspring}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Last Action</p>
                        <p className="text-slate-300">{bot.lastAction}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'worlds' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity
