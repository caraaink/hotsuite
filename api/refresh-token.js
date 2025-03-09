const axios = require('axios');

// Pastikan default export adalah fungsi
export default async function handler(event, context) {
  try {
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const fbExchangeToken = process.env.FB_EXCHANGE_TOKEN;
    const vercelToken = process.env.VERCEL_TOKEN;
    const vercelProjectId = process.env.VERCEL_PROJECT_ID;

    // Log untuk debugging
    console.log('Client ID:', clientId);
    console.log('Client Secret:', clientSecret ? '****' : 'Not set');
    console.log('FB Exchange Token:', fbExchangeToken ? '****' : 'Not set');
    console.log('Vercel Token:', vercelToken ? '****' : 'Not set');
    console.log('Vercel Project ID:', vercelProjectId);

    if (!clientId || !clientSecret || !fbExchangeToken) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing environment variables' }),
      };
    }

    // Refresh token menggunakan endpoint Facebook
    const refreshUrl = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${fbExchangeToken}`;
    console.log('Refresh URL:', refreshUrl.replace(clientSecret, '****').replace(fbExchangeToken, '****'));

    const response = await axios.get(refreshUrl);
    const newAccessToken = response.data.access_token;
    const expiresIn = response.data.expires_in;

    // Update environment variable di Vercel (opsional)
    if (vercelToken && vercelProjectId) {
      await axios.patch(
        `https://api.vercel.com/v1/env?projectId=${vercelProjectId}&env=INSTAGRAM_ACCESS_TOKEN`,
        {
          value: newAccessToken,
          type: 'plain',
        },
        {
          headers: {
            Authorization: `Bearer ${vercelToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    }

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
      body: JSON.stringify({ error: 'Failed to refresh token', details: error.response?.data || error.message }),
    };
  }
}
