"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, 
  Zap, 
  Cpu, 
  TrendingUp, 
  Activity, 
  Target,
  Network,
  Database,
  DollarSign,
  BarChart3,
  Settings,
  PlayCircle,
  PauseCircle,
  RefreshCw
} from 'lucide-react';

interface AISwarmNode {
  id: string;
  name: string;
  gpuType: string;
  status: 'active' | 'idle' | 'maintenance' | 'offline';
  utilization: number;
  currentTask: string;
  tasksCompleted: number;
  earnings: number;
  location: string;
  uptime: string;
}

interface AISwarmMetrics {
  totalNodes: number;
  activeNodes: number;
  totalUtilization: number;
  activeTasks: number;
  totalEarnings: number;
  avgPerformance: number;
  strategiesOptimized: number;
  arbitrageOpportunities: number;
}

interface Task {
  id: string;
  type: 'arbitrage' | 'strategy_optimization' | 'portfolio_rebalance' | 'mev_extraction';
  status: 'queued' | 'running' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
  estimatedCompletion: string;
  earnings: number;
}

export default function AISwarmMonitoring() {
  const [metrics, setMetrics] = useState<AISwarmMetrics>({
    totalNodes: 0,
    activeNodes: 0,
    totalUtilization: 0,
    activeTasks: 0,
    totalEarnings: 0,
    avgPerformance: 0,
    strategiesOptimized: 0,
    arbitrageOpportunities: 0
  });

  const [nodes, setNodes] = useState<AISwarmNode[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'nodes' | 'tasks' | 'analytics'>('overview');

  useEffect(() => {
    const fetchAISwarmData = async () => {
      setIsLoading(true);
      
      // Mock AI Swarm data
      const mockNodes: AISwarmNode[] = [
        {
          id: '1',
          name: 'GPU-Node-Alpha-01',
          gpuType: 'NVIDIA RTX 4090',
          status: 'active',
          utilization: 87,
          currentTask: 'Arbitrage Detection - ETH/USDC',
          tasksCompleted: 1247,
          earnings: 2.45,
          location: 'US-East-1',
          uptime: '99.8%'
        },
        {
          id: '2',
          name: 'GPU-Node-Beta-02',
          gpuType: 'NVIDIA RTX 4080',
          status: 'active',
          utilization: 92,
          currentTask: 'Strategy Optimization - LP Positions',
          tasksCompleted: 891,
          earnings: 1.89,
          location: 'EU-West-1',
          uptime: '99.9%'
        },
        {
          id: '3',
          name: 'GPU-Node-Gamma-03',
          gpuType: 'NVIDIA RTX 4070',
          status: 'idle',
          utilization: 0,
          currentTask: 'Standby',
          tasksCompleted: 634,
          earnings: 0.78,
          location: 'Asia-Pacific-1',
          uptime: '99.7%'
        },
        {
          id: '4',
          name: 'GPU-Node-Delta-04',
          gpuType: 'NVIDIA RTX 4090',
          status: 'maintenance',
          utilization: 0,
          currentTask: 'System Update',
          tasksCompleted: 1103,
          earnings: 2.12,
          location: 'US-West-2',
          uptime: '99.6%'
        }
      ];

      const mockTasks: Task[] = [
        {
          id: '1',
          type: 'arbitrage',
          status: 'running',
          priority: 'urgent',
          progress: 67,
          estimatedCompletion: '2.3 min',
          earnings: 0.12
        },
        {
          id: '2',
          type: 'strategy_optimization',
          status: 'running',
          priority: 'high',
          progress: 34,
          estimatedCompletion: '5.7 min',
          earnings: 0.08
        },
        {
          id: '3',
          type: 'portfolio_rebalance',
          status: 'queued',
          priority: 'medium',
          progress: 0,
          estimatedCompletion: '12.4 min',
          earnings: 0.05
        },
        {
          id: '4',
          type: 'mev_extraction',
          status: 'completed',
          priority: 'high',
          progress: 100,
          estimatedCompletion: 'Completed',
          earnings: 0.23
        }
      ];

      const totalUtilization = mockNodes.reduce((sum, node) => sum + node.utilization, 0) / mockNodes.length;
      const totalEarnings = mockNodes.reduce((sum, node) => sum + node.earnings, 0);
      const activeNodes = mockNodes.filter(node => node.status === 'active').length;

      setMetrics({
        totalNodes: mockNodes.length,
        activeNodes,
        totalUtilization,
        activeTasks: mockTasks.filter(task => task.status === 'running').length,
        totalEarnings,
        avgPerformance: 94.2,
        strategiesOptimized: 847,
        arbitrageOpportunities: 156
      });

      setNodes(mockNodes);
      setTasks(mockTasks);
      setIsLoading(false);
    };

    fetchAISwarmData();
    const interval = setInterval(fetchAISwarmData, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-400/20';
      case 'idle': return 'text-yellow-400 bg-yellow-400/20';
      case 'maintenance': return 'text-orange-400 bg-orange-400/20';
      case 'offline': return 'text-red-400 bg-red-400/20';
      default: return 'text-gray-400 bg-gray-400/20';
    }
  };

  const getTaskTypeColor = (type: string) => {
    switch (type) {
      case 'arbitrage': return 'text-blue-400 bg-blue-400/20';
      case 'strategy_optimization': return 'text-purple-400 bg-purple-400/20';
      case 'portfolio_rebalance': return 'text-green-400 bg-green-400/20';
      case 'mev_extraction': return 'text-red-400 bg-red-400/20';
      default: return 'text-gray-400 bg-gray-400/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-green-400';
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
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-300 bg-clip-text text-transparent">
                AI Swarm Intelligence
              </h1>
              <p className="text-slate-400 mt-2">
                Distributed GPU-powered DeFi optimization across 103+ chains
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-2 px-4 rounded-lg transition-all transform hover:scale-105 flex items-center space-x-2">
                <PlayCircle className="h-5 w-5" />
                <span>Start Swarm</span>
              </button>
              <button className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Configure</span>
              </button>
            </div>
          </motion.div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 mt-6 bg-slate-800/50 p-1 rounded-lg w-fit">
            {[
              { id: 'overview', label: 'Overview', icon: Brain },
              { id: 'nodes', label: 'GPU Nodes', icon: Cpu },
              { id: 'tasks', label: 'Active Tasks', icon: Activity },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSelectedTab(id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                  selectedTab === id 
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
        {selectedTab === 'overview' && (
          <>
            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Active Nodes</p>
                    <p className="text-2xl font-bold text-white">{metrics.activeNodes}/{metrics.totalNodes}</p>
                  </div>
                  <Cpu className="h-8 w-8 text-purple-400" />
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Avg Utilization</p>
                    <p className="text-2xl font-bold text-green-400">{metrics.totalUtilization.toFixed(1)}%</p>
                  </div>
                  <Activity className="h-8 w-8 text-green-400" />
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Active Tasks</p>
                    <p className="text-2xl font-bold text-blue-400">{metrics.activeTasks}</p>
                  </div>
                  <Zap className="h-8 w-8 text-blue-400" />
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Total Earnings</p>
                    <p className="text-2xl font-bold text-yellow-400">${metrics.totalEarnings.toFixed(2)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-yellow-400" />
                </div>
              </motion.div>
            </div>

            {/* Performance Chart Placeholder */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-8"
            >
              <h2 className="text-xl font-semibold text-white mb-4">Real-time Performance</h2>
              <div className="h-64 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 text-purple-400 mx-auto mb-2" />
                  <p className="text-slate-400">AI Performance Analytics</p>
                  <p className="text-sm text-slate-500">Real-time GPU utilization and strategy optimization metrics</p>
                </div>
              </div>
            </motion.div>

            {/* Recent Activity */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Recent Arbitrage Opportunities</h3>
                <div className="space-y-3">
                  {[
                    { pair: 'ETH/USDC', profit: '0.12%', chain: 'Ethereum → Arbitrum', time: '2 min ago' },
                    { pair: 'USDT/USDC', profit: '0.08%', chain: 'Polygon → BSC', time: '5 min ago' },
                    { pair: 'AVAX/ETH', profit: '0.15%', chain: 'Avalanche → Ethereum', time: '8 min ago' }
                  ].map((opp, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                      <div>
                        <p className="text-white font-medium">{opp.pair}</p>
                        <p className="text-slate-400 text-sm">{opp.chain}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 font-medium">{opp.profit}</p>
                        <p className="text-slate-500 text-sm">{opp.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Strategy Performance</h3>
                <div className="space-y-3">
                  {[
                    { strategy: 'LP Optimization', performance: '+12.4%', confidence: '94%' },
                    { strategy: 'Yield Farming', performance: '+8.7%', confidence: '89%' },
                    { strategy: 'MEV Extraction', performance: '+15.2%', confidence: '96%' }
                  ].map((strat, index) => (
                    <div key={index} className="flex items-center justify-between p
