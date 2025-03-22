const axios = require('axios');

module.exports = async (req, res) => {
  try {
    const tokens = {};
    for (let i = 1; i <= 11; i++) {
      if (process.env[`TOKEN_${i}`]) tokens[`TOKEN_${i}`] = process.env[`TOKEN_${i}`];
    }

    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const updatedTokens = {};

    for (const [key, token] of Object.entries(tokens)) {
      const response = await axios.get('https://graph.facebook.com/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: clientId,
          client_secret: clientSecret,
          fb_exchange_token: token,
        },
      });

      if (response.data.access_token) {
        updatedTokens[key] = response.data.access_token;
      }
    }

    updatedTokens.CLIENT_ID = clientId;
    updatedTokens.CLIENT_SECRET = clientSecret;
    updatedTokens.GITHUB_TOKEN = process.env.GITHUB_TOKEN;

    // Karena Vercel serverless tidak bisa simpan file permanen, kembalikan sebagai JSON
    res.status(200).json({
      message: 'Tokens refreshed successfully',
      updatedTokens,
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).send(`<html><body><h1>Gagal Refresh Token</h1><p>Error: ${error.message}</p></body></html>`);
  }
};
