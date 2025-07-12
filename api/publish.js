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

    // Validate required fields
    if (!accountId || !mediaUrl || !userToken) {
        console.error('Missing fields:', { accountId, mediaUrl, userToken });
        return res.status(400).json({ error: 'Missing required fields', details: { accountId, mediaUrl, userToken } });
    }

    // Validate mediaType
    if (!['image', 'REELS', 'video'].includes(mediaType)) {
        console.error('Invalid mediaType:', mediaType);
        return res.status(400).json({ error: 'Invalid mediaType', details: { mediaType } });
    }

    // Decode caption
    if (caption) {
        try {
            caption = decodeURIComponent(caption);
        } catch (e) {
            console.error('Error decoding caption:', e.message);
        }
    }

    try {
        // Determine if the media is a video/reel
        const isVideo = mediaType === 'video' || mediaType === 'REELS';
        const mediaPayload = isVideo
            ? {
                  video_url: mediaUrl,
                  caption: caption || '',
                  media_type: 'REELS' // Explicitly set to REELS for video content
              }
            : {
                  image_url: mediaUrl,
                  caption: caption || ''
              };

        console.log('Media Payload:', mediaPayload);

        // Step 1: Create media container
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

        console.log('Media Container Created:', { mediaId });

        // Step 2: Check media container status
        let status = 'IN_PROGRESS';
        let attempts = 0;
        const maxAttempts = 10;
        while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
            const statusResponse = await fetch(`https://graph.facebook.com/v20.0/${mediaId}?fields=status_code`, {
                headers: { 'Authorization': `Bearer ${userToken}` },
            });
            if (!statusResponse.ok) {
                const errorData = await statusResponse.json();
                throw new Error(`HTTP error checking media status: ${statusResponse.status} - ${JSON.stringify(errorData)}`);
            }
            const statusData = await statusResponse.json();
            status = statusData.status_code;
            console.log('Media Status Check:', { attempt: attempts + 1, status });
            if (status !== 'FINISHED') {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between checks
                attempts++;
            }
        }

        if (status !== 'FINISHED') {
            throw new Error(`Media container not ready after ${maxAttempts} attempts, final status: ${status}`);
        }

        // Step 3: Publish media
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
        console.log('Publish Response:', publishData);
        res.status(200).json({ message: 'Berhasil dipublikasikan ke Instagram!', publishData });
    } catch (error) {
        console.error('Error publishing to Instagram:', error.message);
        try {
            const errorLogKey = `publish_error:${Date.now()}`;
            await kv.set(errorLogKey, {
                timestamp: new Date().toISOString(),
                accountId,
                mediaUrl,
                mediaType,
                error: error.message,
            }, { ex: 604800 });
        } catch (kvError) {
            console.error('Error saving to KV:', kvError);
        }
        res.status(500).json({ error: 'Failed to publish to Instagram', details: error.message });
    }
};
