import { NextRequest, NextResponse } from 'next/server';
import { getLLMService } from '../../../../lib/ai/LLMService';
import { LLMConfig } from '../../../../../packages/agent-core/src/config/LLMConfig';

// GET /api/ai/providers - Get provider health and status
export async function GET(request: NextRequest) {
  try {
    const llmService = getLLMService();

    // Ensure service is initialized
    if (!llmService.isReady()) {
      await llmService.initialize();
    }

    const providerHealth = await llmService.getProviderHealth();
    const metrics = await llmService.getSystemMetrics();
    const config = llmService.getConfig();

    // Convert Map to object for JSON serialization
    const providersObject = Object.fromEntries(providerHealth);

    return NextResponse.json({
      providers: providersObject,
      metrics,
      config: config.exportConfig(),
      system_status: {
        is_initialized: llmService.isReady(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching provider health:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch provider health',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/ai/providers - Update provider configuration
export async function POST(request: NextRequest) {
  try {
    const llmService = getLLMService();

    // Ensure service is initialized
    if (!llmService.isReady()) {
      await llmService.initialize();
    }

    const body = await request.json();
    const { config: newConfig, action } = body;

    if (action === 'initialize') {
      await llmService.initialize();
      return NextResponse.json({
        success: true,
        message: 'LLM Service initialized successfully'
      });
    }

    if (action === 'reset') {
      llmService.getConfig().resetToDefaults();
      return NextResponse.json({
        success: true,
        message: 'Configuration reset to defaults'
      });
    }

    if (newConfig) {
      // Validate new configuration
      const config = new LLMConfig(newConfig);
      const validation = config.validate();

      if (!validation.valid) {
        return NextResponse.json(
          {
            error: 'Invalid configuration',
            details: validation.errors
          },
          { status: 400 }
        );
    }

      // Update configuration
      llmService.updateConfig(config.exportConfig());

      return NextResponse.json({
        success: true,
        message: 'Configuration updated successfully',
        config: config.exportConfig()
      });
    }

    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating provider configuration:', error);
    return NextResponse.json(
      {
        error: 'Failed to update configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}