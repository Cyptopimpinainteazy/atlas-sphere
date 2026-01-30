'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';
import {
  ArrowRight,
  Settings,
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Brain,
  Zap,
  MessageSquare,
  BarChart3,
  Code,
  Shield,
  TrendingUp
} from 'lucide-react';

import { useLLMOrchestrator } from '../../hooks/useLLMOrchestrator';
import { TaskType, LLMProviderType } from '../../../packages/agent-core/src/types';

const TASK_TYPE_INFO = {
  [TaskType.TECHNICAL_ANALYSIS]: {
    icon: <BarChart3 className="h-4 w-4" />,
    label: 'Technical Analysis',
    description: 'Deep market analysis and trading insights',
    recommended: ['deepseek', 'groq']
  },
  [TaskType.TRADING_DECISION]: {
    icon: <TrendingUp className="h-4 w-4" />,
    label: 'Trading Decision',
    description: 'Real-time trading recommendations',
    recommended: ['groq', 'deepseek']
  },
  [TaskType.SENTIMENT_ANALYSIS]: {
    icon: <MessageSquare className="h-4 w-4" />,
    label: 'Sentiment Analysis',
    description: 'Text sentiment and emotion detection',
    recommended: ['huggingface', 'groq']
  },
  [TaskType.CONTENT_GENERATION]: {
    icon: <Brain className="h-4 w-4" />,
    label: 'Content Generation',
    description: 'Creative content and copywriting',
    recommended: ['groq', 'deepseek']
  },
  [TaskType.MARKET_ANALYSIS]: {
    icon: <BarChart3 className="h-4 w-4" />,
    label: 'Market Analysis',
    description: 'Market data analysis and trends',
    recommended: ['groq', 'deepseek']
  },
  [TaskType.CODE_GENERATION]: {
    icon: <Code className="h-4 w-4" />,
    label: 'Code Generation',
    description: 'Programming code and scripts',
    recommended: ['deepseek', 'groq']
  },
  [TaskType.PRIVACY_SENSITIVE]: {
    icon: <Shield className="h-4 w-4" />,
    label: 'Privacy Sensitive',
    description: 'Local processing for sensitive data',
    recommended: ['ollama', 'deepseek']
  }
};

const PROVIDER_INFO = {
  deepseek: { label: 'DeepSeek', color: 'bg-blue-500' },
  groq: { label: 'Groq', color: 'bg-green-500' },
  ollama: { label: 'Ollama', color: 'bg-purple-500' },
  huggingface: { label: 'HuggingFace', color: 'bg-orange-500' }
};

