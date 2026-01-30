import { describe, it, expect } from 'vitest'
import { TrendDetector, TrendSignal, Platform } from '../src/trends/TrendDetector'

describe('TrendDetector.calculateSignalVelocity guards', () => {
  it('returns 0 when timeDiff is zero or negative (simulated existing signal timestamp in future)', async () => {
    const detector = new TrendDetector()

    // Create a fake existing signal with a timestamp in the future
    const futureSignal: TrendSignal = {
      id: 'test-1',
      topic: 'TEST_TOPIC',
      platform: Platform.TWITTER,
      category: 0 as any,
      strength: 0.5,
      velocity: 0,
      timestamp: Date.now() + 10000, // 10s in the future
      sources: [],
      relatedTopics: [],
      sentiment: 0,
      hashtags: [],
      mentions: 0,
      engagement: 0,
      viralScore: 0,
      influencerMentions: [],
      geographicSpread: [],
    }

    // Manually insert into activeSignals (private property - use casting for test)
    ;(detector as any).activeSignals = new Map([[futureSignal.id, futureSignal]])

    const velocity = (detector as any).calculateSignalVelocity({ topic: 'TEST_TOPIC' })
    expect(velocity).toBe(0)
  })
})
