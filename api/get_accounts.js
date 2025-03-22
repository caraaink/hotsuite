const axios = require('axios');

module.exports = async (req, res) => {
  const { account_key } = req.query;
  if (!account_key || !account_key.match(/^Akun \d+$/)) {
    return res.status(400).json({ message: 'Invalid account_key format! Use "Akun X"' });
  }

  const accountNum = parseInt(account_key.split(' ')[1]);
  if (accountNum < 1 || accountNum > 11) {
    return res.status(400).json({ message: 'account_key must be between Akun 1 and Akun 11' });
  }

  const userToken = process.env[`TOKEN_${accountNum}`];
  if (!userToken) {
    return res.status(400).json({ message: `Token for ${account_key} not found` });
  }

  try {
    const response = await axios.get(`https://graph.facebook.com/v19.0/me/accounts`, {
      params: {
        fields: 'name,id,instagram_business_account{id,username,name}',
        access_token: userToken,
      },
    });

    const accounts = response.data.data.map(page => {
      if (page.instagram_business_account) {
        return {
          type: 'ig',
          id: page.instagram_business_account.id,
          name: page.instagram_business_account.username || page.instagram_business_account.name,
          page_name: page.name,
          page_id: page.id,
        };
      }
      return null;
    }).filter(acc => acc);

    res.status(200).json({
      accounts: {
        [account_key]: { token: userToken, accounts },
      },
    });
  } catch (error) {
    console.error('Error fetching accounts:', error.response?.data || error.message);
    res.status(500).json({ message: `Failed to fetch accounts: ${error.message}` });
  }
};
