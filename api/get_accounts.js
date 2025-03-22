const axios = require('axios');

module.exports = async (req, res) => {
  const { account_key } = req.query;

  if (!account_key) {
    return res.status(400).json({ error: 'Missing account_key parameter' });
  }

  console.log('Fetching accounts for:', account_key);

  // Ambil semua token dari environment variables
  const tokens = {};
  for (let i = 1; i <= 11; i++) {
    const token = process.env[`TOKEN_${i}`];
    if (token) {
      tokens[`TOKEN_${i}`] = token;
    }
  }

  // Cari token yang sesuai dengan account_key
  const accountNum = account_key.split(' ')[1]; // Misalnya "Akun 10" -> "10"
  const userToken = tokens[`TOKEN_${accountNum}`];
  console.log('Using token for', account_key, ':', userToken);

  if (!userToken) {
    return res.status(400).json({ error: `No token found for ${account_key}` });
  }

  try {
    // Ambil daftar halaman Facebook yang terkait dengan token
    const pagesResponse = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
      params: {
        access_token: userToken,
      },
    });

    const pages = pagesResponse.data.data;
    console.log('Pages fetched:', pages);

    const accounts = {};
    accounts[account_key] = { accounts: [] };

    // Untuk setiap halaman, ambil akun Instagram yang terkait
    for (const page of pages) {
      const igResponse = await axios.get(`https://graph.facebook.com/v19.0/${page.id}`, {
        params: {
          fields: 'instagram_business_account',
          access_token: userToken,
        },
      });

      if (igResponse.data.instagram_business_account) {
        const igAccount = igResponse.data.instagram_business_account;
        const igDetails = await axios.get(`https://graph.facebook.com/v19.0/${igAccount.id}`, {
          params: {
            fields: 'username,name',
            access_token: userToken,
          },
        });

        accounts[account_key].accounts.push({
          type: 'ig',
          id: igAccount.id,
          name: igDetails.data.name || igDetails.data.username,
        });
      }
    }

    console.log('Accounts to return:', accounts);
    res.status(200).json({ accounts });
  } catch (error) {
    console.error('Error fetching accounts:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
};
