const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
    const { accountId, mediaUrl, caption, userToken, mediaType } = req.body;

    if (!accountId || !mediaUrl || !userToken) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Tentukan apakah ini gambar atau Reels berdasarkan mediaType
        const isVideo = mediaType === 'REELS';
        const mediaPayload = isVideo
            ? { video_url: mediaUrl, caption: caption || '', media_type: 'REELS' } // Ubah ke REELS untuk video
            : { image_url: mediaUrl, caption: caption || '' };

        // Langkah 1: Buat media container menggunakan Facebook Graph API untuk Instagram
        const response = await fetch(`https://graph.facebook.com/v20.0/${accountId}/media`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(mediaPayload),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error creating media container: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        const mediaId = data.id;

        if (!mediaId) {
            throw new Error('Media ID not returned from Facebook Graph API');
        }

        // Langkah 2: Publikasikan media
        const publishResponse = await fetch(`https://graph.facebook.com/v20.0/${accountId}/media_publish`, {
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
            const errorData = await publishResponse.json();
            throw new Error(`HTTP error publishing media: ${publishResponse.status} - ${JSON.stringify(errorData)}`);
        }

        const publishData = await publishResponse.json();
        res.status(200).json({ message: 'Berhasil dipublikasikan ke Instagram!', publishData });
    } catch (error) {
        console.error('Error publishing to Instagram:', error.message);
        // Simpan error ke @vercel/kv untuk debugging
        try {
            const errorLogKey = `publish_error:${Date.now()}`;
            await kv.set(errorLogKey, {
                timestamp: new Date().toISOString(),
                accountId,
                mediaUrl,
                error: error.message,
            }, { ex: 604800 }); // Simpan selama 7 hari
        } catch (kvError) {
            console.error('Error saving to KV:', kvError);
        }
        res.status(500).json({ error: 'Failed to publish to Instagram', details: error.message });
    }
};
