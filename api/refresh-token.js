import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req, res) {
  const { accountNum } = req.query;

  if (!accountNum) {
    return res.status(400).json({ error: 'Account number is required' });
  }

  try {
    const facebookToken = process.env[`TOKEN_${accountNum}`];
    if (!facebookToken) {
      return res.status(500).json({ error: `Facebook token for account ${accountNum} not configured` });
    }

    const response = await axios.get(
      `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&fb_exchange_token=${facebookToken}`,
      { timeout: 5000 }
    );

    const data = response.data;
    res.status(200).json({ token: data.access_token });
  } catch (error) {
    console.error('Error refreshing token:', error);
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Request to Facebook API timed out' });
    }
    res.status(500).json({ error: 'Failed to refresh token', details: error.message });
  }
}
