const axios = require('axios');
const { kv } = require('@vercel/kv');
const { v4: uuidv4 } = require('uuid');

const SCHEDULE_KEY = 'schedules';

// Fungsi untuk memposting ke Instagram
async function postToInstagram(igAccountId, mediaUrl, caption, userToken) {
    try {
        console.log('Posting to Instagram with params:', { igAccountId, mediaUrl, caption });
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

        const creationId = mediaResponse.data.id;
        const publishEndpoint = `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`;
        const publishParams = {
            creation_id: creationId,
            access_token: userToken,
        };

        const publishResponse = await axios.post(publishEndpoint, publishParams);
        console.log('Instagram API publish response:', publishResponse.data);
        return { success: true, creationId: publishResponse.data.id };
    } catch (error) {
        console.error('Error posting to Instagram:', error.response?.data || error.message);
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

        // Batasi log hanya untuk 2 jadwal pertama yang pending, tampilkan username alih-alih accountId, tanpa scheduleId
        const limitedPendingSchedules = pendingSchedules.slice(0, 2);
        console.log('Pending schedules fetched (showing top 2):', limitedPendingSchedules.map(s => ({
            username: s.username,
            time: s.time,
            completed: s.completed
        })));

        const now = new Date();
        console.log('Current time (UTC):', now.toISOString());

        const updatedSchedules = [];

        for (const schedule of schedules) {
            if (schedule.completed) {
                continue;
            }

            const scheduledTimeWIB = new Date(schedule.time + ':00');
            const scheduledTimeUTC = new Date(scheduledTimeWIB.getTime() - 7 * 60 * 60 * 1000);
            console.log(`Checking schedule: ${schedule.username}, Scheduled Time (WIB): ${scheduledTimeWIB.toISOString()}, Scheduled Time (UTC): ${scheduledTimeUTC.toISOString()}, Now: ${now.toISOString()}`);

            if (now >= scheduledTimeUTC && !schedule.completed) {
                console.log(`Processing schedule for account ${schedule.username}`);
                const result = await postToInstagram(
                    schedule.accountId,
                    schedule.mediaUrl,
                    schedule.caption,
                    schedule.userToken
                );
                if (result.success) {
                    schedule.completed = true;
                    console.log(`Post successful for ${schedule.username}: ${result.creationId}`);
                    updatedSchedules.push(schedule);
                    await kv.set(SCHEDULE_KEY, [...updatedSchedules, ...schedules.filter(s => s !== schedule)]);
                } else {
                    console.error(`Failed to post for ${schedule.username}: ${result.error}`);
                    schedule.error = result.error;
                    updatedSchedules.push(schedule);
                }
            } else {
                console.log(`Schedule not processed: ${now >= scheduledTimeUTC ? 'Already completed' : 'Time not yet reached'}`);
                updatedSchedules.push(schedule);
            }
        }

        await kv.set(SCHEDULE_KEY, updatedSchedules);
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
