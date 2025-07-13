const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
    // Log input for debugging
    console.log('Request Method:', req.method);
    console.log('req.body:', req.body);
    console.log('req.query:', req.query);

    // Ambil data dari req.body atau req.query, dengan fallback ke objek kosong
    const body = req.body || {};
    const query = req.query || {};

    // Prioritaskan req.body, fallback ke req.query
    const accountId = body.accountId || query.accountId || null;
    const mediaUrl = body.mediaUrl || query.mediaUrl || null;
    let caption = body.caption || query.caption || null;
    const userToken = body.userToken || query.access_token || null;
    const mediaType = body.mediaType || query.mediaType || null;

    // Validasi field yang diperlukan
    if (!accountId || !mediaUrl || !userToken) {
        console.error('Missing fields:', { accountId, mediaUrl, userToken });
        return res.status(400).json({ error: 'Missing required fields', details: { accountId, mediaUrl, userToken } });
    }

    // Decode caption to handle URL-encoded characters (e.g., %2C for commas)
    if (caption) {
        try {
            caption = decodeURIComponent(caption);
        } catch (e) {
            console.error('Error decoding caption:', e.message);
        }
    }

    try {
        // Tentukan apakah ini gambar atau video berdasarkan mediaType
        const isVideo = mediaType === 'video';
        const mediaPayload = isVideo
            ? { video_url: mediaUrl, caption: caption || '', media_type: 'REELS' }
            : { image_url: mediaUrl, caption: caption || '' };

        // Log payload untuk debugging
        console.log('Media Payload:', mediaPayload);

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
            }, { ex: 86400 }); // Simpan selama 24 Jam
        } catch (kvError) {
            console.error('Error saving to KV:', kvError);
        }
        res.status(500).json({ error: 'Failed to publish to Instagram', details: error.message });
    }
};