export const TaskRoutingConfig: React.FC = () => {
  const { config, updateConfig, providers } = useLLMOrchestrator();
  const [routingRules, setRoutingRules] = useState<Map<TaskType, LLMProviderType[]>>(
    config?.routing.primary_providers || new Map()
  );
  const [loadBalancing, setLoadBalancing] = useState(
    config?.routing.load_balancing || 'weighted_response_time'
  );
  const [hasChanges, setHasChanges] = useState(false);

  const handleProviderChange = (taskType: TaskType, newProviders: LLMProviderType[]) => {
    const updatedRules = new Map(routingRules);
    updatedRules.set(taskType, newProviders);
    setRoutingRules(updatedRules);
    setHasChanges(true);
  };

  const handleLoadBalancingChange = (value: string) => {
    setLoadBalancing(value as 'round_robin' | 'least_connections' | 'weighted_response_time');
    setHasChanges(true);
  };

  const saveChanges = async () => {
    if (!config) return;

    try {
      await updateConfig({
        routing: {
          ...config.routing,
          primary_providers: routingRules,
          load_balancing: loadBalancing
        }
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to update routing configuration:', error);
    }
  };

  const resetToDefaults = () => {
    if (!config) return;

    const defaultRules = new Map([
      [TaskType.TECHNICAL_ANALYSIS, ['deepseek', 'groq']],
      [TaskType.TRADING_DECISION, ['groq', 'deepseek']],
      [TaskType.SENTIMENT_ANALYSIS, ['huggingface', 'groq']],
      [TaskType.CONTENT_GENERATION, ['groq', 'deepseek']],
      [TaskType.MARKET_ANALYSIS, ['groq', 'deepseek']],
      [TaskType.CODE_GENERATION, ['deepseek', 'groq']],
      [TaskType.PRIVACY_SENSITIVE, ['ollama', 'deepseek']]
    ]);

    setRoutingRules(defaultRules);
    setLoadBalancing('weighted_response_time');
    setHasChanges(true);
  };

  const getAvailableProviders = () => {
    if (!providers) return [];
    return Array.from(providers.entries())
      .filter(([_, health]) => health.status === 'healthy')
      .map(([providerType, _]) => providerType);
  };

  const availableProviders = getAvailableProviders();

  return (
    <div className="space-y-6">
      {/* Configuration Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Task Routing Configuration</h2>
          <p className="text-muted-foreground">
            Configure how different tasks are routed to LLM providers
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="secondary">Unsaved Changes</Badge>
          )}
          <Button variant="outline" onClick={resetToDefaults}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={saveChanges} disabled={!hasChanges}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Load Balancing Strategy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Load Balancing Strategy
          </CardTitle>
          <CardDescription>
            Choose how to distribute requests across providers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  value: 'round_robin',
                  label: 'Round Robin',
                  description: 'Cycle through providers equally'
                },
                {
                  value: 'least_connections',
                  label: 'Least Connections',
                  description: 'Route to provider with fewest active requests'
                },
                {
                  value: 'weighted_response_time',
                  label: 'Weighted Response Time',
                  description: 'Prefer providers with faster response times'
                }
              ].map((strategy) => (
                <div
                  key={strategy.value}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    loadBalancing === strategy.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => handleLoadBalancingChange(strategy.value)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="radio"
                      checked={loadBalancing === strategy.value}
                      onChange={() => handleLoadBalancingChange(strategy.value)}
                      className="text-primary"
                    />
                    <Label className="font-medium">{strategy.label}</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">{strategy.description}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task Routing Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(TASK_TYPE_INFO).map(([taskType, info]) => (
          <Card key={taskType}>
            <CardHeader>
              <div className="flex items-center gap-3">
                {info.icon}
                <div className="flex-1">
                  <CardTitle className="text-lg">{info.label}</CardTitle>
                  <CardDescription>{info.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Routing */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Provider Priority</Label>
                <div className="space-y-2">
                  {routingRules.get(taskType as TaskType)?.map((provider, index) => (
                    <div key={provider} className="flex items-center gap-2">
                      <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                        {index + 1}
                      </Badge>
                      <div className={`w-3 h-3 rounded-full ${PROVIDER_INFO[provider]?.color}`} />
                      <span className="flex-1">{PROVIDER_INFO[provider]?.label}</span>
                      {providers?.get(provider)?.status === 'healthy' ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Provider Selection */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Configure Priority</Label>
                <div className="space-y-2">
                  {[0, 1, 2].map((priorityIndex) => (
                    <div key={priorityIndex} className="flex items-center gap-2">
                      <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                        {priorityIndex + 1}
                      </Badge>
                      <Select
                        value={routingRules.get(taskType as TaskType)?.[priorityIndex] || ''}
                        onValueChange={(value) => {
                          const currentProviders = routingRules.get(taskType as TaskType) || [];
                          const newProviders = [...currentProviders];
                          newProviders[priorityIndex] = value as LLMProviderType;
                          handleProviderChange(taskType as TaskType, newProviders.filter(Boolean));
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableProviders.map((provider) => (
                            <SelectItem key={provider} value={provider}>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${PROVIDER_INFO[provider]?.color}`} />
                                {PROVIDER_INFO[provider]?.label}
                                {providers?.get(provider)?.status !== 'healthy' && (
                                  <Badge variant="destructive" className="text-xs">Offline</Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Providers */}
              <div className="pt-4 border-t">
                <Label className="text-sm font-medium mb-2 block">Recommended</Label>
                <div className="flex flex-wrap gap-1">
                  {info.recommended.map((provider) => (
                    <Badge key={provider} variant="secondary" className="text-xs">
                      {PROVIDER_INFO[provider]?.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Routing Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Routing Statistics</CardTitle>
          <CardDescription>
            Overview of current routing configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {Object.keys(TASK_TYPE_INFO).length}
              </div>
              <div className="text-sm text-muted-foreground">Task Types</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {availableProviders.length}
              </div>
              <div className="text-sm text-muted-foreground">Available Providers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {routingRules.size}
              </div>
              <div className="text-sm text-muted-foreground">Configured Routes</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {availableProviders.length === 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No healthy providers are currently available. Please check your provider configurations and API keys.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};