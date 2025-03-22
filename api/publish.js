import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accountId, mediaUrl, caption, userToken, accountNum } = req.body;

    if (!accountId || !mediaUrl || !userToken || !accountNum) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const instagramToken = process.env[`TOKEN_${accountNum}`];
    if (!instagramToken || instagramToken !== userToken) {
      return res.status(401).json({ error: 'Invalid or mismatched token for this account' });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

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
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to publish to Instagram: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    res.status(200).json({ message: 'Published successfully', data });
  } catch (error) {
    console.error('Error publishing to Instagram:', error);
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request to Instagram API timed out' });
    }
    res.status(500).json({ error: 'Failed to publish', details: error.message });
  }
}
