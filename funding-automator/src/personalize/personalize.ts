import { generatePersonalized } from '../llm/llmClient'

export async function personalizeMessage (template: string, prospect: { name?: string; role?: string; notes?: string }) {
  const prompt = `Write a short personalized outreach message using this template:\n\nTemplate:\n${template}\n\nProspect:\nName: ${prospect.name ?? 'N/A'}\nRole: ${prospect.role ?? 'contact'}\nNotes: ${prospect.notes ?? ''}\n\nBe concise and professional.`

  // Use local fallback in tests/without API keys
  const resp = await generatePersonalized(prompt)
  return resp
}
