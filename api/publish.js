const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
    const { accountId, mediaUrl, caption, userToken } = req.body;

    if (!accountId || !mediaUrl || !userToken) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Logika untuk mempublikasikan ke Instagram
        // Misalnya menggunakan API Instagram (contoh sederhana)
        const response = await fetch(`https://graph.instagram.com/v12.0/${accountId}/media`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image_url: mediaUrl,
                caption: caption,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error publishing to Instagram! status: ${response.status}`);
        }

        const data = await response.json();
        const mediaId = data.id;

        // Publikasikan media
        const publishResponse = await fetch(`https://graph.instagram.com/v12.0/${accountId}/media_publish`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                creation_id: mediaId,
            }),
        });

        if (!publishResponse.ok) {
            throw new Error(`HTTP error publishing media! status: ${publishResponse.status}`);
        }

        res.status(200).json({ message: 'Berhasil dipublikasikan ke Instagram!' });
    } catch (error) {
        console.error('Error publishing to Instagram:', error);
        res.status(500).json({ error: 'Failed to publish to Instagram' });
    }
};
