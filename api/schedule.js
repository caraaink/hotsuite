const axios = require('axios');
const { kv } = require('@vercel/kv');

const SCHEDULE_KEY = 'schedules';

// Fungsi untuk memposting ke Instagram
async function postToInstagram(igAccountId, mediaUrl, caption, userToken) {
  try {
    console.log('Posting to Instagram with params:', { igAccountId, mediaUrl, caption });
    const isVideo = mediaUrl.toLowerCase().endsWith('.mp4');
    const mediaEndpoint = `https://graph.facebook.com/v19.0/${igAccountId}/media`;
    const params = {
      [isVideo ? 'video_url' : 'image_url']: mediaUrl,
      caption,
      access_token: userToken,
      ...(isVideo && { media_type: 'REELS' }),
    };

    // Langkah 1: Buat media container
    const mediaResponse = await axios.post(mediaEndpoint, params);
    console.log('Media container created:', mediaResponse.data);

    // Langkah 2: Publikasikan media
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
    
    // Jika tidak ada jadwal, catat log minimal dan keluar
    if (!schedules || schedules.length === 0) {
      console.log('No schedules to process.');
      return;
    }

    // Hanya catat log jika ada jadwal
    console.log('Schedules fetched:', schedules);

    const now = new Date();
    console.log('Current time (UTC):', now.toISOString());

    const updatedSchedules = [];

    for (const schedule of schedules) {
      // Asumsikan waktu yang disimpan adalah WIB (UTC+7), konversi ke UTC
      const scheduledTimeWIB = new Date(schedule.time + ':00'); // Tambahkan detik
      const scheduledTimeUTC = new Date(scheduledTimeWIB.getTime() - 7 * 60 * 60 * 1000); // Kurangi 7 jam untuk konversi ke UTC
      console.log(`Checking schedule: ${schedule.accountId}, Scheduled Time (WIB): ${scheduledTimeWIB.toISOString()}, Scheduled Time (UTC): ${scheduledTimeUTC.toISOString()}, Now: ${now.toISOString()}`);

      if (now >= scheduledTimeUTC && !schedule.completed) {
        console.log(`Processing schedule for account ${schedule.accountId}`);
        const result = await postToInstagram(
          schedule.accountId,
          schedule.mediaUrl,
          schedule.caption,
          schedule.userToken
        );
        if (result.success) {
          schedule.completed = true;
          console.log(`Post successful for ${schedule.accountId}: ${result.creationId}`);
        } else {
          console.error(`Failed to post for ${schedule.accountId}: ${result.error}`);
          // Tambahkan flag untuk mencoba lagi di iterasi berikutnya
          schedule.error = result.error;
        }
      } else {
        console.log(`Schedule not processed: ${now >= scheduledTimeUTC ? 'Already completed' : 'Time not yet reached'}`);
      }
      updatedSchedules.push(schedule);
    }

    await kv.set(SCHEDULE_KEY, updatedSchedules);
    console.log('Updated schedules:', updatedSchedules);
  } catch (error) {
    console.error('Error running scheduled posts:', error);
  }
}

// Vercel Serverless Function
module.exports = async (req, res) => {
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
