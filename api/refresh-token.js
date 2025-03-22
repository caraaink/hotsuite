import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { accountNum } = req.query;

  if (!accountNum) {
    return res.status(400).json({ error: 'Account number is required' });
  }

  try {
    const instagramToken = process.env[`TOKEN_${accountNum}`];
    if (!instagramToken) {
      return res.status(500).json({ error: `Instagram token for account ${accountNum} not configured` });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${instagramToken}`,
      {
        method: 'GET',
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to refresh token: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    res.status(200).json({ token: data.access_token });
  } catch (error) {
    console.error('Error refreshing token:', error);
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request to Instagram API timed out' });
    }
    res.status(500).json({ error: 'Failed to refresh token', details: error.message });
  }
}
