const axios = require('axios');

const accounts = {
  'Akun 1': { accounts: [] },
  'Akun 2': { accounts: [] },
  'Akun 3': { accounts: [] },
  'Akun 4': { accounts: [] },
  'Akun 5': { accounts: [] },
  'Akun 6': { accounts: [] },
  'Akun 7': { accounts: [] },
  'Akun 8': { accounts: [] },
  'Akun 9': { accounts: [] },
  'Akun 10': {
    accounts: [
      { type: 'ig', id: '17841472886987230', username: 'cikacantika' },
      { type: 'ig', id: '17841472886987231', username: 'meownime' },
    ],
  },
  'Akun 11': { accounts: [] },
};

module.exports = async (req, res) => {
  const { account_key } = req.query;

  if (!account_key) {
    return res.status(400).json({ error: 'Missing account_key parameter' });
  }

  try {
    if (accounts[account_key]) {
      res.status(200).json({ accounts });
    } else {
      res.status(404).json({ error: `No accounts found for ${account_key}` });
    }
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
};
