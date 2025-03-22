import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accountId, mediaUrl, caption, userToken } = req.body;

    if (!accountId || !mediaUrl || !userToken) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const response = await fetch('https://graph.facebook.com/v12.0/me/media', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: mediaUrl,
        caption: caption || '',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to publish to Instagram: ${response.statusText}`);
    }

    const data = await response.json();
    res.status(200).json({ message: 'Published successfully', data });
  } catch (error) {
    console.error('Error publishing to Instagram:', error);
    res.status(500).json({ error: 'Failed to publish', details: error.message });
  }
}
