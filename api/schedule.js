const axios = require('axios');
const { kv } = require('@vercel/kv');
const { v4: uuidv4 } = require('uuid');

const SCHEDULE_KEY = 'schedules';
const CONTAINER_KEY = 'pending_container';
const STATE_KEY = 'scheduler_state'; // Key baru untuk melacak state

// Fungsi untuk membuat container ID tanpa langsung memposting
async function createMediaContainer(igAccountId, mediaUrl, caption, userToken, username) {
    try {
        console.log(`Creating media container for ${username} with params:`, { igAccountId, mediaUrl, caption });
        const isVideo = mediaUrl.toLowerCase().endsWith('.mp4');
        const mediaEndpoint = `https://graph.facebook.com/v19.0/${igAccountId}/media`;
        const params = {
            [isVideo ? 'video_url' : 'image_url']: mediaUrl,
            caption: caption || '',
            access_token: userToken,
            ...(isVideo && { media_type: 'REELS' }),
        };

        const mediaResponse = await axios.post(mediaEndpoint, params);
        console.log(`Media container created for ${username}:`, mediaResponse.data);
        return { success: true, creationId: mediaResponse.data.id };
    } catch (error) {
        console.error(`Error creating media container for ${username}:`, error.response?.data || error.message);
        throw new Error(`Failed to create media container for ${username}: ${error.message}`);
    }
}

// Fungsi untuk memposting ke Instagram menggunakan container ID
async function publishToInstagram(igAccountId, creationId, userToken, username) {
    try {
        console.log(`Publishing to Instagram for ${username} with creationId:`, creationId);
        const publishEndpoint = `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`;
        const publishParams = {
            creation_id: creationId,
            access_token: userToken,
        };

        const publishResponse = await axios.post(publishEndpoint, publishParams);
        console.log(`Instagram API publish response for ${username}:`, publishResponse.data);
        return { success: true, creationId: publishResponse.data.id };
    } catch (error) {
        console.error(`Error publishing to Instagram for ${username}:`, error.response?.data || error.message);
        throw new Error(`Failed to publish to Instagram for ${username}: ${error.message}`);
    }
}

