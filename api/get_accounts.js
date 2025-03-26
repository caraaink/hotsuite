const axios = require('axios');

module.exports = async (req, res) => {
  const { account_key, limit = 20, after } = req.query; // Default limit 20, tambah parameter 'after' untuk pagination

  if (!account_key) {
    return res.status(400).json({ error: 'Missing account_key parameter' });
  }

  const accountNum = account_key.split(' ')[1];
  const token = process.env[`TOKEN_${accountNum}`];

  if (!token) {
    return res.status(404).json({ error: `No token found for ${account_key}` });
  }

  try {
    // Ambil daftar akun dari Facebook Graph API dengan pagination
    const response = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
      params: {
        access_token: token,
        fields: 'id,name,instagram_business_account',
        limit: parseInt(limit), // Gunakan limit dari query atau default 20
        after: after || undefined, // Cursor untuk pagination
      },
    });

    const partners = response.data.data; // Data akun dari respons
    const igAccounts = [];
    const MAX_LIMIT = 200; // Batas maksimal total akun

    // Proses hanya sejumlah 'limit' akun per request
    const promises = partners
      .filter(partner => partner.instagram_business_account) // Filter yang punya IG account
      .slice(0, parseInt(limit)) // Batasi sesuai limit per page
      .map(partner =>
        axios.get(`https://graph.facebook.com/v19.0/${partner.instagram_business_account.id}`, {
          params: {
            access_token: token,
            fields: 'username',
          },
        }).then(igResponse => ({
          type: 'ig',
          id: partner.instagram_business_account.id,
          username: igResponse.data.username || 'unknown', // Default 'unknown' jika username undefined
        })).catch(err => {
          console.error(`Error fetching IG account ${partner.instagram_business_account.id}:`, err.message);
          return null; // Kembalikan null jika gagal, akan difilter nanti
        })
      );

    // Jalankan request paralel untuk efisiensi
    const results = await Promise.all(promises);
    igAccounts.push(...results.filter(acc => acc !== null)); // Tambahkan hanya akun yang valid

    const accounts = {
      [account_key]: { accounts: igAccounts },
    };

    // Tambahkan info pagination ke respons
    const pagination = response.data.paging || {};
    res.status(200).json({
      accounts,
      next: pagination.next ? pagination.cursors?.after : null, // Cursor untuk halaman berikutnya
      totalFetched: igAccounts.length,
    });
  } catch (error) {
    console.error('Error fetching accounts:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
};
