import { NextRequest, NextResponse } from 'next/server';
import { getLLMService } from '../../../../lib/ai/LLMService';

// POST /api/ai/sentiment - Analyze sentiment of text
export async function POST(request: NextRequest) {
  try {
    const llmService = getLLMService();

    // Ensure service is initialized
    if (!llmService.isReady()) {
      await llmService.initialize();
    }

    const body = await request.json();
    const { text, texts } = body;

    // Validate input
    if (!text && !texts) {
      return NextResponse.json(
        { error: 'Either text or texts array is required' },
        { status: 400 }
      );
    }

    if (texts && Array.isArray(texts)) {
      // Batch sentiment analysis
      const results = [];

      for (const singleText of texts) {
        const result = await llmService.analyzeSentiment(singleText);
        results.push({
          text: singleText,
          ...result
        });
      }

      return NextResponse.json({
        results,
        batch: true,
        count: results.length,
        timestamp: new Date().toISOString()
      });
    } else {
      // Single text analysis
      const result = await llmService.analyzeSentiment(text);

      return NextResponse.json({
        text,
        ...result,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze sentiment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}