// Fungsi utama untuk menjalankan jadwal dengan state tracking
async function runScheduledPosts() {
    try {
        let schedules = (await kv.get(SCHEDULE_KEY)) || [];
        let state = (await kv.get(STATE_KEY)) || { step: 'create' }; // Default ke 'create' jika belum ada state
        
        if (!schedules || schedules.length === 0) {
            console.log('No schedules available to process.');
            return { message: 'No schedules to process' };
        }

        const now = new Date();
        const nowUTC = now.getTime();
        const sortedSchedules = schedules
            .map(schedule => ({
                ...schedule,
                timeUTC: new Date(schedule.time + ':00').getTime() - 7 * 60 * 60 * 1000
            }))
            .sort((a, b) => a.timeUTC - b.timeUTC);

        const pendingContainer = (await kv.get(CONTAINER_KEY)) || null;

        if (state.step === 'create' && !pendingContainer) {
            // Langkah 1: Buat container untuk jadwal pertama dan tandai sebagai completed
            for (const schedule of sortedSchedules) {
                if (!schedules.some(s => s.scheduleId === schedule.scheduleId)) continue;

                const scheduledTimeUTC = new Date(schedule.time + ':00').getTime() - 7 * 60 * 60 * 1000;
                if (nowUTC >= scheduledTimeUTC && !schedule.completed) {
                    const containerResult = await createMediaContainer(
                        schedule.accountId,
                        schedule.mediaUrl,
                        schedule.caption,
                        schedule.userToken,
                        schedule.username
                    );
                    if (containerResult.success) {
                        schedules = schedules.map(s => {
                            if (s.scheduleId === schedule.scheduleId) {
                                return { ...s, completed: true };
                            }
                            return s;
                        });
                        console.log(`Marked schedule as completed for ${schedule.username} with scheduleId: ${schedule.scheduleId}.`);
                        await kv.set(SCHEDULE_KEY, schedules);

                        const containerData = {
                            scheduleId: schedule.scheduleId,
                            accountId: schedule.accountId,
                            username: schedule.username,
                            creationId: containerResult.creationId,
                            userToken: schedule.userToken
                        };
                        await kv.set(CONTAINER_KEY, containerData);
                        await kv.set(STATE_KEY, { step: 'publish' }); // Pindah ke langkah berikutnya
                        return { message: 'Container created, moving to publish step' };
                    }
                    break;
                }
            }
            return { message: 'No schedules match current time for creating container' };
        } else if (state.step === 'publish' && pendingContainer) {
            // Langkah 2: Publish container yang ada
            const publishResult = await publishToInstagram(
                pendingContainer.accountId,
                pendingContainer.creationId,
                pendingContainer.userToken,
                pendingContainer.username
            );
            if (publishResult.success) {
                console.log(`Published container for ${pendingContainer.username} with scheduleId: ${pendingContainer.scheduleId}.`);
                await kv.set(STATE_KEY, { step: 'remove' }); // Pindah ke langkah berikutnya
                return { message: 'Published successfully, moving to remove step' };
            }
        } else if (state.step === 'remove' && pendingContainer) {
            // Langkah 3: Hapus jadwal yang sudah dipublish dan buat container untuk jadwal berikutnya
            schedules = schedules.filter(schedule => schedule.scheduleId !== pendingContainer.scheduleId);
            console.log(`Removed posted schedule for ${pendingContainer.username} with scheduleId: ${pendingContainer.scheduleId}.`);
            await kv.set(SCHEDULE_KEY, schedules);
            await kv.set(CONTAINER_KEY, null);

            // Cari jadwal berikutnya untuk membuat container
            for (const schedule of sortedSchedules) {
                if (!schedules.some(s => s.scheduleId === schedule.scheduleId)) continue;

                const scheduledTimeUTC = new Date(schedule.time + ':00').getTime() - 7 * 60 * 60 * 1000;
                if (nowUTC >= scheduledTimeUTC && !schedule.completed) {
                    const containerResult = await createMediaContainer(
                        schedule.accountId,
                        schedule.mediaUrl,
                        schedule.caption,
                        schedule.userToken,
                        schedule.username
                    );
                    if (containerResult.success) {
                        schedules = schedules.map(s => {
                            if (s.scheduleId === schedule.scheduleId) {
                                return { ...s, completed: true };
                            }
                            return s;
                        });
                        console.log(`Marked schedule as completed for ${schedule.username} with scheduleId: ${schedule.scheduleId}.`);
                        await kv.set(SCHEDULE_KEY, schedules);

                        const containerData = {
                            scheduleId: schedule.scheduleId,
                            accountId: schedule.accountId,
                            username: schedule.username,
                            creationId: containerResult.creationId,
                            userToken: schedule.userToken
                        };
                        await kv.set(CONTAINER_KEY, containerData);
                        await kv.set(STATE_KEY, { step: 'publish' }); // Kembali ke publish untuk siklus berikutnya
                        return { message: 'Schedule removed and new container created' };
                    }
                    break;
                }
            }
            await kv.set(STATE_KEY, { step: 'create' }); // Kembali ke create jika tidak ada jadwal berikutnya
            return { message: 'Schedule removed, no new schedules to process' };
        }

        return { message: 'Scheduler completed current step', state: state.step };
    } catch (error) {
        console.error('Error running scheduled posts:', error.message);
        throw new Error(`Failed to run scheduled posts: ${error.message}`);
    }
}

// Vercel Serverless Function
module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'POST') {
        const { accountId, username, mediaUrl, time, userToken, accountNum, completed } = req.body;
        const caption = req.body.caption || '';

        if (!accountId || !mediaUrl || !time || !userToken || !accountNum || !username) {
            console.error('Validation failed: Missing required fields', { accountId, mediaUrl, time, userToken, accountNum, username });
            return res.status(400).json({ error: 'Missing required fields (accountId, mediaUrl, time, userToken, accountNum, username)' });
        }

        try {
            let schedules = (await kv.get(SCHEDULE_KEY)) || [];
            const newSchedule = {
                scheduleId: uuidv4(),
                accountId,
                username,
                mediaUrl,
                caption,
                time,
                userToken,
                accountNum,
                completed: completed || false,
            };
            schedules.push(newSchedule);
            await kv.set(SCHEDULE_KEY, schedules);
            return res.status(200).json({ message: 'Post scheduled successfully', scheduleId: newSchedule.scheduleId });
        } catch (error) {
            console.error('Error saving schedule:', error.message);
            return res.status(500).json({ error: `Failed to save schedule: ${error.message}` });
        }
    }

    if (req.method === 'GET') {
        try {
            const result = await runScheduledPosts();
            return res.status(200).json({ message: 'Scheduler running', details: result });
        } catch (error) {
            console.error('Error running scheduler:', error.message);
            return res.status(500).json({ error: `Failed to run scheduler: ${error.message}` });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
