const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
    console.log('Request Method:', req.method);
    console.log('req.body:', req.body);
    console.log('req.query:', req.query);

    const body = req.body || {};
    const query = req.query || {};

    const accountId = body.accountId || query.accountId || null;
    const mediaUrl = body.mediaUrl || query.mediaUrl || null;
    let caption = body.caption || query.caption || null;
    const userToken = body.userToken || query.access_token || null;
    const mediaType = body.mediaType || query.mediaType || null;

    if (!accountId || !mediaUrl || !userToken) {
        console.error('Missing fields:', { accountId, mediaUrl, userToken });
        return res.status(400).json({ error: 'Missing required fields', details: { accountId, mediaUrl, userToken } });
    }

    if (caption) {
        try {
            caption = decodeURIComponent(caption);
        } catch (e) {
            console.error('Error decoding caption:', e.message);
        }
    }

    try {
        // Check for both 'video' and 'REELS' to handle video/reels media
        const isVideo = mediaType === 'video' || mediaType === 'REELS';
        const mediaPayload = isVideo
            ? { video_url: mediaUrl, caption: caption || '', media_type: 'REELS' }
            : { image_url: mediaUrl, caption: caption || '' };

        console.log('Media Payload:', mediaPayload);

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
        try {
            const errorLogKey = `publish_error:${Date.now()}`;
            await kv.set(errorLogKey, {
                timestamp: new Date().toISOString(),
                accountId,
                mediaUrl,
                error: error.message,
            }, { ex: 604800 });
        } catch (kvError) {
            console.error('Error saving to KV:', kvError);
        }
        res.status(500).json({ error: 'Failed to publish to Instagram', details: error.message });
    }
};
