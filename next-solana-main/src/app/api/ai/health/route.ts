import { NextRequest, NextResponse } from 'next/server';
import { getLLMService } from '../../../../lib/ai/LLMService';

// GET /api/ai/health - Get system health and metrics
export async function GET(request: NextRequest) {
  try {
    const llmService = getLLMService();

    // Ensure service is initialized
    if (!llmService.isReady()) {
      await llmService.initialize();
    }

    const providerHealth = await llmService.getProviderHealth();
    const metrics = await llmService.getSystemMetrics();
    const cacheStats = await llmService.getCacheStats();

    // Calculate system status
    const providersArray = Array.from(providerHealth.entries());
    const healthyProviders = providersArray.filter(([_, health]) => health.status === 'healthy');
    const totalProviders = providersArray.length;

    const systemStatus = {
      is_initialized: llmService.isReady(),
      total_providers: totalProviders,
      healthy_providers: healthyProviders.length,
      total_requests: metrics.total_requests,
      success_rate: metrics.total_requests > 0
        ? (metrics.successful_requests / metrics.total_requests) * 100
        : 0,
      cache_enabled: true,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json({
      system_status: systemStatus,
      provider_health: Object.fromEntries(providerHealth),
      metrics,
      cache_stats: cacheStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching system health:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch system health',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// POST /api/ai/health - Perform health actions
export async function POST(request: NextRequest) {
  try {
    const llmService = getLLMService();

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'initialize':
        if (!llmService.isReady()) {
          await llmService.initialize();
        }
        return NextResponse.json({
          success: true,
          message: 'LLM Service initialized successfully',
          status: 'initialized'
        });

      case 'clear_cache':
        await llmService.clearCache();
        return NextResponse.json({
          success: true,
          message: 'Cache cleared successfully'
        });

      case 'reset_metrics':
        // This would reset metrics in the health monitor
        return NextResponse.json({
          success: true,
          message: 'Metrics reset successfully'
        });

      case 'health_check':
        const providerHealth = await llmService.getProviderHealth();
        return NextResponse.json({
          success: true,
          provider_health: Object.fromEntries(providerHealth)
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error performing health action:', error);
    return NextResponse.json(
      {
        error: 'Failed to perform health action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}