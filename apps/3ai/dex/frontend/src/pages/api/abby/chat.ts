import { NextApiRequest, NextApiResponse } from 'next';
import { ABBY_CONFIG } from '../../../config/constants';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Process the message with ABBY's AI
    const response = await processMessage(message);
    
    // Return the response with animation state
    return res.status(200).json({
      text: response,
      animation: ABBY_CONFIG.ANIMATIONS.TALKING
    });
    
  } catch (error) {
    console.error('Error processing message:', error);
    return res.status(500).json({ 
      error: 'Failed to process message',
      animation: ABBY_CONFIG.ANIMATIONS.ERROR
    });
  }
}

async function processMessage(message: string): Promise<string> {
  const configuredEndpoint =
    process.env.MEME_AGENT_CHAT_ENDPOINT ||
    process.env.MEME_AGENT_API_URL ||
    process.env.NEXT_PUBLIC_MEME_AGENT_CHAT_ENDPOINT ||
    process.env.NEXT_PUBLIC_MEME_AGENT_API_URL ||
    process.env.VITE_API_URL;

  const baseEndpoint = configuredEndpoint
    ? configuredEndpoint.replace(/\/$/, '')
    : 'http://localhost:3001/api';
  const endpoint =
    baseEndpoint.includes('/query') || baseEndpoint.includes('/chat')
      ? baseEndpoint
      : `${baseEndpoint}/meme-agent/chat`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const apiKey =
    process.env.MEME_AGENT_API_KEY ||
    process.env.NEXT_PUBLIC_MEME_AGENT_API_KEY;

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const isQueryEndpoint = endpoint.includes('/query');
  const isOpenAIChatEndpoint = endpoint.includes('/chat/completions');
  const payload = isQueryEndpoint
    ? {
        query: message,
        provider: process.env.MEME_AGENT_PROVIDER || 'ollama',
        model: process.env.MEME_AGENT_MODEL,
      }
    : isOpenAIChatEndpoint
      ? {
          model: process.env.MEME_AGENT_MODEL || 'mistral',
          messages: [{ role: 'user', content: message }],
        }
      : {
          message,
        };

  const aiResponse = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!aiResponse.ok) {
    throw new Error(`Meme-agent AI request failed: ${aiResponse.status}`);
  }

  const data = await aiResponse.json();

  if (typeof data === 'string') {
    return data;
  }

  const responseText =
    data?.text ??
    data?.response ??
    data?.reply ??
    data?.message ??
    data?.output ??
    data?.choices?.[0]?.message?.content;

  if (typeof responseText === 'string' && responseText.trim()) {
    return responseText;
  }

  throw new Error('Meme-agent AI returned an invalid response payload');
}
