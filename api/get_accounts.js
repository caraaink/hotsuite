const axios = require('axios');

module.exports = async (req, res) => {
  const { account_key } = req.query;

  if (!account_key) {
    return res.status(400).json({ error: 'Missing account_key parameter' });
  }

  const accountNum = account_key.split(' ')[1]; // Ambil nomor akun (misalnya "10" dari "Akun 10")
  const token = process.env[`TOKEN_${accountNum}`];

  if (!token) {
    return res.status(404).json({ error: `No token found for ${account_key}` });
  }

  try {
    // Ambil daftar akun Instagram yang terkait dengan token
    const response = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
      params: {
        access_token: token,
        fields: 'id,name,instagram_business_account',
      },
    });

    const pages = response.data.data;
    const igAccounts = [];

    for (const page of pages) {
      if (page.instagram_business_account) {
        const igResponse = await axios.get(`https://graph.facebook.com/v19.0/${page.instagram_business_account.id}`, {
          params: {
            access_token: token,
            fields: 'username',
          },
        });
        igAccounts.push({
          type: 'ig',
          id: page.instagram_business_account.id,
          username: igResponse.data.username,
        });
      }
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
