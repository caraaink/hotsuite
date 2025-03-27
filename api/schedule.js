const axios = require('axios');
const { kv } = require('@vercel/kv');
const { v4: uuidv4 } = require('uuid');

const SCHEDULE_KEY = 'schedules';
const CONTAINER_KEY = 'pending_container';

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

// Fungsi untuk menjalankan jadwal
async function runScheduledPosts() {
    try {
        let schedules = (await kv.get(SCHEDULE_KEY)) || [];
        
        if (!schedules || schedules.length === 0) {
            console.log('No schedules available to process.');
            return;
        }

        const pendingSchedules = schedules.filter(schedule => !schedule.completed);
        
        if (pendingSchedules.length === 0) {
            console.log('All schedules have been completed. Clearing schedules.');
            await kv.set(SCHEDULE_KEY, []);
            return;
        }

        const now = new Date();
        const nowUTC = now.getTime();

        // Urutkan semua jadwal berdasarkan waktu (time) dari terlama ke terbaru
        const sortedSchedules = schedules
            .map(schedule => ({
                ...schedule,
                timeUTC: new Date(schedule.time + ':00').getTime() - 7 * 60 * 60 * 1000
            }))
            .sort((a, b) => a.timeUTC - b.timeUTC); // Terlama ke terbaru

        // Ambil container ID yang tersimpan dari cronjob sebelumnya
        const pendingContainer = (await kv.get(CONTAINER_KEY)) || null;

        let updatedSchedules = [];
        let hasProcessedSchedule = false;

        // Langkah 1: Jika ada container ID dari cronjob sebelumnya, posting sekarang
        if (pendingContainer) {
            const publishResult = await publishToInstagram(
                pendingContainer.accountId,
                pendingContainer.creationId,
                pendingContainer.userToken,
                pendingContainer.username
            );
            if (publishResult.success) {
                // Tandai jadwal sebagai selesai
                updatedSchedules = schedules.map(schedule => {
                    if (schedule.scheduleId === pendingContainer.scheduleId) {
                        return { ...schedule, completed: true };
                    }
                    return schedule;
                });
                await kv.set(SCHEDULE_KEY, updatedSchedules);
            }
            // Hapus container ID setelah diproses
            await kv.set(CONTAINER_KEY, null);
        }

        // Langkah 2: Proses jadwal baru untuk membuat container ID
        let foundMatchingSchedule = false;
        for (const schedule of sortedSchedules) {
            if (schedule.completed) {
                continue;
            }

            const scheduledTimeUTC = new Date(schedule.time + ':00').getTime() - 7 * 60 * 60 * 1000;

            if (nowUTC >= scheduledTimeUTC && !schedule.completed) {
                foundMatchingSchedule = true;
                const containerResult = await createMediaContainer(
                    schedule.accountId,
                    schedule.mediaUrl,
                    schedule.caption,
                    schedule.userToken,
                    schedule.username
                );
                if (containerResult.success) {
                    // Simpan container ID untuk diposting di cronjob berikutnya
                    const containerData = {
                        scheduleId: schedule.scheduleId,
                        accountId: schedule.accountId,
                        username: schedule.username,
                        creationId: containerResult.creationId,
                        userToken: schedule.userToken
                    };
                    await kv.set(CONTAINER_KEY, containerData);
                    hasProcessedSchedule = true;
                    break; // Hanya proses satu jadwal per cronjob
                } else {
                    schedule.error = containerResult.error;
                    updatedSchedules.push(schedule);
                }
            } else {
                updatedSchedules.push(schedule);
            }
        }

        if (!foundMatchingSchedule && pendingSchedules.length > 0) {
            // Ambil jadwal berikutnya yang belum waktunya
            const nextSchedule = pendingSchedules
                .map(schedule => ({
                    ...schedule,
                    timeUTC: new Date(schedule.time + ':00').getTime() - 7 * 60 * 60 * 1000
                }))
                .sort((a, b) => a.timeUTC - b.timeUTC)[0];
            console.log(`No schedules match the current time for processing. Next schedule for ${nextSchedule.username} at ${nextSchedule.time}.`);
        }

        if (updatedSchedules.length > 0) {
            await kv.set(SCHEDULE_KEY, updatedSchedules);
        }
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
            await runScheduledPosts();
            return res.status(200).json({ message: 'Scheduler running' });
        } catch (error) {
            console.error('Error running scheduler:', error.message);
            return res.status(500).json({ error: `Failed to run scheduler: ${error.message}` });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
