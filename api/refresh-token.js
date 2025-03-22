const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const SECRETS_BACKUP_PATH = path.join(__dirname, '../data/secrets.json');

module.exports = async (req, res) => {
  try {
    const config = JSON.parse(await fs.readFile(path.join(__dirname, '../config.json'), 'utf-8'));
    const tokens = {};
    for (let i = 1; i <= 11; i++) {
      if (config[`TOKEN_${i}`]) tokens[`TOKEN_${i}`] = config[`TOKEN_${i}`];
    }

    const clientId = config.CLIENT_ID;
    const clientSecret = config.CLIENT_SECRET;
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
    updatedTokens.GITHUB_TOKEN = config.GITHUB_TOKEN;

    await fs.writeFile(SECRETS_BACKUP_PATH, JSON.stringify(updatedTokens, null, 4));
    res.send(`<html><body><h1>Refresh Token Berhasil</h1><p>Token diperbarui di ${SECRETS_BACKUP_PATH}</p></body></html>`);
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).send(`<html><body><h1>Gagal Refresh Token</h1><p>Error: ${error.message}</p></body></html>`);
  }
};
