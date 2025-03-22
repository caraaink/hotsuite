const axios = require('axios');

module.exports = async (req, res) => {
  try {
    const tokens = {};
    for (let i = 1; i <= 11; i++) {
      if (process.env[`TOKEN_${i}`]) {
        tokens[`TOKEN_${i}`] = process.env[`TOKEN_${i}`];
      } else {
        console.warn(`TOKEN_${i} not found in environment variables`);
      }
    }

    if (Object.keys(tokens).length === 0) {
      return res.status(500).json({ message: 'No tokens found in environment variables' });
    }

    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(500).json({ message: 'CLIENT_ID or CLIENT_SECRET not found in environment variables' });
    }

    const updatedTokens = {};

    for (const [key, token] of Object.entries(tokens)) {
      try {
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
        } else {
          console.warn(`Failed to refresh ${key}: No access token returned`);
        }
      } catch (error) {
        console.error(`Error refreshing ${key}:`, error.response?.data || error.message);
      }
    }

    updatedTokens.CLIENT_ID = clientId;
    updatedTokens.CLIENT_SECRET = clientSecret;
    updatedTokens.GITHUB_TOKEN = process.env.GITHUB_TOKEN;

    if (Object.keys(updatedTokens).length === 0) {
      return res.status(500).json({ message: 'Failed to refresh any tokens' });
    }

    res.status(200).json({
      message: 'Tokens refreshed successfully',
      updatedTokens,
    });
  } catch (error) {
    console.error('Error in refresh-token:', error);
    res.status(500).json({ message: `Failed to refresh tokens: ${error.message}` });
  }
};
