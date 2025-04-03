const axios = require('axios');
const { kv } = require('@vercel/kv');
const { v4: uuidv4 } = require('uuid');

const SCHEDULE_KEY = 'schedules';
const CONTAINER_KEY = 'pending_container';
const TIMEOUT_MS = 25000; // 25 detik timeout

// Helper untuk membuat axios request dengan timeout
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

// Fungsi untuk membuat container ID
async function createMediaContainer(igAccountId, mediaUrl, caption, userToken, username) {
    try {
        console.log(`Creating media container for ${username}`);
        const isVideo = mediaUrl.toLowerCase().endsWith('.mp4');
        const mediaEndpoint = `https://graph.facebook.com/v19.0/${igAccountId}/media`;
        const params = {
            [isVideo ? 'video_url' : 'image_url']: mediaUrl,
            caption: caption || '',
            access_token: userToken,
            ...(isVideo && { media_type: 'REELS' }),
        };

        const mediaResponse = await axiosWithTimeout(mediaEndpoint, params);
        console.log(`Media container created for ${username}:`, mediaResponse.data);
        return { success: true, creationId: mediaResponse.data.id };
    } catch (error) {
        console.error(`Error creating media container for ${username}:`, error.response?.data || error.message);
        throw new Error(`Failed to create media container: ${error.message}`);
    }
}

// Fungsi untuk memposting ke Instagram
async function publishToInstagram(igAccountId, creationId, userToken, username) {
    try {
        console.log(`Publishing to Instagram for ${username}`);
        const publishEndpoint = `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`;
        const publishParams = {
            creation_id: creationId,
            access_token: userToken,
        };

        const publishResponse = await axiosWithTimeout(publishEndpoint, publishParams);
        console.log(`Published successfully for ${username}:`, publishResponse.data);
        return { success: true, creationId: publishResponse.data.id };
    } catch (error) {
        console.error(`Error publishing for ${username}:`, error.response?.data || error.message);
        throw new Error(`Failed to publish: ${error.message}`);
    }
}

// Fungsi untuk mendapatkan dan mengunci schedules
async function getAndLockSchedules() {
    const schedules = (await kv.get(SCHEDULE_KEY)) || [];
    return schedules;
}

// Fungsi untuk menyimpan schedules dengan retry
async function saveSchedules(schedules, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await kv.set(SCHEDULE_KEY, schedules);
            return true;
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

// Fungsi utama untuk menjalankan jadwal
async function runScheduledPosts() {
    try {
        const schedules = await getAndLockSchedules();
        if (!schedules.length) {
            console.log('No schedules available');
            return { processed: false };
        }

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
                    const newSchedules = schedules.filter(s => s.scheduleId !== pendingContainer.scheduleId);
                    await saveSchedules(newSchedules);
                    await kv.set(CONTAINER_KEY, null);
                }
            } catch (error) {
                console.error('Failed to process pending container:', error.message);
            }
        }

        // Proses jadwal baru
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
                        schedule.username
                    );

                    if (containerResult.success) {
                        const updatedSchedules = schedules.map(s =>
                            s.scheduleId === schedule.scheduleId ? { ...s, completed: true } : s
                        );
                        await saveSchedules(updatedSchedules);

                        await kv.set(CONTAINER_KEY, {
                            scheduleId: schedule.scheduleId,
                            accountId: schedule.accountId,
                            username: schedule.username,
                            creationId: containerResult.creationId,
                            userToken: schedule.userToken
                        });
                        return { processed: true };
                    }
                } catch (error) {
                    console.error(`Failed to process schedule ${schedule.scheduleId}:`, error.message);
                }
                break;
            }
        }

        return { processed: false };
    } catch (error) {
        console.error('Error in runScheduledPosts:', error.message);
        throw error;
    }
}

// Vercel Serverless Function
module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'POST') {
        const { accountId, username, mediaUrl, time, userToken, accountNum, caption = '' } = req.body;

        if (!accountId || !mediaUrl || !time || !userToken || !accountNum || !username) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        try {
            const schedules = await getAndLockSchedules();
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
            };
            
            await saveSchedules([...schedules, newSchedule]);
            return res.status(200).json({ 
                message: 'Post scheduled successfully', 
                scheduleId: newSchedule.scheduleId 
            });
        } catch (error) {
            console.error('Error saving schedule:', error.message);
            return res.status(500).json({ error: `Failed to save schedule: ${error.message}` });
        }
    }

    if (req.method === 'GET') {
        try {
            const result = await runScheduledPosts();
            return res.status(200).json({ 
                message: result.processed ? 'Schedule processed' : 'No schedules processed' 
            });
        } catch (error) {
            return res.status(500).json({ error: `Scheduler failed: ${error.message}` });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
