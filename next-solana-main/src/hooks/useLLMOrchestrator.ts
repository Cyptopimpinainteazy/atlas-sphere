'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LLMProviderType,
  TaskType,
  ProviderHealth,
  OrchestratorMetrics,
  SentimentAnalysisResult,
  LLMConfig
} from '../../packages/agent-core/src/types';

// Types for our hook
interface LLMGenerationOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  taskType?: TaskType;
  priority?: 'low' | 'medium' | 'high';
  bypassCache?: boolean;
}

interface UseLLMGenerationResult {
  content: string;
  isLoading: boolean;
  error: string | null;
  provider: LLMProviderType | null;
  responseTime: number;
  cached: boolean;
}

interface UseLLMOrchestratorReturn {
  // Provider management
  providers: Map<LLMProviderType, ProviderHealth> | null;
  isLoadingProviders: boolean;

  // System metrics
  metrics: OrchestratorMetrics | null;
  isLoadingMetrics: boolean;

  // Content generation
  generateContent: (prompt: string, options?: LLMGenerationOptions) => Promise<string>;
  generationResult: UseLLMGenerationResult | null;

  // Sentiment analysis
  analyzeSentiment: (text: string) => Promise<SentimentAnalysisResult>;
  sentimentResult: SentimentAnalysisResult | null;
  isAnalyzing: boolean;

  // Batch operations
  generateBatch: (prompts: string[], options?: LLMGenerationOptions) => Promise<string[]>;
  isGeneratingBatch: boolean;

  // Configuration
  config: LLMConfig | null;
  updateConfig: (newConfig: Partial<LLMConfig>) => void;

  // Cache management
  clearCache: () => Promise<void>;
  cacheStats: any;

  // System status
  isInitialized: boolean;
  systemStatus: {
    total_providers: number;
    healthy_providers: number;
    total_requests: number;
    success_rate: number;
    cache_enabled: boolean;
  } | null;
}

