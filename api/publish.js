import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accountId, mediaUrl, caption, userToken, accountNum } = req.body;

    if (!accountId || !mediaUrl || !userToken || !accountNum) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const facebookToken = process.env[`TOKEN_${accountNum}`];
    if (!facebookToken || facebookToken !== userToken) {
      return res.status(401).json({ error: 'Invalid or mismatched token for this account' });
    }

    // Ambil Instagram Business Account ID dari Page ID (accountId)
    const igAccountResponse = await axios.get(
      `https://graph.facebook.com/v20.0/${accountId}?fields=instagram_business_account&access_token=${facebookToken}`,
      { timeout: 5000 }
    );

    const igAccountData = igAccountResponse.data;
    const igBusinessAccountId = igAccountData.instagram_business_account?.id;

    if (!igBusinessAccountId) {
      return res.status(400).json({ error: 'No Instagram Business Account linked to this Page' });
    }

    // Publikasikan postingan ke Instagram Business Account
    const response = await axios.post(
      `https://graph.facebook.com/v20.0/${igBusinessAccountId}/media`,
      {
        image_url: mediaUrl,
        caption: caption || '',
      },
      {
        headers: {
          Authorization: `Bearer ${facebookToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );

    const data = response.data;

    // Publikasikan media yang baru dibuat
    const publishResponse = await axios.post(
      `https://graph.facebook.com/v20.0/${igBusinessAccountId}/media_publish`,
      {
        creation_id: data.id,
      },
      {
        headers: {
          Authorization: `Bearer ${facebookToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );

    const publishData = publishResponse.data;
    res.status(200).json({ message: 'Published successfully', data: publishData });
  } catch (error) {
    console.error('Error publishing to Instagram:', error);
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Request to Facebook API timed out' });
    }
    res.status(500).json({ error: 'Failed to publish', details: error.message });
  }
}
