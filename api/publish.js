const { kv } = require('@vercel/kv');

const SCHEDULE_KEY = 'schedules';

module.exports = async (req, res) => {
    const { accountId, mediaUrl, caption, userToken } = req.body;

    if (!accountId || !mediaUrl || !userToken) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Langkah 1: Buat media container menggunakan Facebook Graph API untuk Instagram
        const response = await fetch(`https://graph.facebook.com/v20.0/${accountId}/media`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image_url: mediaUrl,
                caption: caption || '',
            }),
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

        // Langkah 3: Periksa apakah ada jadwal terkait dan update published
        let schedules = (await kv.get(SCHEDULE_KEY)) || [];
        const scheduleIndex = schedules.findIndex(schedule => 
            schedule.accountId === accountId && schedule.mediaUrl === mediaUrl && !schedule.published
        );

        if (scheduleIndex !== -1) {
            schedules[scheduleIndex] = {
                ...schedules[scheduleIndex],
                published: true,
            };
            await kv.set(SCHEDULE_KEY, schedules);
            console.log(`Marked schedule as published for mediaUrl: ${mediaUrl}`);
        }

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