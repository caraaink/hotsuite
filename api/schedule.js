const axios = require('axios');
const { kv } = require('@vercel/kv');
const { v4: uuidv4 } = require('uuid');

const SCHEDULE_KEY = 'schedules';
const CONTAINER_KEY = 'pending_container';
const TIMEOUT_MS = 8000; // 8 detik, lebih pendek dari batas Vercel 10 detik

// Axios dengan timeout ketat
const axiosWithTimeout = async (url, params, timeoutMs = TIMEOUT_MS) => {
    const source = axios.CancelToken.source();
    const timeout = setTimeout(() => source.cancel('Request timeout'), timeoutMs);
    try {
        const response = await axios.post(url, params, { cancelToken: source.token });
        clearTimeout(timeout);
        return response;
    } catch (error) {
        clearTimeout(timeout);
        throw error;
    }
};

// Fungsi untuk membuat container
async function createMediaContainer(igAccountId, mediaUrl, caption, userToken, username, mediaType) {
    const isVideo = mediaType === 'video';
    const mediaEndpoint = `https://graph.facebook.com/v19.0/${igAccountId}/media`;
    const params = {
        [isVideo ? 'video_url' : 'image_url']: mediaUrl,
        caption: caption || '',
        access_token: userToken,
        ...(isVideo && { media_type: 'REELS' }), // Gunakan REELS untuk video
    };
    const mediaResponse = await axiosWithTimeout(mediaEndpoint, params);
    return { success: true, creationId: mediaResponse.data.id };
}

// Fungsi untuk memposting
async function publishToInstagram(igAccountId, creationId, userToken, username) {
    const publishEndpoint = `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`;
    const publishParams = {
        creation_id: creationId,
        access_token: userToken,
    };
    const publishResponse = await axiosWithTimeout(publishEndpoint, publishParams);
    return { success: true, creationId: publishResponse.data.id };
}

// Fungsi utama scheduler
async function runScheduledPosts() {
    const now = new Date().getTime();
    const pendingContainer = await kv.get(CONTAINER_KEY);

    // Proses pending container terlebih dahulu
    if (pendingContainer) {
        try {
            const publishResult = await publishToInstagram(
                pendingContainer.accountId,
                pendingContainer.creationId,
                pendingContainer.userToken,
                pendingContainer.username
            );
            if (publishResult.success) {
                const schedules = await kv.get(SCHEDULE_KEY) || [];
                const newSchedules = schedules.filter(s => s.scheduleId !== pendingContainer.scheduleId);
                await kv.set(SCHEDULE_KEY, newSchedules);
                await kv.set(CONTAINER_KEY, null);
                console.log(`Published and cleaned up for ${pendingContainer.username}`);
                return { processed: true };
            }
        } catch (error) {
            console.error(`Publish failed for ${pendingContainer.username}:`, error.message);
            return { processed: false, error: error.message };
        }
    }

    // Proses jadwal baru (hanya satu per eksekusi)
    const schedules = await kv.get(SCHEDULE_KEY) || [];
    if (!schedules.length) return { processed: false };

    const sortedSchedules = schedules
        .map(s => ({
            ...s,
            timeUTC: new Date(s.time + ':00').getTime() - 7 * 60 * 60 * 1000
        }))
        .sort((a, b) => a.timeUTC - b.timeUTC);

    for (const schedule of sortedSchedules) {
        if (now >= schedule.timeUTC && !schedule.completed) {
            try {
                const containerResult = await createMediaContainer(
                    schedule.accountId,
                    schedule.mediaUrl,
                    schedule.caption,
                    schedule.userToken,
                    schedule.username,
                    schedule.mediaType // Tambahkan mediaType ke argumen
                );
                if (containerResult.success) {
                    const updatedSchedules = schedules.map(s =>
                        s.scheduleId === schedule.scheduleId ? { ...s, completed: true } : s
                    );
                    await kv.set(SCHEDULE_KEY, updatedSchedules);
                    await kv.set(CONTAINER_KEY, {
                        scheduleId: schedule.scheduleId,
                        accountId: schedule.accountId,
                        username: schedule.username,
                        creationId: containerResult.creationId,
                        userToken: schedule.userToken
                    });
                    console.log(`Container created for ${schedule.username}`);
                    return { processed: true };
                }
            } catch (error) {
                console.error(`Container creation failed for ${schedule.username}:`, error.message);
                return { processed: false, error: error.message };
            }
            break; // Hanya proses satu jadwal
        }
    }
    return { processed: false };
}

// Vercel Serverless Function
module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'POST') {
        const { accountId, username, mediaUrl, time, userToken, accountNum, caption = '', mediaType } = req.body;
        if (!accountId || !mediaUrl || !time || !userToken || !accountNum || !username) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        try {
            const schedules = await kv.get(SCHEDULE_KEY) || [];
            const newSchedule = {
                scheduleId: uuidv4(),
                accountId,
                username,
                mediaUrl,
                caption,
                time,
                userToken,
                accountNum,
                completed: false,
                mediaType, // Simpan mediaType di jadwal
            };
            await kv.set(SCHEDULE_KEY, [...schedules, newSchedule]);
            return res.status(200).json({ message: 'Post scheduled', scheduleId: newSchedule.scheduleId });
        } catch (error) {
            console.error('Schedule save failed:', error.message);
            return res.status(500).json({ error: `Failed to save: ${error.message}` });
        }
    }

    if (req.method === 'GET') {
        try {
            const result = await runScheduledPosts();
            // Jika processed: true, kembalikan respons tanpa properti error
            if (result.processed) {
                return res.status(200).json({ message: 'Processed successfully' });
            }
            // Jika tidak ada yang diproses, tetap kembalikan tanpa error
            return res.status(200).json({ message: 'No tasks processed' });
        } catch (error) {
            console.error('Scheduler failed:', error.message);
            // Hanya sertakan properti error jika benar-benar ada error
            return res.status(500).json({ message: 'Scheduler failed', error: error.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