export const useLLMOrchestrator = (): UseLLMOrchestratorReturn => {
  const queryClient = useQueryClient();
  const [isInitialized, setIsInitialized] = useState(false);
  const [generationResult, setGenerationResult] = useState<UseLLMGenerationResult | null>(null);
  const [sentimentResult, setSentimentResult] = useState<SentimentAnalysisResult | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Query for provider health
  const {
    data: providers,
    isLoading: isLoadingProviders,
    error: providersError
  } = useQuery({
    queryKey: ['llm-providers'],
    queryFn: async (): Promise<Map<LLMProviderType, ProviderHealth>> => {
      const response = await fetch('/api/ai/providers');
      if (!response.ok) throw new Error('Failed to fetch provider health');
      const data = await response.json();
      return new Map(Object.entries(data));
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 3
  });

  // Query for system metrics
  const {
    data: metrics,
    isLoading: isLoadingMetrics
  } = useQuery({
    queryKey: ['llm-metrics'],
    queryFn: async (): Promise<OrchestratorMetrics> => {
      const response = await fetch('/api/ai/health');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return await response.json();
    },
    refetchInterval: 60000, // Refresh every minute
    retry: 3
  });

  // Query for configuration
  const {
    data: config
  } = useQuery({
    queryKey: ['llm-config'],
    queryFn: async (): Promise<LLMConfig> => {
      // This would come from the LLMService
      return {} as LLMConfig;
    },
    retry: 3
  });

  // Query for cache stats
  const {
    data: cacheStats
  } = useQuery({
    queryKey: ['llm-cache-stats'],
    queryFn: async () => {
      const response = await fetch('/api/ai/health');
      if (!response.ok) throw new Error('Failed to fetch cache stats');
      const data = await response.json();
      return data.cache_stats;
    },
    refetchInterval: 60000,
    retry: 3
  });

  // Query for system status
  const {
    data: systemStatus
  } = useQuery({
    queryKey: ['llm-system-status'],
    queryFn: async () => {
      // This would be derived from providers and metrics
      return null;
    },
    refetchInterval: 30000,
    retry: 3
  });

  // Content generation mutation
  const generationMutation = useMutation({
    mutationFn: async ({
      prompt,
      options = {}
    }: {
      prompt: string;
      options?: LLMGenerationOptions
    }): Promise<UseLLMGenerationResult> => {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          ...options
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      return {
        content: data.content,
        isLoading: false,
        error: null,
        provider: data.provider,
        responseTime: data.response_time,
        cached: data.cached
      };
    },
    onSuccess: (result) => {
      setGenerationResult(result);
      queryClient.invalidateQueries({ queryKey: ['llm-metrics'] });
    },
    onError: (error) => {
      setGenerationResult({
        content: '',
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: null,
        responseTime: 0,
        cached: false
      });
    }
  });

  // Sentiment analysis mutation
  const sentimentMutation = useMutation({
    mutationFn: async (text: string): Promise<SentimentAnalysisResult> => {
      const response = await fetch('/api/ai/sentiment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setSentimentResult(data);
      return data;
    }
  });

  // Batch generation mutation
  const batchGenerationMutation = useMutation({
    mutationFn: async ({
      prompts,
      options = {}
    }: {
      prompts: string[];
      options?: LLMGenerationOptions
    }): Promise<string[]> => {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompts,
          batch: true,
          ...options
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.results.map((result: any) => result.content);
    }
  });

  // Configuration update mutation
  const configMutation = useMutation({
    mutationFn: async (newConfig: Partial<LLMConfig>) => {
      const response = await fetch('/api/ai/providers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config: newConfig })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-config'] });
      queryClient.invalidateQueries({ queryKey: ['llm-providers'] });
    }
  });

  // Cache clear mutation
  const cacheClearMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/ai/health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'clear_cache' })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-cache-stats'] });
    }
  });

  // Helper functions
  const generateContent = useCallback(async (
    prompt: string,
    options?: LLMGenerationOptions
  ): Promise<string> => {
    const result = await generationMutation.mutateAsync({ prompt, options });
    return result.content;
  }, [generationMutation]);

  const analyzeSentiment = useCallback(async (
    text: string
  ): Promise<SentimentAnalysisResult> => {
    return await sentimentMutation.mutateAsync(text);
  }, [sentimentMutation]);

  const generateBatch = useCallback(async (
    prompts: string[],
    options?: LLMGenerationOptions
  ): Promise<string[]> => {
    return await batchGenerationMutation.mutateAsync({ prompts, options });
  }, [batchGenerationMutation]);

  const updateConfig = useCallback(async (
    newConfig: Partial<LLMConfig>
  ) => {
    await configMutation.mutateAsync(newConfig);
  }, [configMutation]);

  const clearCache = useCallback(async () => {
    await cacheClearMutation.mutateAsync();
  }, [cacheClearMutation]);

  // Initialize service on mount
  useEffect(() => {
    const initializeService = async () => {
      try {
        const response = await fetch('/api/ai/health', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'initialize' })
        });

        if (response.ok) {
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('Failed to initialize LLM service:', error);
      }
    };

    initializeService();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // Provider management
    providers,
    isLoadingProviders,

    // System metrics
    metrics,
    isLoadingMetrics,

    // Content generation
    generateContent,
    generationResult: generationResult || {
      content: '',
      isLoading: generationMutation.isPending,
      error: generationMutation.error?.message || null,
      provider: null,
      responseTime: 0,
      cached: false
    },

    // Sentiment analysis
    analyzeSentiment,
    sentimentResult,
    isAnalyzing: sentimentMutation.isPending,

    // Batch operations
    generateBatch,
    isGeneratingBatch: batchGenerationMutation.isPending,

    // Configuration
    config,
    updateConfig,

    // Cache management
    clearCache,
    cacheStats,

    // System status
    isInitialized,
    systemStatus
  };
};

// Specialized hooks for specific use cases

export const useLLMGeneration = (options?: LLMGenerationOptions) => {
  const { generateContent, generationResult } = useLLMOrchestrator();

  const generate = useCallback(async (prompt: string) => {
    return await generateContent(prompt, options);
  }, [generateContent, options]);

  return {
    generate,
    result: generationResult,
    isLoading: generationResult?.isLoading || false,
    error: generationResult?.error
  };
};

export const useLLMSentiment = () => {
  const { analyzeSentiment, sentimentResult, isAnalyzing } = useLLMOrchestrator();

  return {
    analyzeSentiment,
    result: sentimentResult,
    isAnalyzing
  };
};

export const useLLMHealth = () => {
  const { providers, metrics, systemStatus } = useLLMOrchestrator();

  return {
    providers,
    metrics,
    systemStatus,
    isHealthy: providers ? Array.from(providers.values()).some(p => p.status === 'healthy') : false
  };
};

export const useLLMConfig = () => {
  const { config, updateConfig } = useLLMOrchestrator();

  return {
    config,
    updateConfig
  };
};

// Hook for real-time updates via WebSocket
export const useLLMRealTime = () => {
  const [realTimeData, setRealTimeData] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // WebSocket connection would be implemented here
    // This is a placeholder for the real-time functionality

    setIsConnected(false);

    return () => {
      // Cleanup WebSocket connection
    };
  }, []);

  return {
    realTimeData,
    isConnected
  };
};