const axios = require('axios');

// Pastikan default export adalah fungsi
export default async function handler(event, context) {
  try {
    // Ambil token dari environment variables
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    if (!accessToken) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Access token not found' }),
      };
    }

    // Data dari request
    const { imageUrl, caption } = JSON.parse(event.body || '{}');
    if (!imageUrl || !caption) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Image URL and caption are required' }),
      };
    }

    // Buat media object
    const mediaResponse = await axios.post(
      `https://graph.facebook.com/v19.0/17841402777728356/media`,
      {
        image_url: imageUrl,
        caption: caption,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        params: { access_token: accessToken },
      }
    );

    const creationId = mediaResponse.data.id;

    // Publikasikan postingan
    const publishResponse = await axios.post(
      `https://graph.facebook.com/v19.0/17841402777728356/media_publish`,
      {
        creation_id: creationId,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        params: { access_token: accessToken },
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Post successfully created',
        postId: publishResponse.data.id,
      }),
    };
  } catch (error) {
    console.error('Error posting to Instagram:', error.response?.data || error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to post to Instagram', details: error.message }),
    };
  }
}
