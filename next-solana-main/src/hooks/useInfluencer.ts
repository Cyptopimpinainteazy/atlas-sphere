'use client';

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import useSWR, { mutate } from 'swr';

// Types for the influencer system
export interface Influencer {
  id: string;
  name: string;
  persona: string;
  status: 'active' | 'paused' | 'inactive';
  platforms: string[];
  followerCount: Record<string, number>;
  engagementRate: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface InfluencerMetrics {
  id: string;
  influencerId: string;
  platform: string;
  followers: number;
  following: number;
  posts: number;
  engagement: {
    likes: number;
    shares: number;
    comments: number;
    reach: number;
    impressions: number;
  };
  growthRate: number;
  viralScore: number;
  timestamp: string;
}

export interface ContentItem {
  id: string;
  influencerId: string;
  platform: string;
  content: string;
  mediaUrls?: string[];
  hashtags: string[];
  viralScore: number;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduledAt?: string;
  publishedAt?: string;
  engagement: {
    likes: number;
    shares: number;
    comments: number;
    reach: number;
  };
  createdAt: string;
}

export interface ViralCampaign {
  id: string;
  name: string;
  influencerIds: string[];
  objective: 'growth' | 'engagement' | 'viral' | 'awareness';
  status: 'draft' | 'active' | 'paused' | 'completed';
  startDate: string;
  endDate: string;
  budget?: number;
  targetMetrics: {
    followers?: number;
    engagement?: number;
    reach?: number;
  };
  currentMetrics: {
    followers: number;
    engagement: number;
    reach: number;
    viralPosts: number;
  };
  createdAt: string;
}

export interface ContentGenerationRequest {
  influencerId: string;
  platform: string;
  contentType: 'text' | 'meme' | 'thread' | 'image';
  topic?: string;
  tone?: 'bullish' | 'bearish' | 'neutral' | 'humorous' | 'educational';
  includeHashtags?: boolean;
  scheduledAt?: string;
}

// API client functions
const api = {
  // Influencer management
  getInfluencers: async (): Promise<Influencer[]> => {
    const response = await fetch('/api/influencers');
    if (!response.ok) throw new Error('Failed to fetch influencers');
    return response.json();
  },

  getInfluencer: async (id: string): Promise<Influencer> => {
    const response = await fetch(`/api/influencers/${id}`);
    if (!response.ok) throw new Error('Failed to fetch influencer');
    return response.json();
  },

  createInfluencer: async (data: Partial<Influencer>): Promise<Influencer> => {
    const response = await fetch('/api/influencers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create influencer');
    return response.json();
  },

  updateInfluencer: async (id: string, data: Partial<Influencer>): Promise<Influencer> => {
    const response = await fetch(`/api/influencers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update influencer');
    return response.json();
  },

  deleteInfluencer: async (id: string): Promise<void> => {
    const response = await fetch(`/api/influencers/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete influencer');
  },

  // Metrics
  getInfluencerMetrics: async (id: string, timeframe: string = '7d'): Promise<InfluencerMetrics[]> => {
    const response = await fetch(`/api/influencers/${id}/metrics?timeframe=${encodeURIComponent(timeframe)}`);
    if (!response.ok) throw new Error('Failed to fetch metrics');
    return response.json();
  },

  // Content management
  getInfluencerContent: async (id: string, page: number = 1): Promise<{ content: ContentItem[]; hasMore: boolean; nextPage?: number }> => {
    const response = await fetch(`/api/influencers/${id}/content?page=${encodeURIComponent(page.toString())}`);
    if (!response.ok) throw new Error('Failed to fetch content');
    return response.json();
  },

  generateContent: async (request: ContentGenerationRequest): Promise<ContentItem> => {
    const response = await fetch(`/api/influencers/${request.influencerId}/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: request.contentType,
        platform: request.platform,
        topic: request.topic,
        urgency: 'medium',
        targetAudience: 'crypto',
        includeHashtags: request.includeHashtags || true,
        scheduleFor: request.scheduledAt
      }),
    });
    if (!response.ok) throw new Error('Failed to generate content');
    return response.json();
  },

  scheduleContent: async (contentId: string, scheduledAt: string): Promise<ContentItem> => {
    const response = await fetch(`/api/influencers/${contentId}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'placeholder', // Server expects content in body
        platform: 'twitter', // Server expects platform in body
        scheduledFor: scheduledAt,
        type: 'text',
        priority: 'medium',
        viralOptimization: true,
        autoHashtags: true
      }),
    });
    if (!response.ok) throw new Error('Failed to schedule content');
    return response.json();
  },

  publishContent: async (contentId: string): Promise<ContentItem> => {
    const response = await fetch(`/api/influencers/content/${contentId}/publish`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to publish content');
    return response.json();
  },

  // Viral campaigns
  getCampaigns: async (influencerId?: string): Promise<ViralCampaign[]> => {
    const url = influencerId ? `/api/influencers/${influencerId}/campaigns` : '/api/influencers/campaigns';
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch campaigns');
    return response.json();
  },

  getCampaign: async (id: string): Promise<ViralCampaign> => {
    const response = await fetch(`/api/influencers/campaigns/${id}`);
    if (!response.ok) throw new Error('Failed to fetch campaign');
    return response.json();
  },

  createCampaign: async (data: Partial<ViralCampaign>): Promise<ViralCampaign> => {
    if (!data.influencerIds || data.influencerIds.length === 0) {
      throw new Error('At least one influencer ID is required');
    }
    const influencerId = data.influencerIds[0]; // Server expects single influencer per campaign
    const response = await fetch(`/api/influencers/${influencerId}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name || 'New Campaign',
        type: 'viral-boost',
        platforms: ['twitter'], // Default platform
        duration: 24, // Default 24 hours
        budget: data.budget,
        targetMetrics: data.targetMetrics || {},
        content: {
          templates: [],
          hashtags: [],
          mentions: []
        }
      }),
    });
    if (!response.ok) throw new Error('Failed to create campaign');
    return response.json();
  },

  updateCampaign: async (id: string, data: Partial<ViralCampaign>): Promise<ViralCampaign> => {
    const response = await fetch(`/api/influencers/campaigns/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update campaign');
    return response.json();
  },

  deleteCampaign: async (id: string): Promise<void> => {
    const response = await fetch(`/api/influencers/campaigns/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete campaign');
  },
};

// WebSocket hook for real-time updates
export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'failed';

export function useInfluencerWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = useRef(1000); // Start with 1 second

  const [websocketState, setWebsocketState] = useState<{
    webSocket: WebSocket | null;
    status: WebSocketStatus;
    lastMessage: string | null;
  }>({
    webSocket: null,
    status: 'connecting',
    lastMessage: null,
  });

  const connectWebSocket = () => {
    setWebsocketState(prev => ({ ...prev, status: 'connecting' }));

    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/influencers');
    wsRef.current = ws;

    ws.onmessage = (event) => {
      setWebsocketState(prev => ({ ...prev, lastMessage: event.data }));
      try {
        const data = JSON.parse(event.data);

        // Validate that data is an object and contains a valid type field
        if (!data || typeof data !== 'object' || !data.type || typeof data.type !== 'string') {
          console.warn('Received malformed WebSocket message, ignoring:', data);
          return;
        }

        switch (data.type) {
          case 'influencer_updated':
            queryClient.invalidateQueries({ queryKey: ['influencers'] });
            queryClient.invalidateQueries({ queryKey: ['influencer', data.influencerId] });
            break;
          case 'metrics_updated':
            queryClient.invalidateQueries({ queryKey: ['influencer_metrics', data.influencerId] });
            break;
          case 'content_published':
            queryClient.invalidateQueries({ queryKey: ['influencer_content', data.influencerId] });
            break;
          case 'campaign_updated':
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            queryClient.invalidateQueries({ queryKey: ['campaign', data.campaignId] });
            break;
          default:
            console.warn('Received unknown WebSocket message type:', data.type);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWebsocketState(prev => ({ ...prev, status: 'failed' }));
    };

    ws.onclose = () => {
      setWebsocketState(prev => ({ ...prev, status: 'disconnected' }));

      if (reconnectAttempts.current < maxReconnectAttempts) {
        setTimeout(() => {
          reconnectAttempts.current += 1;
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000); // Exponential backoff, max 30 seconds
          connectWebSocket();
        }, reconnectDelay.current);
      } else {
        // Max reconnect attempts reached
        console.error(`WebSocket reconnection failed after ${maxReconnectAttempts} attempts`);
        setWebsocketState(prev => ({ ...prev, status: 'failed' }));
      }
    };

    ws.onopen = () => {
      setWebsocketState(prev => ({ ...prev, status: 'connected', webSocket: ws }));
      reconnectAttempts.current = 0;
      reconnectDelay.current = 1000;
    };
  };

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.onopen = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [queryClient]);

  return {
    webSocket: websocketState.webSocket,
    isConnected: websocketState.status === 'connected',
    connectionStatus: websocketState.status,
    lastMessage: websocketState.lastMessage,
  };
}

// Main hooks for influencer management
export function useInfluencers() {
  const { data, error, mutate } = useSWR<Influencer[]>('influencers', api.getInfluencers, {
    refreshInterval: 30000, // Refresh every 30 seconds
    revalidateOnFocus: true,
    dedupingInterval: 10000,
  });

  return {
    influencers: data,
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
}

export function useInfluencer(id: string) {
  const { data, error, mutate } = useSWR<Influencer>(
    id ? ['influencer', id] : null,
    () => api.getInfluencer(id),
    {
      refreshInterval: 60000,
      revalidateOnFocus: true,
    }
  );

  return {
    influencer: data,
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
}

export function useInfluencerMetrics(id: string, timeframe: string = '7d') {
  const { data, error, mutate } = useSWR<InfluencerMetrics[]>(
    id ? ['influencer_metrics', id, timeframe] : null,
    () => api.getInfluencerMetrics(id, timeframe),
    {
      refreshInterval: 120000, // Refresh every 2 minutes
      revalidateOnFocus: true,
    }
  );

  return {
    metrics: data,
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
}

export function useInfluencerContent(id: string) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ['influencer_content', id],
    queryFn: ({ pageParam = 1 }) => api.getInfluencerContent(id, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.nextPage !== undefined) {
        return lastPage.nextPage;
      }
      return lastPage.hasMore ? pages.length + 1 : undefined;
    },
    enabled: !!id,
    staleTime: 60000,
  });

  const content = data?.pages.flatMap(page => page.content) || [];

  return {
    content,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  };
}

export function useContentGeneration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.generateContent,
    onSuccess: (newContent) => {
      // Optimistically update the content list
      queryClient.setQueryData(
        ['influencer_content', newContent.influencerId],
        (old: any) => {
          if (!old) return { pages: [{ content: [newContent], hasMore: false }], pageParams: [1] };

          const newPages = [...old.pages];
          if (newPages[0]) {
            newPages[0] = {
              ...newPages[0],
              content: [newContent, ...newPages[0].content],
            };
          }
          return { pages: newPages, pageParams: old.pageParams };
        }
      );

      // Invalidate to ensure consistency
      queryClient.invalidateQueries({
        queryKey: ['influencer_content', newContent.influencerId]
      });
    },
    onError: (error) => {
      console.error('Content generation failed:', error);
    },
  });
}

export function useViralCampaigns(influencerId?: string) {
  const { data, error, mutate } = useSWR<ViralCampaign[]>(
    ['campaigns'],
    () => api.getCampaigns(influencerId),
    {
      refreshInterval: 60000,
      revalidateOnFocus: true,
    }
  );

  return {
    campaigns: data,
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
}

export function useViralCampaign(id: string) {
  const { data, error, mutate } = useSWR<ViralCampaign>(
    id ? ['campaign', id] : null,
    () => api.getCampaign(id),
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
    }
  );

  return {
    campaign: data,
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
}

// Mutation hooks for CRUD operations
export function useCreateInfluencer() {
  return useMutation({
    mutationFn: api.createInfluencer,
    onSuccess: () => {
      mutate('influencers');
    },
    onError: (error) => {
      console.error('Failed to create influencer:', error);
    },
  });
}

export function useUpdateInfluencer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Influencer> }) =>
      api.updateInfluencer(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: ['influencer', id] });

      // Snapshot previous data
      const previousInfluencer = queryClient.getQueryData(['influencer', id]);

      // Optimistically update
      queryClient.setQueryData(['influencer', id], (old: Influencer) =>
        old ? { ...old, ...data } : old
      );

      return { previousInfluencer };
    },
    onError: (err, { id }, context) => {
      // Rollback on error
      if (context?.previousInfluencer) {
        queryClient.setQueryData(['influencer', id], context.previousInfluencer);
      }
    },
    onSettled: (data, error, variables) => {
      // Invalidate queries to refetch and keep cache consistent
      queryClient.invalidateQueries({ queryKey: ['influencer', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['influencers'] });
    },
  });
}

export function useDeleteInfluencer() {
  return useMutation({
    mutationFn: api.deleteInfluencer,
    onSuccess: () => {
      mutate('influencers');
    },
    onError: (error) => {
      console.error('Failed to delete influencer:', error);
    },
  });
}

export function useScheduleContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contentId, scheduledAt }: { contentId: string; scheduledAt: string }) =>
      api.scheduleContent(contentId, scheduledAt),
    onSuccess: (updatedContent) => {
      // Update the content in the cache
      queryClient.setQueryData(
        ['influencer_content', updatedContent.influencerId],
        (old: any) => {
          if (!old) return old;

          const newPages = old.pages.map((page: any) => ({
            ...page,
            content: page.content.map((item: ContentItem) =>
              item.id === updatedContent.id ? updatedContent : item
            ),
          }));

          return { pages: newPages, pageParams: old.pageParams };
        }
      );
    },
  });
}

export function usePublishContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.publishContent,
    onSuccess: (updatedContent) => {
      // Update the content in the cache
      queryClient.setQueryData(
        ['influencer_content', updatedContent.influencerId],
        (old: any) => {
          if (!old) return old;

          const newPages = old.pages.map((page: any) => ({
            ...page,
            content: page.content.map((item: ContentItem) =>
              item.id === updatedContent.id ? updatedContent : item
            ),
          }));

          return { pages: newPages, pageParams: old.pageParams };
        }
      );

      // Invalidate metrics as publishing affects them
      queryClient.invalidateQueries({
        queryKey: ['influencer_metrics', updatedContent.influencerId]
      });
    },
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (error) => {
      console.error('Failed to create campaign:', error);
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ViralCampaign> }) =>
      api.updateCampaign(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: ['campaign', id] });

      const previousCampaign = queryClient.getQueryData(['campaign', id]);

      // Optimistically update
      queryClient.setQueryData(['campaign', id], (old: ViralCampaign) =>
        old ? { ...old, ...data } as ViralCampaign : old
      );

      return { previousCampaign };
    },
    onError: (err, { id }, context) => {
      // Rollback on error
      if (context?.previousCampaign) {
        queryClient.setQueryData(['campaign', id], context.previousCampaign);
      }
    },
    onSettled: (data, error, variables) => {
      // Invalidate queries to refetch and keep cache consistent
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (error) => {
      console.error('Failed to delete campaign:', error);
    },
  });
}

// Utility hooks for common operations
export function useInfluencerStats() {
  const { influencers } = useInfluencers();

  const stats = {
    total: influencers?.length || 0,
    active: influencers?.filter((i: Influencer) => i.status === 'active').length || 0,
    totalFollowers: influencers?.reduce((sum: number, i: Influencer) =>
      sum + (Object.values(i.followerCount) as number[]).reduce((a: number, b: number) => a + b, 0), 0
    ) || 0,
    avgEngagement: influencers?.reduce((sum: number, i: Influencer) => {
      const engagementKeys = Object.keys(i.engagementRate);
      const avgForInfluencer = engagementKeys.length > 0
        ? (Object.values(i.engagementRate) as number[]).reduce((a: number, b: number) => a + b, 0) / engagementKeys.length
        : 0;
      return sum + avgForInfluencer;
    }, 0) / (influencers?.length || 1) || 0,
  };

  return stats;
}

export function useCampaignStats() {
  const { campaigns } = useViralCampaigns();

  const stats = {
    total: campaigns?.length || 0,
    active: campaigns?.filter((c: ViralCampaign) => c.status === 'active').length || 0,
    completed: campaigns?.filter((c: ViralCampaign) => c.status === 'completed').length || 0,
    totalReach: campaigns?.reduce((sum: number, c: ViralCampaign) => sum + (c.currentMetrics?.reach ?? 0), 0) || 0,
    totalEngagement: campaigns?.reduce((sum: number, c: ViralCampaign) => sum + (c.currentMetrics?.engagement ?? 0), 0) || 0,
  };

  return stats;
}
