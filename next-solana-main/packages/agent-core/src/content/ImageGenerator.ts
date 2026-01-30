import { InferenceClient } from '@huggingface/inference'
// Prefer global fetch (Node 18+ or polyfilled). If types are needed, add a global.d.ts.
declare const fetch: any
import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'

export interface ImageGenerationOptions {
  width?: number
  height?: number
  steps?: number
  guidance_scale?: number
  negative_prompt?: string
  seed?: number
  model?: string
}

export interface ImageGenerationResult {
  success: boolean
  imageUrl?: string
  imageBuffer?: Buffer
  metadata?: {
    model: string
    prompt: string
    options: ImageGenerationOptions
    inferenceTime: number
    provider: string
  }
  error?: string
}

export interface MemeTemplate {
  id: string
  name: string
  description: string
  width: number
  height: number
  textAreas: {
    x: number
    y: number
    width: number
    height: number
    fontSize: number
    fontWeight: string
    textAlign: string
    color: string
  }[]
  backgroundPrompt: string
  style: string
}

export interface PlatformSpecs {
  twitter: { width: 1200; height: 675 }
  discord: { width: 800; height: 600 }
  telegram: { width: 512; height: 512 }
  instagram: { width: 1080; height: 1080 }
}

export enum ImageProvider {
  HUGGINGFACE = 'huggingface',
  OLLAMA_DIFFUSER = 'ollama_diffuser',
  AUTOMATIC1111 = 'automatic1111',
  STABILITY_AI = 'stability_ai',
}

export class ImageGenerator {
  private hfClient?: InferenceClient
  private ollamaDiffuserUrl: string
  private automatic1111Url: string
  private stabilityApiKey?: string
  private cacheDir: string
  private memeTemplates: Map<string, MemeTemplate>
  private platformSpecs: PlatformSpecs

  constructor(config: {
    huggingFaceToken?: string
    ollamaDiffuserUrl?: string
    automatic1111Url?: string
    stabilityApiKey?: string
    cacheDir?: string
  }) {
    if (config.huggingFaceToken) {
      this.hfClient = new InferenceClient(config.huggingFaceToken)
    }

    this.ollamaDiffuserUrl = config.ollamaDiffuserUrl || 'http://127.0.0.1:8000'
    this.automatic1111Url = config.automatic1111Url || 'http://127.0.0.1:7860'
    this.stabilityApiKey = config.stabilityApiKey
    this.cacheDir = config.cacheDir || './cache/images'

    this.memeTemplates = new Map()
    this.platformSpecs = {
      twitter: { width: 1200, height: 675 },
      discord: { width: 800, height: 600 },
      telegram: { width: 512, height: 512 },
      instagram: { width: 1080, height: 1080 },
    }

    this.initializeMemeTemplates()
    this.ensureCacheDir()
  }

