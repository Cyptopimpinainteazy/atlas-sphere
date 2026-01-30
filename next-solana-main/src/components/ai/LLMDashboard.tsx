'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Brain,
  Settings,
  BarChart3,
  RefreshCw,
  Server,
  Wifi,
  WifiOff
} from 'lucide-react';

import { useLLMOrchestrator } from '../../hooks/useLLMOrchestrator';
import { ProviderHealthMonitor } from './ProviderHealthMonitor';
import { TaskRoutingConfig } from './TaskRoutingConfig';
import { LLMAnalytics } from './LLMAnalytics';

interface LLMDashboardProps {
  className?: string;
}

export const LLMDashboard: React.FC<LLMDashboardProps> = ({ className }) => {
  const {
    providers,
    metrics,
    systemStatus,
    isInitialized,
    config
  } = useLLMOrchestrator();

  const [activeTab, setActiveTab] = useState('overview');

  if (!isInitialized) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <h3 className="text-lg font-semibold mb-2">Initializing LLM Service</h3>
          <p className="text-muted-foreground">Setting up providers and configurations...</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'unavailable': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />;
      case 'degraded': return <AlertCircle className="h-4 w-4" />;
      case 'unavailable': return <WifiOff className="h-4 w-4" />;
      default: return <Server className="h-4 w-4" />;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">LLM Orchestrator</h1>
          <p className="text-muted-foreground">
            Monitor and manage your free LLM providers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={systemStatus?.cache_enabled ? "default" : "secondary"}>
            {systemStatus?.cache_enabled ? "Cache: ON" : "Cache: OFF"}
          </Badge>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Providers</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStatus?.total_providers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {systemStatus?.healthy_providers || 0} healthy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStatus?.success_rate.toFixed(1) || 0}%</div>
            <Progress value={systemStatus?.success_rate || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStatus?.total_requests.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              All time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.average_response_time.toFixed(0) || 0}ms</div>
            <p className="text-xs text-muted-foreground">
              Average latency
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Provider Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Provider Status</CardTitle>
          <CardDescription>
            Real-time status of all configured LLM providers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!providers ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from(providers.entries()).map(([providerType, health]) => (
                <div key={providerType} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(health.status)}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(health.status)}
                      <span className="font-medium capitalize">{providerType}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {health.response_time}ms • {health.availability_score * 100}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="routing">Routing</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Cache Hit Rate</span>
                    <span>{metrics?.cache_hit_rate.toFixed(1) || 0}%</span>
                  </div>
                  <Progress value={metrics?.cache_hit_rate || 0} />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>System Load</span>
                    <span>{Math.min(100, (metrics?.total_requests || 0) / 1000 * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.min(100, (metrics?.total_requests || 0) / 1000 * 100)} />
                </div>

                <div className="pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-600">
                        {metrics?.successful_requests || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Successful</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">
                        {metrics?.failed_requests || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Failed</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics?.provider_usage && Array.from(metrics.provider_usage.entries()).map(([provider, usage]) => (
                    <div key={provider} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor('healthy')}`} />
                        <span className="capitalize">{provider}</span>
                      </div>
                      <span className="text-sm font-medium">{usage} requests</span>
                    </div>
                  ))}

                  {!metrics?.provider_usage && (
                    <div className="text-center text-muted-foreground py-8">
                      No recent activity
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="providers">
          <ProviderHealthMonitor />
        </TabsContent>

        <TabsContent value="routing">
          <TaskRoutingConfig />
        </TabsContent>

        <TabsContent value="analytics">
          <LLMAnalytics />
        </TabsContent>
      </Tabs>

      {/* Alerts */}
      {systemStatus && systemStatus.healthy_providers === 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No healthy LLM providers are currently available. Please check your configuration and API keys.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};