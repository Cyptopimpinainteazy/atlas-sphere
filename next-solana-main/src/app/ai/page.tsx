'use client';

import React from 'react';
import { LLMDashboard } from '../../components/ai/LLMDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import {
  Brain,
  Zap,
  Shield,
  BarChart3,
  Settings,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';

import { useLLMOrchestrator } from '../../hooks/useLLMOrchestrator';

export default function AIPage() {
  const { isInitialized, systemStatus, providers } = useLLMOrchestrator();

  const quickActions = [
    {
      title: 'Generate Content',
      description: 'Create AI-powered content',
      icon: <Brain className="h-5 w-5" />,
      action: () => console.log('Generate content'),
      disabled: !isInitialized
    },
    {
      title: 'Analyze Sentiment',
      description: 'Process text for sentiment',
      icon: <BarChart3 className="h-5 w-5" />,
      action: () => console.log('Analyze sentiment'),
      disabled: !isInitialized
    },
    {
      title: 'Configure Routing',
      description: 'Manage task routing rules',
      icon: <Settings className="h-5 w-5" />,
      action: () => console.log('Configure routing'),
      disabled: false
    },
    {
      title: 'View Analytics',
      description: 'Performance metrics',
      icon: <BarChart3 className="h-5 w-5" />,
      action: () => console.log('View analytics'),
      disabled: !isInitialized
    }
  ];

  const providerFeatures = [
    {
      name: 'DeepSeek',
      description: 'Technical analysis & code generation',
      status: providers?.get('deepseek')?.status || 'unavailable',
      color: 'bg-blue-500'
    },
    {
      name: 'Groq',
      description: 'Fast trading decisions & real-time analysis',
      status: providers?.get('groq')?.status || 'unavailable',
      color: 'bg-green-500'
    },
    {
      name: 'HuggingFace',
      description: 'Sentiment analysis & NLP tasks',
      status: providers?.get('huggingface')?.status || 'unavailable',
      color: 'bg-orange-500'
    },
    {
      name: 'Ollama',
      description: 'Privacy-sensitive local processing',
      status: providers?.get('ollama')?.status || 'unavailable',
      color: 'bg-purple-500'
    }
  ];

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="p-3 bg-primary/10 rounded-full">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-bold">AI Management Center</h1>
            <p className="text-xl text-muted-foreground">
              Free LLM Orchestration System
            </p>
          </div>
        </div>

        {/* System Status Banner */}
        <div className="flex items-center justify-center gap-4">
          <Badge
            variant={isInitialized ? "default" : "secondary"}
            className="px-4 py-2"
          >
            {isInitialized ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                System Active
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 mr-2" />
                Initializing...
              </>
            )}
          </Badge>

          {systemStatus && (
            <>
              <Badge variant="outline" className="px-4 py-2">
                {systemStatus.healthy_providers}/{systemStatus.total_providers} Providers
              </Badge>
              <Badge variant="outline" className="px-4 py-2">
                {systemStatus.success_rate.toFixed(1)}% Success Rate
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks and operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2"
                onClick={action.action}
                disabled={action.disabled}
              >
                {action.icon}
                <div className="text-center">
                  <div className="font-medium">{action.title}</div>
                  <div className="text-xs text-muted-foreground">{action.description}</div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Provider Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Provider Overview
          </CardTitle>
          <CardDescription>
            Status and capabilities of all configured LLM providers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {providerFeatures.map((provider) => (
              <div
                key={provider.name}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${provider.color}`} />
                  <div>
                    <div className="font-medium">{provider.name}</div>
                    <div className="text-sm text-muted-foreground">{provider.description}</div>
                  </div>
                </div>
                <Badge
                  variant={provider.status === 'healthy' ? 'default' : 'secondary'}
                  className={provider.status === 'healthy' ? 'bg-green-600' : ''}
                >
                  {provider.status === 'healthy' ? 'Online' : 'Offline'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Key Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-600" />
              Cost Effective
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              All providers offer free tiers. Intelligent caching and routing minimize API costs while maintaining performance.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" />
              High Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Optimized routing ensures tasks go to the best provider. Circuit breakers and health monitoring maintain reliability.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-purple-600" />
              Fully Configurable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Customize routing rules, load balancing strategies, and provider priorities to match your specific needs.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard */}
      <LLMDashboard />

      {/* Getting Started Guide */}
      {!isInitialized && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Getting Started
            </CardTitle>
            <CardDescription>
              Steps to set up your free LLM orchestration system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div>
                  <div className="font-medium">Configure API Keys</div>
                  <div className="text-sm text-muted-foreground">
                    Add your free API keys to the environment configuration
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <div>
                  <div className="font-medium">Install Ollama (Optional)</div>
                  <div className="text-sm text-muted-foreground">
                    For local processing without API costs or internet dependency
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                  3
                </div>
                <div>
                  <div className="font-medium">Customize Routing</div>
                  <div className="text-sm text-muted-foreground">
                    Configure task routing rules and provider priorities
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                  4
                </div>
                <div>
                  <div className="font-medium">Start Using</div>
                  <div className="text-sm text-muted-foreground">
                    Generate content, analyze sentiment, and monitor performance
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips and Information */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Tip:</strong> The system automatically routes tasks to the most appropriate provider based on their strengths.
          Technical analysis goes to DeepSeek, fast decisions to Groq, sentiment analysis to HuggingFace, and privacy-sensitive tasks to Ollama.
        </AlertDescription>
      </Alert>
    </div>
  );
}