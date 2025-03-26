const axios = require('axios');

module.exports = async (req, res) => {
  const { accountNum } = req.query;

  if (!accountNum) {
    return res.status(400).json({ error: 'Missing accountNum parameter' });
  }

  try {
    const token = process.env[`TOKEN_${accountNum}`];
    if (!token) {
      return res.status(404).json({ error: `No token found for Akun ${accountNum}` });
    }

    console.log(`Token for Akun ${accountNum}:`, token);
    res.status(200).json({ token });
  } catch (error) {
    console.error('Error fetching token:', error);
    res.status(500).json({ error: 'Failed to fetch token' });
  }
};
