const axios = require('axios');
const { kv } = require('@vercel/kv');
const { v4: uuidv4 } = require('uuid');

const SCHEDULE_KEY = 'schedules';
const CONTAINER_KEY = 'pending_container';

// Fungsi untuk membuat container ID tanpa langsung memposting
async function createMediaContainer(igAccountId, mediaUrl, caption, userToken) {
    try {
        console.log('Creating media container with params:', { igAccountId, mediaUrl, caption });
        const isVideo = mediaUrl.toLowerCase().endsWith('.mp4');
        const mediaEndpoint = `https://graph.facebook.com/v19.0/${igAccountId}/media`;
        const params = {
            [isVideo ? 'video_url' : 'image_url']: mediaUrl,
            caption: caption || '',
            access_token: userToken,
            ...(isVideo && { media_type: 'REELS' }),
        };

        const mediaResponse = await axios.post(mediaEndpoint, params);
        console.log('Media container created:', mediaResponse.data);
        return { success: true, creationId: mediaResponse.data.id };
    } catch (error) {
        console.error('Error creating media container:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

// Fungsi untuk memposting ke Instagram menggunakan container ID
async function publishToInstagram(igAccountId, creationId, userToken) {
    try {
        console.log('Publishing to Instagram with creationId:', creationId);
        const publishEndpoint = `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`;
        const publishParams = {
            creation_id: creationId,
            access_token: userToken,
        };

        const publishResponse = await axios.post(publishEndpoint, publishParams);
        console.log('Instagram API publish response:', publishResponse.data);
        return { success: true, creationId: publishResponse.data.id };
    } catch (error) {
        console.error('Error publishing to Instagram:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

// Fungsi untuk menjalankan jadwal
async function runScheduledPosts() {
    try {
        let schedules = (await kv.get(SCHEDULE_KEY)) || [];
        
        if (!schedules || schedules.length === 0) {
            console.log('No schedules to process.');
            return;
        }

        const pendingSchedules = schedules.filter(schedule => !schedule.completed);
        
        if (pendingSchedules.length === 0) {
            console.log('No pending schedules to process. Removing completed schedules.');
            await kv.set(SCHEDULE_KEY, []);
            return;
        }

        // Urutkan jadwal berdasarkan waktu (time) dari terlama ke terbaru, lalu ambil 2 teratas
        const sortedSchedules = schedules
            .map(schedule => ({
                ...schedule,
                timeUTC: new Date(schedule.time + ':00').getTime() - 7 * 60 * 60 * 1000
            }))
            .sort((a, b) => a.timeUTC - b.timeUTC) // Urutkan dari terlama ke terbaru
            .slice(0, 2);

        // Log hanya 2 jadwal teratas (terlama ke terbaru)
        console.log('Top 2 schedules by date (oldest to latest):', sortedSchedules.map(s => ({
            username: s.username,
            time: s.time,
            completed: s.completed
        })));

        // Ambil jadwal terbaru (waktu paling akhir) untuk "Latest schedule fetched"
        const latestSchedule = schedules
            .map(schedule => ({
                ...schedule,
                timeUTC: new Date(schedule.time + ':00').getTime() - 7 * 60 * 60 * 1000
            }))
            .sort((a, b) => b.timeUTC - a.timeUTC)[0]; // Ambil yang terbaru

        console.log('Latest schedule fetched:', {
            username: latestSchedule.username,
            time: latestSchedule.time,
            mediaUrl: latestSchedule.mediaUrl,
            caption: latestSchedule.caption,
            completed: latestSchedule.completed
        });

        const now = new Date();
        console.log('Current time (UTC):', now.toISOString());

        // Ambil container ID yang tersimpan dari cronjob sebelumnya
        const pendingContainer = (await kv.get(CONTAINER_KEY)) || null;

        let updatedSchedules = [];
        let checkLogCount = 0;
        let notProcessedLogCount = 0;
        let hasProcessedSchedule = false;

        // Langkah 1: Jika ada container ID dari cronjob sebelumnya, posting sekarang
        if (pendingContainer) {
            console.log('Found pending container from previous run:', pendingContainer);
            const publishResult = await publishToInstagram(
                pendingContainer.accountId,
                pendingContainer.creationId,
                pendingContainer.userToken
            );
            if (publishResult.success) {
                console.log(`Successfully published post for ${pendingContainer.username}: ${publishResult.creationId}`);
                // Tandai jadwal sebagai selesai
                updatedSchedules = schedules.map(schedule => {
                    if (schedule.scheduleId === pendingContainer.scheduleId) {
                        return { ...schedule, completed: true };
                    }
                    return schedule;
                });
                await kv.set(SCHEDULE_KEY, updatedSchedules);
            } else {
                console.error(`Failed to publish post for ${pendingContainer.username}: ${publishResult.error}`);
            }
            // Hapus container ID setelah diproses
            await kv.set(CONTAINER_KEY, null);
        } else {
            console.log('No pending container to publish from previous run.');
        }

        // Langkah 2: Proses jadwal baru untuk membuat container ID
        for (const schedule of sortedSchedules) {
            if (schedule.completed) {
                continue;
            }

            const scheduledTimeWIB = new Date(schedule.time + ':00');
            const scheduledTimeUTC = new Date(scheduledTimeWIB.getTime() - 7 * 60 * 60 * 1000);
            
            if (checkLogCount < 2) {
                console.log(`Checking schedule: ${schedule.username}, Scheduled Time (WIB): ${scheduledTimeWIB.toISOString()}, Scheduled Time (UTC): ${scheduledTimeUTC.toISOString()}, Now: ${now.toISOString()}`);
                checkLogCount++;
            }

            if (now >= scheduledTimeUTC && !schedule.completed) {
                console.log(`Creating media container for account ${schedule.username}`);
                const containerResult = await createMediaContainer(
                    schedule.accountId,
                    schedule.mediaUrl,
                    schedule.caption,
                    schedule.userToken
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
                    console.log(`Media container created and saved for ${schedule.username}: ${containerResult.creationId}`);
                    hasProcessedSchedule = true;
                    break; // Hanya proses satu jadwal per cronjob
                } else {
                    console.error(`Failed to create media container for ${schedule.username}: ${containerResult.error}`);
                    schedule.error = containerResult.error;
                    updatedSchedules.push(schedule);
                }
            } else {
                if (notProcessedLogCount < 2) {
                    console.log(`Schedule not processed for ${latestSchedule.username}: ${now >= scheduledTimeUTC ? 'Already completed' : 'Time not yet reached'}`);
                    notProcessedLogCount++;
                }
                updatedSchedules.push(schedule);
            }
        }

        if (hasProcessedSchedule) {
            console.log('Notification: A media container was created for the next scheduled post.');
        } else {
            console.log('Notification: No schedules were processed as the current time does not match any scheduled time.');
        }

        if (updatedSchedules.length > 0) {
            await kv.set(SCHEDULE_KEY, updatedSchedules);
        }
        console.log('Updated schedules count:', updatedSchedules.length);
    } catch (error) {
        console.error('Error running scheduled posts:', error);
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
            console.log('Schedule saved successfully:', newSchedule);
            return res.status(200).json({ message: 'Post scheduled successfully', scheduleId: newSchedule.scheduleId });
        } catch (error) {
            console.error('Error saving schedule:', error);
            return res.status(500).json({ error: `Failed to save schedule: ${error.message}` });
        }
    }

    if (req.method === 'GET') {
        try {
            await runScheduledPosts();
            return res.status(200).json({ message: 'Scheduler running' });
        } catch (error) {
            console.error('Error running scheduler:', error);
            return res.status(500).json({ error: `Failed to run scheduler: ${error.message}` });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
