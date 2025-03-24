const axios = require('axios');

module.exports = async (req, res) => {
  const { account_key } = req.query;

  if (!account_key) {
    return res.status(400).json({ error: 'Missing account_key parameter' });
  }

  const accountNum = account_key.split(' ')[1];
  const token = process.env[`TOKEN_${accountNum}`];

  if (!token) {
    return res.status(404).json({ error: `No token found for ${account_key}` });
  }

  try {
    const response = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
      params: {
        access_token: token,
        fields: 'id,name,instagram_business_account',
        limit: 200 // Maksimum 200, tapi bisa kurang
      },
    });

    const partners = response.data.data; // Jumlah data tergantung pada yang tersedia
    const igAccounts = [];
    let count = 0;
    const MAX_LIMIT = 200;

    for (const partner of partners) {
      if (partner.instagram_business_account && count < MAX_LIMIT) {
        const igResponse = await axios.get(`https://graph.facebook.com/v19.0/${partner.instagram_business_account.id}`, {
          params: {
            access_token: token,
            fields: 'username',
          },
        });
        igAccounts.push({
          type: 'ig',
          id: partner.instagram_business_account.id,
          username: igResponse.data.username,
        });
        count++;
      }
      if (count >= MAX_LIMIT) break;
    }

    const accounts = {
      [account_key]: { accounts: igAccounts },
    };

    res.status(200).json({ accounts });
  } catch (error) {
    console.error('Error fetching accounts:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
};
