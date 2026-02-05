'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Clock,
  DollarSign,
  Target,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

import { useLLMOrchestrator } from '../../hooks/useLLMOrchestrator';
import { LLMProviderType } from '../../../packages/agent-core/src/types';

const COLORS = {
  deepseek: '#3b82f6',
  groq: '#10b981',
  ollama: '#8b5cf6',
  huggingface: '#f59e0b'
};

const TIME_RANGES = [
  { value: '1h', label: 'Last Hour' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' }
];

export const LLMAnalytics: React.FC = () => {
  const { metrics, providers } = useLLMOrchestrator();
  const [timeRange, setTimeRange] = useState('24h');
  const [activeTab, setActiveTab] = useState('overview');

  // Mock data for demonstration - in real app, this would come from the API
  const generateMockData = () => {
    if (!providers) return { usage: [], performance: [], cost: [], errors: [] };

    const providerTypes = Array.from(providers.keys());

    const usage = providerTypes.map(provider => ({
      provider: provider.charAt(0).toUpperCase() + provider.slice(1),
      requests: Math.floor(Math.random() * 1000) + 100,
      success: Math.floor(Math.random() * 800) + 200,
      color: COLORS[provider as keyof typeof COLORS]
    }));

    const performance = providerTypes.map(provider => ({
      provider: provider.charAt(0).toUpperCase() + provider.slice(1),
      avgResponseTime: Math.floor(Math.random() * 500) + 100,
      p95ResponseTime: Math.floor(Math.random() * 800) + 200,
      throughput: Math.floor(Math.random() * 100) + 20,
      color: COLORS[provider as keyof typeof COLORS]
    }));

    const cost = providerTypes.map(provider => ({
      provider: provider.charAt(0).toUpperCase() + provider.slice(1),
      cost: Math.random() * 50,
      tokens: Math.floor(Math.random() * 10000) + 1000,
      color: COLORS[provider as keyof typeof COLORS]
    }));

    const errors = providerTypes.map(provider => ({
      provider: provider.charAt(0).toUpperCase() + provider.slice(1),
      errors: Math.floor(Math.random() * 20),
      errorRate: Math.random() * 0.05,
      color: COLORS[provider as keyof typeof COLORS]
    }));

    return { usage, performance, cost, errors };
  };

  const { usage, performance, cost, errors } = generateMockData();

  const totalRequests = usage.reduce((sum, item) => sum + item.requests, 0);
  const totalCost = cost.reduce((sum, item) => sum + item.cost, 0);
  const avgResponseTime = performance.reduce((sum, item) => sum + item.avgResponseTime, 0) / performance.length;
  const totalErrors = errors.reduce((sum, item) => sum + item.errors, 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value}{entry.name.includes('Time') ? 'ms' : entry.name.includes('Rate') ? '%' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">LLM Analytics</h2>
          <p className="text-muted-foreground">
            Performance metrics and usage analytics
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGES.map((range) => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests.toLocaleString()}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
              +12.5% from last period
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingDown className="h-3 w-3 mr-1 text-green-600" />
              -5.2% from last period
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgResponseTime.toFixed(0)}ms</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingDown className="h-3 w-3 mr-1 text-green-600" />
              -8.1% from last period
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Count</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalErrors}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingDown className="h-3 w-3 mr-1 text-green-600" />
              -15.3% from last period
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="cost">Cost Analysis</TabsTrigger>
          <TabsTrigger value="errors">Error Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Usage Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Request Distribution
                </CardTitle>
                <CardDescription>Requests by provider</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={usage}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ provider, requests }) => `${provider}: ${requests}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="requests"
                    >
                      {usage.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Performance Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Overview</CardTitle>
                <CardDescription>Response times and throughput</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={performance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="provider" />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="avgResponseTime" fill="#8884d8" name="Avg Response Time (ms)" />
                    <Bar dataKey="throughput" fill="#82ca9d" name="Throughput (req/min)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Response Time Trends</CardTitle>
              <CardDescription>Average and P95 response times over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={performance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="provider" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avgResponseTime"
                    stroke="#8884d8"
                    strokeWidth={2}
                    name="Average Response Time"
                  />
                  <Line
                    type="monotone"
                    dataKey="p95ResponseTime"
                    stroke="#82ca9d"
                    strokeWidth={2}
                    name="P95 Response Time"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Cost by Provider</CardTitle>
                <CardDescription>API costs across different providers</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={cost}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="provider" />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="cost" fill="#8884d8" name="Cost ($)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Token Usage</CardTitle>
                <CardDescription>Total tokens processed by provider</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={cost}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ provider, tokens }) => `${provider}: ${tokens.toLocaleString()}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="tokens"
                    >
                      {cost.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error Analysis</CardTitle>
              <CardDescription>Error rates and distribution by provider</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={errors}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="provider" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="errors" fill="#ef4444" name="Error Count" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Provider Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Provider Comparison</CardTitle>
          <CardDescription>Detailed comparison of all providers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Provider</th>
                  <th className="text-right p-2">Requests</th>
                  <th className="text-right p-2">Success Rate</th>
                  <th className="text-right p-2">Avg Response</th>
                  <th className="text-right p-2">Cost</th>
                  <th className="text-right p-2">Errors</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((item, index) => {
                  const perf = performance[index];
                  const costItem = cost[index];
                  const errorItem = errors[index];

                  return (
                    <tr key={item.provider} className="border-b">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          {item.provider}
                        </div>
                      </td>
                      <td className="text-right p-2">{item.requests.toLocaleString()}</td>
                      <td className="text-right p-2">
                        {((item.success / item.requests) * 100).toFixed(1)}%
                      </td>
                      <td className="text-right p-2">{perf?.avgResponseTime}ms</td>
                      <td className="text-right p-2">${costItem?.cost.toFixed(2)}</td>
                      <td className="text-right p-2">{errorItem?.errors}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};