import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { account_key } = req.query;

  if (!account_key) {
    return res.status(400).json({ error: 'Account key is required' });
  }

  try {
    const response = await fetch('https://graph.instagram.com/me/accounts', {
      headers: {
        Authorization: `Bearer ${process.env.INSTAGRAM_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Instagram accounts: ${response.statusText}`);
    }

    const data = await response.json();
    res.status(200).json({ accounts: { [account_key]: data } });
  } catch (error) {
    console.error('Error fetching Instagram accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts', details: error.message });
  }
}
