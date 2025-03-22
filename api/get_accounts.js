import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req, res) {
  const { account_key } = req.query;

  if (!account_key) {
    return res.status(400).json({ error: 'Account key is required' });
  }

  const accountNum = account_key.split(' ')[1];
  const facebookToken = process.env[`TOKEN_${accountNum}`];

  if (!facebookToken) {
    return res.status(500).json({ error: `Facebook token for account ${accountNum} not configured` });
  }

  try {
    // Mengambil akun Instagram yang terkait dengan user Facebook
    const response = await axios.get('https://graph.facebook.com/v20.0/me/accounts', {
      headers: {
        Authorization: `Bearer ${facebookToken}`,
      },
      timeout: 5000, // Timeout 5 detik
    });

    const data = response.data;

    // Filter untuk hanya mengambil akun yang memiliki Instagram Business Account
    const instagramAccounts = await Promise.all(
      data.data.map(async (account) => {
        const igResponse = await axios.get(
          `https://graph.facebook.com/v20.0/${account.id}?fields=instagram_business_account&access_token=${facebookToken}`,
          { timeout: 5000 }
        );
        const igData = igResponse.data;
        if (igData.instagram_business_account) {
          return {
            id: account.id,
            name: account.name,
            instagram_business_account: igData.instagram_business_account.id,
          };
        }
        return null;
      })
    );

    const filteredAccounts = instagramAccounts.filter((account) => account !== null);

    res.status(200).json({ accounts: { [account_key]: filteredAccounts } });
  } catch (error) {
    console.error('Error fetching Facebook accounts:', error);
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Request to Facebook API timed out' });
    }
    res.status(500).json({ error: 'Failed to fetch accounts', details: error.message });
  }
}
