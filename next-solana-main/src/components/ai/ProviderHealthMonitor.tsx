'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import {
  CheckCircle,
  AlertCircle,
  WifiOff,
  Server,
  Clock,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Settings
} from 'lucide-react';

import { useLLMOrchestrator } from '../../hooks/useLLMOrchestrator';
import { LLMProviderType } from '../../../packages/agent-core/src/types';

export const ProviderHealthMonitor: React.FC = () => {
  const { providers, isLoadingProviders } = useLLMOrchestrator();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50 border-green-200';
      case 'degraded': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'unavailable': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'degraded': return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'unavailable': return <WifiOff className="h-5 w-5 text-red-600" />;
      default: return <Server className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (current < previous) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatUptime = (score: number) => {
    return `${Math.round(score * 100)}%`;
  };

  if (isLoadingProviders) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded w-5/6"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!providers || providers.size === 0) {
    return (
      <Alert>
        <Server className="h-4 w-4" />
        <AlertDescription>
          No LLM providers are currently configured. Please check your environment variables and provider settings.
        </AlertDescription>
      </Alert>
    );
  }

  const providerArray = Array.from(providers.entries());

  return (
    <div className="space-y-6">
      {/* Provider Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {providerArray.map(([providerType, health]) => (
          <Card key={providerType} className="relative overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(health.status)}
                  <div>
                    <CardTitle className="text-lg capitalize">{providerType}</CardTitle>
                    <CardDescription>
                      {health.status === 'healthy' ? 'Running normally' :
                       health.status === 'degraded' ? 'Performance issues' : 'Service unavailable'}
                    </CardDescription>
                  </div>
                </div>
                <Badge className={getStatusColor(health.status)}>
                  {health.status.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Response Time */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Response Time</span>
                  </div>
                  <span className="font-medium">{formatResponseTime(health.response_time)}</span>
                </div>
                <Progress
                  value={Math.min(100, (health.response_time / 1000) * 100)}
                  className="h-2"
                />
              </div>

              {/* Availability Score */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span>Uptime</span>
                  </div>
                  <span className="font-medium">{formatUptime(health.availability_score)}</span>
                </div>
                <Progress
                  value={health.availability_score * 100}
                  className="h-2"
                />
              </div>

              {/* Error Rate */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Error Rate</span>
                  <span className={`font-medium ${
                    health.error_rate > 0.1 ? 'text-red-600' :
                    health.error_rate > 0.05 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {(health.error_rate * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress
                  value={health.error_rate * 100}
                  className="h-2"
                />
              </div>

              {/* Request Stats */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">
                    {health.successful_requests}
                  </div>
                  <div className="text-xs text-muted-foreground">Successful</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600">
                    {health.total_requests - health.successful_requests}
                  </div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button variant="outline" size="sm" className="flex-1">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Test
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Health Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Health Summary</CardTitle>
          <CardDescription>
            Overall system health and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Status Distribution */}
            <div className="space-y-3">
              <h4 className="font-medium">Provider Status</h4>
              <div className="space-y-2">
                {['healthy', 'degraded', 'unavailable'].map(status => {
                  const count = providerArray.filter(([_, health]) => health.status === status).length;
                  const percentage = (count / providerArray.length) * 100;

                  return (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(status)}
                        <span className="capitalize">{status}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{count}</span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-current h-2 rounded-full"
                            style={{
                              width: `${percentage}%`,
                              color: status === 'healthy' ? '#10b981' :
                                     status === 'degraded' ? '#f59e0b' : '#ef4444'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="space-y-3">
              <h4 className="font-medium">Performance</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Avg Response</span>
                  <span className="font-medium">
                    {formatResponseTime(
                      providerArray.reduce((sum, [_, health]) => sum + health.average_response_time, 0) / providerArray.length
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Requests</span>
                  <span className="font-medium">
                    {providerArray.reduce((sum, [_, health]) => sum + health.total_requests, 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Success Rate</span>
                  <span className="font-medium">
                    {((providerArray.reduce((sum, [_, health]) => sum + health.successful_requests, 0) /
                       Math.max(1, providerArray.reduce((sum, [_, health]) => sum + health.total_requests, 0))) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="space-y-3">
              <h4 className="font-medium">Recommendations</h4>
              <div className="space-y-2">
                {providerArray.some(([_, health]) => health.status === 'unavailable') && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Some providers are unavailable. Check API keys and network connectivity.
                    </AlertDescription>
                  </Alert>
                )}

                {providerArray.some(([_, health]) => health.error_rate > 0.1) && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      High error rates detected. Consider reviewing provider configurations.
                    </AlertDescription>
                  </Alert>
                )}

                {providerArray.every(([_, health]) => health.status === 'healthy') && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">All providers healthy</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};