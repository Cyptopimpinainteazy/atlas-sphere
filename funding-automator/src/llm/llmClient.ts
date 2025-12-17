import axios from 'axios'

export async function generatePersonalized (
  prompt: string,
  opts?: { engine?: 'openai' | 'local' }
) {
  // Simple pluggable wrapper. When OPENAI_API_KEY is set and engine=openai,
  // this will call OpenAI's completions endpoint. Otherwise, it uses a
  // deterministic local fallback to keep tests network-free.
  const engine = opts?.engine ?? (process.env.OPENAI_API_KEY ? 'openai' : 'local')

  if (engine === 'local') {
    // deterministic and safe fallback for offline usage; echoes the prompt
    return `PERSONALIZED (local): ${prompt.slice(0, 240)}`
  }

  // OpenAI path — require key set in env
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not set')

  const resp = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300
    },
    { headers: { Authorization: `Bearer ${key}` } }
  )

  const content = resp?.data?.choices?.[0]?.message?.content
  return typeof content === 'string' ? content : JSON.stringify(resp.data)
}
