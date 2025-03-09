const axios = require('axios');

exports.handler = async (event, context) => {
  try {
    // Ambil environment variables
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const fbExchangeToken = process.env.FB_EXCHANGE_TOKEN; // Token awal untuk exchange

    if (!clientId || !clientSecret || !fbExchangeToken) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing environment variables' }),
      };
    }

    // Refresh token menggunakan endpoint Facebook
    const refreshUrl = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${fbExchangeToken}`;
    const response = await axios.get(refreshUrl);

    const newAccessToken = response.data.access_token;
    const expiresIn = response.data.expires_in; // Biasanya 5184000 detik (60 hari)

    // Update environment variable di Vercel (manual atau via API Vercel)
    process.env.INSTAGRAM_ACCESS_TOKEN = newAccessToken;

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Token refreshed successfully',
        newAccessToken: newAccessToken,
        expiresIn: expiresIn,
      }),
    };
  } catch (error) {
    console.error('Error refreshing token:', error.response?.data || error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to refresh token', details: error.message }),
    };
  }
};
