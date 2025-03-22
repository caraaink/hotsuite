import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { accountNum } = req.query;

  if (!accountNum) {
    return res.status(400).json({ error: 'Account number is required' });
  }

  try {
    const response = await fetch('https://graph.instagram.com/refresh_access_token', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.INSTAGRAM_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.statusText}`);
    }

    const data = await response.json();
    res.status(200).json({ token: data.access_token });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ error: 'Failed to refresh token', details: error.message });
  }
}
