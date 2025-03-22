import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { account_key } = req.query;

  if (!account_key) {
    return res.status(400).json({ error: 'Account key is required' });
  }

  const accountNum = account_key.split(' ')[1];
  const instagramToken = process.env[`TOKEN_${accountNum}`];

  if (!instagramToken) {
    return res.status(500).json({ error: `Instagram token for account ${accountNum} not configured` });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://graph.instagram.com/me/accounts', {
      headers: {
        Authorization: `Bearer ${instagramToken}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch Instagram accounts: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    res.status(200).json({ accounts: { [account_key]: data } });
  } catch (error) {
    console.error('Error fetching Instagram accounts:', error);
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request to Instagram API timed out' });
    }
    res.status(500).json({ error: 'Failed to fetch accounts', details: error.message });
  }
}
