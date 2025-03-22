const axios = require('axios');

module.exports = async (req, res) => {
  const updatedTokens = {};

  // Ambil semua token dari environment variables
  for (let i = 1; i <= 11; i++) {
    const token = process.env[`TOKEN_${i}`];
    if (token) {
      updatedTokens[`TOKEN_${i}`] = token;
    }
  }

  console.log('Tokens to return:', updatedTokens);

  try {
    // Kembalikan token yang sudah diperbarui
    res.status(200).json({ updatedTokens });
  } catch (error) {
    console.error('Error refreshing tokens:', error);
    res.status(500).json({ error: 'Failed to refresh tokens' });
  }
};
