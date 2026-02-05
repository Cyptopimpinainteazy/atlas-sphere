import { NextRequest, NextResponse } from 'next/server';
import { getLLMService } from '../../../../lib/ai/LLMService';
import { TaskType } from '../../../../../packages/agent-core/src/types';

// POST /api/ai/generate - Generate AI content
export async function POST(request: NextRequest) {
  try {
    const llmService = getLLMService();

    // Ensure service is initialized
    if (!llmService.isReady()) {
      await llmService.initialize();
    }

    const body = await request.json();
    const {
      prompt,
      prompts, // For batch processing
      context,
      temperature,
      maxTokens,
      model,
      taskType,
      priority = 'medium',
      bypassCache = false
    } = body;

    // Validate input
    if (!prompt && !prompts) {
      return NextResponse.json(
        { error: 'Either prompt or prompts array is required' },
        { status: 400 }
      );
    }

    if (prompts && Array.isArray(prompts)) {
      // Batch processing
      const results = await llmService.generateBatchResponses(prompts, {
        taskType: taskType as TaskType,
        priority: priority as 'low' | 'medium' | 'high'
      });

      return NextResponse.json({
        results,
        batch: true,
        count: results.length,
        timestamp: new Date().toISOString()
      });
    } else {
      // Single prompt processing
      const response = await llmService.generateResponse(prompt, context, {
        temperature,
        maxTokens,
        model,
        taskType: taskType as TaskType,
        priority: priority as 'low' | 'medium' | 'high',
        bypassCache
      });

      return NextResponse.json({
        content: response,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error generating AI content:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate content',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}