  private initializeMemeTemplates(): void {
    const templates: MemeTemplate[] = [
      {
        id: 'diamond_hands',
        name: 'Diamond Hands',
        description: 'Classic diamond hands meme for HODLing',
        width: 800,
        height: 600,
        textAreas: [
          {
            x: 50,
            y: 50,
            width: 700,
            height: 100,
            fontSize: 48,
            fontWeight: 'bold',
            textAlign: 'center',
            color: '#FFFFFF',
          },
          {
            x: 50,
            y: 450,
            width: 700,
            height: 100,
            fontSize: 36,
            fontWeight: 'bold',
            textAlign: 'center',
            color: '#FFFFFF',
          },
        ],
        backgroundPrompt: 'diamond hands holding cryptocurrency, space background, digital art style',
        style: 'meme',
      },
      {
        id: 'to_the_moon',
        name: 'To The Moon',
        description: 'Rocket ship going to the moon meme',
        width: 800,
        height: 600,
        textAreas: [
          {
            x: 50,
            y: 50,
            width: 700,
            height: 80,
            fontSize: 42,
            fontWeight: 'bold',
            textAlign: 'center',
            color: '#FFD700',
          },
        ],
        backgroundPrompt: 'rocket ship flying to the moon, crypto symbols, space background, cartoon style',
        style: 'meme',
      },
      {
        id: 'wojak_panic',
        name: 'Wojak Panic',
        description: 'Panicking wojak for market crashes',
        width: 800,
        height: 600,
        textAreas: [
          {
            x: 50,
            y: 50,
            width: 700,
            height: 100,
            fontSize: 36,
            fontWeight: 'bold',
            textAlign: 'center',
            color: '#FF0000',
          },
        ],
        backgroundPrompt: 'panicking wojak character, red background, meme style, distressed expression',
        style: 'meme',
      },
      {
        id: 'chad_yes',
        name: 'Chad Yes',
        description: 'Chad saying yes meme',
        width: 800,
        height: 600,
        textAreas: [
          {
            x: 50,
            y: 50,
            width: 700,
            height: 100,
            fontSize: 40,
            fontWeight: 'bold',
            textAlign: 'center',
            color: '#000000',
          },
        ],
        backgroundPrompt: 'chad character nodding yes, confident expression, meme style',
        style: 'meme',
      },
      {
        id: 'pepe_smug',
        name: 'Smug Pepe',
        description: "Smug pepe for when you're right",
        width: 800,
        height: 600,
        textAreas: [
          {
            x: 50,
            y: 50,
            width: 700,
            height: 100,
            fontSize: 38,
            fontWeight: 'bold',
            textAlign: 'center',
            color: '#00FF00',
          },
        ],
        backgroundPrompt: 'smug pepe frog, satisfied expression, green background, meme style',
        style: 'meme',
      },
    ]

    templates.forEach((template) => {
      this.memeTemplates.set(template.id, template)
    })
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true })
    }
  }

  private getCacheKey(prompt: string, options: ImageGenerationOptions, provider: ImageProvider): string {
    const data = JSON.stringify({ prompt, options, provider })
    return createHash('md5').update(data).digest('hex')
  }

  private getCachedImage(cacheKey: string): Buffer | null {
    const cachePath = path.join(this.cacheDir, `${cacheKey}.png`)
    if (fs.existsSync(cachePath)) {
      return fs.readFileSync(cachePath)
    }
    return null
  }

  private cacheImage(cacheKey: string, buffer: Buffer): void {
    const cachePath = path.join(this.cacheDir, `${cacheKey}.png`)
    fs.writeFileSync(cachePath, buffer)
  }

  private optimizePromptForCrypto(prompt: string, type: 'meme' | 'logo' | 'viral'): string {
    const cryptoKeywords = {
      meme: ['cryptocurrency', 'blockchain', 'digital art', 'meme style', 'internet culture'],
      logo: ['professional', 'clean design', 'modern', 'cryptocurrency logo', 'brand identity'],
      viral: ['eye-catching', 'trending', 'social media', 'viral content', 'engaging'],
    }

    const stylePrompts = {
      meme: 'meme style, internet culture, humorous, relatable, social media ready',
      logo: 'professional logo design, clean, modern, minimalist, brand identity',
      viral: 'viral content style, eye-catching, trending, social media optimized, engaging',
    }

    const enhancedPrompt = `${prompt}, ${stylePrompts[type]}, high quality, detailed`
    return enhancedPrompt
  }

  private async generateWithHuggingFace(
    prompt: string,
    options: ImageGenerationOptions,
  ): Promise<ImageGenerationResult> {
    if (!this.hfClient) {
      return { success: false, error: 'Hugging Face client not initialized' }
    }

    const startTime = Date.now()

    try {
      const model = options.model || 'black-forest-labs/FLUX.1-dev'

      const image = await this.hfClient.textToImage({
        model,
        inputs: prompt,
        parameters: {
          width: options.width || 768,
          height: options.height || 768,
          guidance_scale: options.guidance_scale || 7.5,
          num_inference_steps: options.steps || 30,
          negative_prompt: options.negative_prompt,
        },
      })

      const buffer = Buffer.from(await image.arrayBuffer())
      const inferenceTime = Date.now() - startTime

      return {
        success: true,
        imageBuffer: buffer,
        metadata: {
          model,
          prompt,
          options,
          inferenceTime,
          provider: ImageProvider.HUGGINGFACE,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: `Hugging Face generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  private async generateWithOllamaDiffuser(
    prompt: string,
    options: ImageGenerationOptions,
  ): Promise<ImageGenerationResult> {
    const startTime = Date.now()

    try {
      const response = await fetch(`${this.ollamaDiffuserUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          width: options.width || 768,
          height: options.height || 768,
          num_inference_steps: options.steps || 30,
          guidance_scale: options.guidance_scale || 7.5,
          negative_prompt: options.negative_prompt,
          seed: options.seed,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      const inferenceTime = Date.now() - startTime

      return {
        success: true,
        imageBuffer: buffer,
        metadata: {
          model: options.model || 'flux.1-schnell',
          prompt,
          options,
          inferenceTime,
          provider: ImageProvider.OLLAMA_DIFFUSER,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: `Ollama Diffuser generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  private async generateWithAutomatic1111(
    prompt: string,
    options: ImageGenerationOptions,
  ): Promise<ImageGenerationResult> {
    const startTime = Date.now()

    try {
      const response = await fetch(`${this.automatic1111Url}/sdapi/v1/txt2img`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          negative_prompt: options.negative_prompt || 'blurry, low quality, distorted',
          steps: options.steps || 25,
          cfg_scale: options.guidance_scale || 7,
          width: options.width || 768,
          height: options.height || 768,
          sampler_name: 'Euler',
          seed: options.seed || -1,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }

      const json = (await response.json()) as { images: string[] }
      const buffer = Buffer.from(json.images[0], 'base64')
      const inferenceTime = Date.now() - startTime

      return {
        success: true,
        imageBuffer: buffer,
        metadata: {
          model: options.model || 'stable-diffusion',
          prompt,
          options,
          inferenceTime,
          provider: ImageProvider.AUTOMATIC1111,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: `Automatic1111 generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  private async generateWithStabilityAI(
    prompt: string,
    options: ImageGenerationOptions,
  ): Promise<ImageGenerationResult> {
    if (!this.stabilityApiKey) {
      return { success: false, error: 'Stability AI API key not provided' }
    }

    const startTime = Date.now()

    try {
      const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-v1-6/text-to-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.stabilityApiKey}`,
        },
        body: JSON.stringify({
          text_prompts: [
            { text: prompt, weight: 1 },
            ...(options.negative_prompt ? [{ text: options.negative_prompt, weight: -1 }] : []),
          ],
          cfg_scale: options.guidance_scale || 7,
          height: options.height || 768,
          width: options.width || 768,
          steps: options.steps || 30,
          samples: 1,
          seed: options.seed,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }

      const json = (await response.json()) as { artifacts: Array<{ base64: string }> }
      const buffer = Buffer.from(json.artifacts[0].base64, 'base64')
      const inferenceTime = Date.now() - startTime

      return {
        success: true,
        imageBuffer: buffer,
        metadata: {
          model: 'stable-diffusion-v1-6',
          prompt,
          options,
          inferenceTime,
          provider: ImageProvider.STABILITY_AI,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: `Stability AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  async generateImage(
    prompt: string,
    options: ImageGenerationOptions = {},
    provider: ImageProvider = ImageProvider.HUGGINGFACE,
  ): Promise<ImageGenerationResult> {
    const cacheKey = this.getCacheKey(prompt, options, provider)
    const cachedImage = this.getCachedImage(cacheKey)

    if (cachedImage) {
      return {
        success: true,
        imageBuffer: cachedImage,
        metadata: {
          model: options.model || 'cached',
          prompt,
          options,
          inferenceTime: 0,
          provider,
        },
      }
    }

    let result: ImageGenerationResult

    switch (provider) {
      case ImageProvider.HUGGINGFACE:
        result = await this.generateWithHuggingFace(prompt, options)
        break
      case ImageProvider.OLLAMA_DIFFUSER:
        result = await this.generateWithOllamaDiffuser(prompt, options)
        break
      case ImageProvider.AUTOMATIC1111:
        result = await this.generateWithAutomatic1111(prompt, options)
        break
      case ImageProvider.STABILITY_AI:
        result = await this.generateWithStabilityAI(prompt, options)
        break
      default:
        return { success: false, error: 'Unknown provider' }
    }

    if (result.success && result.imageBuffer) {
      this.cacheImage(cacheKey, result.imageBuffer)
    }

    return result
  }

  async generateMemeImage(
    templateId: string,
    topText: string = '',
    bottomText: string = '',
    customPrompt?: string,
    options: ImageGenerationOptions = {},
  ): Promise<ImageGenerationResult> {
    const template = this.memeTemplates.get(templateId)
    if (!template) {
      return { success: false, error: `Meme template '${templateId}' not found` }
    }

    const prompt =
      customPrompt || `${template.backgroundPrompt}, with text overlay areas for memes, ${topText} ${bottomText}`

    const optimizedPrompt = this.optimizePromptForCrypto(prompt, 'meme')

    const memeOptions: ImageGenerationOptions = {
      width: template.width,
      height: template.height,
      negative_prompt: 'low quality, blurry, distorted text, watermark',
      ...options,
    }

    return this.generateImage(optimizedPrompt, memeOptions)
  }

  async createTokenLogo(
    tokenName: string,
    tokenSymbol: string,
    description: string = '',
    style: 'modern' | 'retro' | 'minimalist' | 'crypto' = 'modern',
    options: ImageGenerationOptions = {},
  ): Promise<ImageGenerationResult> {
    const stylePrompts = {
      modern: 'modern, sleek, professional, gradient colors, tech-inspired',
      retro: 'retro, vintage, 80s style, neon colors, synthwave aesthetic',
      minimalist: 'minimalist, clean, simple, geometric shapes, monochrome',
      crypto: 'cryptocurrency style, blockchain inspired, digital, futuristic',
    }

    const prompt = `Professional logo for ${tokenName} (${tokenSymbol}) cryptocurrency token, ${description}, ${stylePrompts[style]}, circular design, transparent background, high resolution`

    const optimizedPrompt = this.optimizePromptForCrypto(prompt, 'logo')

    const logoOptions: ImageGenerationOptions = {
      width: 512,
      height: 512,
      negative_prompt: 'text, letters, words, low quality, blurry, complex background',
      ...options,
    }

    return this.generateImage(optimizedPrompt, logoOptions)
  }

  async generateViralGraphic(
    concept: string,
    platform: keyof PlatformSpecs = 'twitter',
    style: 'trending' | 'controversial' | 'educational' | 'hype' = 'trending',
    options: ImageGenerationOptions = {},
  ): Promise<ImageGenerationResult> {
    const platformSpec = this.platformSpecs[platform]

    const stylePrompts = {
      trending: 'viral, trending, eye-catching, social media optimized, engaging',
      controversial: 'bold, provocative, attention-grabbing, debate-worthy',
      educational: 'informative, clear, educational, professional, trustworthy',
      hype: 'exciting, energetic, hype-building, FOMO-inducing, explosive',
    }

    const prompt = `${concept}, ${stylePrompts[style]}, optimized for ${platform}, social media graphic, high engagement potential, professional quality`

    const optimizedPrompt = this.optimizePromptForCrypto(prompt, 'viral')

    const viralOptions: ImageGenerationOptions = {
      width: platformSpec.width,
      height: platformSpec.height,
      negative_prompt: 'low quality, blurry, unprofessional, boring, generic',
      ...options,
    }

    return this.generateImage(optimizedPrompt, viralOptions)
  }

  async generateForPlatform(
    prompt: string,
    platform: keyof PlatformSpecs,
    options: ImageGenerationOptions = {},
  ): Promise<ImageGenerationResult> {
    const platformSpec = this.platformSpecs[platform]

    const platformOptions: ImageGenerationOptions = {
      width: platformSpec.width,
      height: platformSpec.height,
      ...options,
    }

    return this.generateImage(prompt, platformOptions)
  }

  getMemeTemplates(): MemeTemplate[] {
    return Array.from(this.memeTemplates.values())
  }

  getMemeTemplate(id: string): MemeTemplate | undefined {
    return this.memeTemplates.get(id)
  }

  addMemeTemplate(template: MemeTemplate): void {
    this.memeTemplates.set(template.id, template)
  }

  getPlatformSpecs(): PlatformSpecs {
    return this.platformSpecs
  }

  async testProviders(): Promise<Record<ImageProvider, boolean>> {
    const testPrompt = 'simple test image, minimal, clean'
    const testOptions: ImageGenerationOptions = { width: 256, height: 256, steps: 10 }

    const results: Record<ImageProvider, boolean> = {
      [ImageProvider.HUGGINGFACE]: false,
      [ImageProvider.OLLAMA_DIFFUSER]: false,
      [ImageProvider.AUTOMATIC1111]: false,
      [ImageProvider.STABILITY_AI]: false,
    }

    // Test Hugging Face
    if (this.hfClient) {
      try {
        const result = await this.generateWithHuggingFace(testPrompt, testOptions)
        results[ImageProvider.HUGGINGFACE] = result.success
      } catch (error) {
        results[ImageProvider.HUGGINGFACE] = false
      }
    }

    // Test Ollama Diffuser
    try {
      const result = await this.generateWithOllamaDiffuser(testPrompt, testOptions)
      results[ImageProvider.OLLAMA_DIFFUSER] = result.success
    } catch (error) {
      results[ImageProvider.OLLAMA_DIFFUSER] = false
    }

    // Test Automatic1111
    try {
      const result = await this.generateWithAutomatic1111(testPrompt, testOptions)
      results[ImageProvider.AUTOMATIC1111] = result.success
    } catch (error) {
      results[ImageProvider.AUTOMATIC1111] = false
    }

    // Test Stability AI
    if (this.stabilityApiKey) {
      try {
        const result = await this.generateWithStabilityAI(testPrompt, testOptions)
        results[ImageProvider.STABILITY_AI] = result.success
      } catch (error) {
        results[ImageProvider.STABILITY_AI] = false
      }
    }

    return results
  }

  async getAvailableProviders(): Promise<ImageProvider[]> {
    const providerTests = await this.testProviders()
    return Object.entries(providerTests)
      .filter(([_, available]) => available)
      .map(([provider, _]) => provider as ImageProvider)
  }

  clearCache(): void {
    if (fs.existsSync(this.cacheDir)) {
      const files = fs.readdirSync(this.cacheDir)
      files.forEach((file) => {
        fs.unlinkSync(path.join(this.cacheDir, file))
      })
    }
  }

  getCacheStats(): { totalFiles: number; totalSize: number } {
    if (!fs.existsSync(this.cacheDir)) {
      return { totalFiles: 0, totalSize: 0 }
    }

    const files = fs.readdirSync(this.cacheDir)
    let totalSize = 0

    files.forEach((file) => {
      const filePath = path.join(this.cacheDir, file)
      const stats = fs.statSync(filePath)
      totalSize += stats.size
    })

    return {
      totalFiles: files.length,
      totalSize,
    }
  }
}

export default ImageGenerator
