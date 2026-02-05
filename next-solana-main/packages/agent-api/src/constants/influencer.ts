// Default configuration values for influencer settings
export const INFLUENCER_DEFAULTS = {
  postingFrequency: 6,
  viralThreshold: 0.7,
  riskTolerance: 'medium',
  contentTypes: ['text', 'meme'] as ('text' | 'image' | 'meme' | 'thread')[],
  autoFollow: false,
  communityManagement: true,
} as const

export type InfluencerSettingDefaults = typeof INFLUENCER_DEFAULTS
