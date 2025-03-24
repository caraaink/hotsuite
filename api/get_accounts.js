const axios = require('axios');

module.exports = async (req, res) => {
  const { account_key, limit = 20, after } = req.query; // Default limit 50, optional 'after' untuk pagination

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
        limit: parseInt(limit), // Batasi jumlah per request
        after: after || undefined, // Pagination cursor
      },
    });

    const pages = response.data.data;
    const igPromises = pages
      .filter(page => page.instagram_business_account)
      .slice(0, parseInt(limit)) // Pastikan tidak melebihi limit
      .map(page =>
        axios.get(`https://graph.facebook.com/v19.0/${page.instagram_business_account.id}`, {
          params: {
            access_token: token,
            fields: 'username',
          },
        })
      );

    const igResponses = await Promise.all(igPromises);
    const igAccounts = igResponses.map((igResponse, index) => ({
      type: 'ig',
      id: pages[index].instagram_business_account.id,
      username: igResponse.data.username,
    }));

    const accounts = {
      [account_key]: { accounts: igAccounts },
    };

    // Info pagination
    const pagination = response.data.paging || {};
    res.status(200).json({
      accounts,
      next: pagination.next ? pagination.cursors?.after : null, // Cursor untuk request berikutnya
      totalFetched: igAccounts.length,
    });
  } catch (error) {
    console.error('Error fetching accounts:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
};
