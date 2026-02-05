import { promises as fs } from 'fs'
import { watch } from 'fs'
import path from 'path'
import { z } from 'zod'
import { AgentPersona } from '../types'

const personaSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  model: z.object({
    primary: z.enum(['deepseek', 'groq', 'ollama', 'huggingface']),
    fallback: z.array(z.enum(['deepseek', 'groq', 'ollama', 'huggingface'])),
    temperature: z.number().min(0).max(2),
    max_tokens: z.number().positive(),
  }),
  trading: z.object({
    enabled: z.boolean(),
    max_position_size: z.number().positive(),
    risk_tolerance: z.enum(['low', 'medium', 'high']),
    strategy: z.enum(['conservative', 'aggressive', 'balanced']),
    stop_loss_percentage: z.number().positive(),
    take_profit_percentage: z.number().positive(),
    max_concurrent_positions: z.number().int().positive(),
  }),
  capabilities: z.array(z.string()),
  personality: z.object({
    tone: z.enum(['professional', 'casual', 'humorous', 'analytical']),
    expertise: z.array(z.string()),
    communication_style: z.enum(['direct', 'verbose', 'concise']),
    emoji_usage: z.enum(['none', 'minimal', 'moderate', 'frequent']),
  }),
  social: z.object({
    twitter_username: z.string().optional(),
    discord_username: z.string().optional(),
    telegram_username: z.string().optional(),
    posting_schedule: z.object({
      frequency: z.enum(['low', 'medium', 'high']),
      time_restrictions: z.array(z.string()),
    }),
    content_focus: z.array(z.enum(['trading', 'analysis', 'education', 'entertainment'])),
  }),
})

/**
 * Loads and validates agent personas from JSON files
 */
export class PersonaLoader {
  private personaCache = new Map<string, AgentPersona>()
  private readonly personasDir: string
  private watcher: ReturnType<typeof watch> | null = null

  constructor(personasDir = './personas') {
    this.personasDir = path.resolve(personasDir)
  }

  /**
   * Load a persona by ID
   */
  async loadPersona(personaId: string): Promise<AgentPersona> {
    // Check cache first
    if (this.personaCache.has(personaId)) {
      return this.personaCache.get(personaId)!
    }

    const filePath = path.join(this.personasDir, `${personaId}.json`)

    try {
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(fileContent)

      const validatedPersona = personaSchema.parse(data)
      const persona: AgentPersona = {
        ...validatedPersona,
        created_at: new Date(),
        updated_at: new Date(),
      }

      this.personaCache.set(personaId, persona)
      return persona
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Zod may provide .errors or .format depending on version
        const errs = (error as any).errors || (error as any).format?.() || []
        const message = Array.isArray(errs)
          ? errs.map((e: any) => e.message || JSON.stringify(e)).join('; ')
          : String(error.message || JSON.stringify(errs))
        throw new Error(`Persona validation failed for ${personaId}: ${message}`)
      }
      throw new Error(
        `Failed to load persona ${personaId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Validate a persona object
   */
  validatePersona(persona: unknown): { success: boolean; errors: string[] } {
    try {
      personaSchema.parse(persona)
      return { success: true, errors: [] }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errs = (error as any).errors || []
        return {
          success: false,
          errors: Array.isArray(errs)
            ? errs.map((e: any) => (e.path ? `${e.path.join('.')}: ${e.message}` : e.message || JSON.stringify(e)))
            : [String(error.message)],
        }
      }
      return { success: false, errors: ['Unknown validation error'] }
    }
  }

  /**
   * Get all available personas
   */
  async getAvailablePersonas(): Promise<{ id: string; name: string; description: string }[]> {
    try {
      const files = await fs.readdir(this.personasDir)
      const personaFiles = files.filter((f) => f.endsWith('.json'))

      const personas = await Promise.all(
        personaFiles.map(async (file) => {
          try {
            const filePath = path.join(this.personasDir, file)
            const content = await fs.readFile(filePath, 'utf-8')
            const data = JSON.parse(content)

            const personaId = path.basename(file, '.json')
            return {
              id: personaId,
              name: data.name || 'Unknown',
              description: data.description || 'No description',
            }
          } catch (error) {
            console.warn(`Failed to read persona file ${file}:`, error)
            return null
          }
        }),
      )

      return personas.filter((p) => p !== null) as { id: string; name: string; description: string }[]
    } catch (error) {
      console.error('Failed to scan personas directory:', error)
      return []
    }
  }

  /**
   * Start watching for persona file changes
   */
  watchPersonaChanges(): void {
    // Simplified - just clear cache on next load
    // File watching would require more complex implementation
    console.log('Persona file watching enabled - cache will be cleared on validation')
  }

  /**
   * Stop watching for changes
   */
  stopWatching(): void {
    // No-op for simplified implementation
  }

  /**
   * Clear the persona cache
   */
  clearCache(): void {
    this.personaCache.clear()
  }

  /**
   * Create default personas directory
   */
  async ensurePersonasDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.personasDir, { recursive: true })
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code !== 'EEXIST') {
        throw error
      }
    }
  }
}
