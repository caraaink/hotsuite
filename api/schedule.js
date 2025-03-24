const axios = require('axios');
const { kv } = require('@vercel/kv');
const { v4: uuidv4 } = require('uuid'); // Tambahkan dependensi uuid

const SCHEDULE_KEY = 'schedules';

// Fungsi untuk memposting ke Instagram
async function postToInstagram(igAccountId, mediaUrl, caption, userToken) {
  try {
    console.log('Posting to Instagram with params:', { igAccountId, mediaUrl, caption });
    const isVideo = mediaUrl.toLowerCase().endsWith('.mp4');
    const mediaEndpoint = `https://graph.facebook.com/v19.0/${igAccountId}/media`;
    const params = {
      [isVideo ? 'video_url' : 'image_url']: mediaUrl,
      caption: caption || '', // Pastikan caption opsional
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

    // Filter jadwal yang belum selesai
    const pendingSchedules = schedules.filter(schedule => !schedule.completed);
    
    // Jika tidak ada jadwal yang belum selesai, hapus semua jadwal yang sudah selesai
    if (pendingSchedules.length === 0) {
      console.log('No pending schedules to process. Removing completed schedules.');
      await kv.set(SCHEDULE_KEY, []);
      return;
    }

    console.log('Pending schedules fetched:', pendingSchedules);

    const now = new Date();
    console.log('Current time (UTC):', now.toISOString());

    const updatedSchedules = [];

    for (const schedule of schedules) {
      // Hanya proses jadwal yang belum selesai
      if (schedule.completed) {
        continue; // Lewati jadwal yang sudah selesai, akan dihapus nanti
      }

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
          schedule.completed = true; // Set status completed langsung ke true
          console.log(`Post successful for ${schedule.accountId}: ${result.creationId}`);
          // Simpan perubahan segera setelah posting berhasil
          updatedSchedules.push(schedule);
          await kv.set(SCHEDULE_KEY, [...updatedSchedules, ...schedules.filter(s => s !== schedule)]);
        } else {
          console.error(`Failed to post for ${schedule.accountId}: ${result.error}`);
          schedule.error = result.error;
          updatedSchedules.push(schedule); // Simpan jadwal yang gagal untuk dicoba lagi
        }
      } else {
        console.log(`Schedule not processed: ${now >= scheduledTimeUTC ? 'Already completed' : 'Time not yet reached'}`);
        updatedSchedules.push(schedule); // Simpan jadwal yang belum waktunya
      }
    }

    // Hanya simpan jadwal yang belum selesai atau gagal
    await kv.set(SCHEDULE_KEY, updatedSchedules);
    console.log('Updated schedules (completed schedules removed):', updatedSchedules);
  } catch (error) {
    console.error('Error running scheduled posts:', error);
  }
}

// Vercel Serverless Function
module.exports = async (req, res) => {
  if (req.method === 'POST') {
    const { accountId, username, mediaUrl, time, userToken, accountNum, completed } = req.body;
    const caption = req.body.caption || ''; // Caption opsional, default kosong
    if (!accountId || !mediaUrl || !time || !userToken || !accountNum || !username) {
      return res.status(400).json({ error: 'Missing required fields (accountId, mediaUrl, time, userToken, accountNum, username)' });
    }

    let schedules = (await kv.get(SCHEDULE_KEY)) || [];
    const newSchedule = {
      scheduleId: uuidv4(), // Tambahkan scheduleId unik
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
  }

  if (req.method === 'GET') {
    await runScheduledPosts();
    return res.status(200).json({ message: 'Scheduler running' });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
