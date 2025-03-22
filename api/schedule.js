const axios = require('axios');
const { kv } = require('@vercel/kv');

const SCHEDULE_KEY = 'schedules';

// Fungsi untuk memposting ke Instagram dengan jadwal
async function postToInstagram(igAccountId, mediaUrl, caption, userToken, scheduledTime) {
  try {
    const isVideo = mediaUrl.toLowerCase().endsWith('.mp4');
    const mediaEndpoint = `https://graph.facebook.com/v19.0/${igAccountId}/media`;
    const params = {
      [isVideo ? 'video_url' : 'image_url']: mediaUrl,
      caption,
      access_token: userToken,
      ...(isVideo && { media_type: 'REELS' }),
      publish_type: 'SCHEDULE',
      scheduled_publish_time: Math.floor(new Date(scheduledTime).getTime() / 1000),
    };

    const mediaResponse = await axios.post(mediaEndpoint, params);
    return { success: true, creationId: mediaResponse.data.id };
  } catch (error) {
    console.error('Error posting to Instagram:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

// Fungsi untuk menjalankan jadwal
async function runScheduledPosts() {
  try {
    let schedules = (await kv.get(SCHEDULE_KEY)) || [];

    const now = new Date();
    const updatedSchedules = [];

    for (const schedule of schedules) {
      const scheduledTime = new Date(schedule.time);
      if (now >= scheduledTime && !schedule.completed) {
        const result = await postToInstagram(
          schedule.accountId,
          schedule.mediaUrl,
          schedule.caption,
          schedule.userToken,
          scheduledTime
        );
        if (result.success) {
          schedule.completed = true;
          console.log(`Scheduled post successful for ${schedule.accountId}: ${result.creationId}`);
        } else {
          console.error(`Failed to post for ${schedule.accountId}: ${result.error}`);
        }
      }
      updatedSchedules.push(schedule);
    }

    await kv.set(SCHEDULE_KEY, updatedSchedules);
  } catch (error) {
    console.error('Error running scheduled posts:', error);
  }
}

// Vercel Serverless Function
module.exports = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (req.method === 'GET' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'POST') {
    const { accountId, mediaUrl, caption, time, userToken } = req.body;
    if (!accountId || !mediaUrl || !caption || !time || !userToken) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let schedules = (await kv.get(SCHEDULE_KEY)) || [];
    schedules.push({ accountId, mediaUrl, caption, time, userToken, completed: false });
    await kv.set(SCHEDULE_KEY, schedules);
    return res.status(200).json({ message: 'Post scheduled successfully' });
  }

  if (req.method === 'GET') {
    await runScheduledPosts();
    return res.status(200).json({ message: 'Scheduler running' });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
