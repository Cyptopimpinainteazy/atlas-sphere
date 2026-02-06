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
      return res.status(400).json({ error: 'Message is reqfrontend/uired' });
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
  // TODO: Integrate with the meme-agent's AI
  // For now, return a simple response
  return `You said: "${message}". I'm ABBY, your 3aiXchange assistant. How can I help you with your trades today?`;
}
