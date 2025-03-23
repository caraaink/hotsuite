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
      caption: caption || '', // Pastikan caption opsional
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

// Fungsi untuk menghapus file dari GitHub (gambar dan meta)
async function deleteFromGithub(path) {
  const octokit = require('@octokit/rest').Octokit;
  const octokitInstance = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const owner = 'caraaink';
  const repo = 'hotsuite';

  try {
    // Hapus file gambar
    const { data: fileData } = await octokitInstance.repos.getContent({ owner, repo, path });
    await octokitInstance.repos.deleteFile({
      owner,
      repo,
      path,
      message: `Delete file ${path}`,
      sha: fileData.sha,
    });
    console.log(`File ${path} deleted from GitHub`);

    // Hapus file meta terkait
    const metaPath = `${path}.meta.json`;
    try {
      const { data: metaData } = await octokitInstance.repos.getContent({ owner, repo, path: metaPath });
      await octokitInstance.repos.deleteFile({
        owner,
        repo,
        path: metaPath,
        message: `Delete meta file ${metaPath}`,
        sha: metaData.sha,
      });
      console.log(`Meta file ${metaPath} deleted from GitHub`);
    } catch (metaError) {
      if (metaError.status === 404) {
        console.log(`No meta file found for ${path}`);
      } else {
        throw metaError;
      }
    }
  } catch (error) {
    console.error(`Error deleting from GitHub: ${error.message}`);
    throw error;
  }
}

// Fungsi untuk menjalankan jadwal dengan delay
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

    console.log('Pending schedules fetched:', pendingSchedules);

    const now = new Date();
    console.log('Current time (UTC):', now.toISOString());

    // Kelompokkan jadwal berdasarkan waktu
    const schedulesByTime = {};
    pendingSchedules.forEach(schedule => {
      const scheduledTimeWIB = new Date(schedule.time + ':00');
      const scheduledTimeUTC = new Date(scheduledTimeWIB.getTime() - 7 * 60 * 60 * 1000);
      const timeKey = scheduledTimeUTC.toISOString();
      if (!schedulesByTime[timeKey]) schedulesByTime[timeKey] = [];
      schedulesByTime[timeKey].push(schedule);
    });

    const updatedSchedules = [...schedules.filter(s => s.completed)]; // Simpan yang sudah selesai

    for (const timeKey in schedulesByTime) {
      const schedulesAtTime = schedulesByTime[timeKey];
      const scheduledTimeUTC = new Date(timeKey);

      if (now >= scheduledTimeUTC) {
        for (let i = 0; i < schedulesAtTime.length; i++) {
          const schedule = schedulesAtTime[i];
          console.log(`Processing schedule ${i + 1}/${schedulesAtTime.length} for account ${schedule.accountId}`);

          // Tambahkan delay 1 menit antar posting di waktu yang sama
          if (i > 0) {
            const delayMs = i * 60 * 1000; // Delay 1 menit per posting setelah yang pertama
            console.log(`Delaying post ${i + 1} by ${delayMs / 1000} seconds`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }

          const result = await postToInstagram(
            schedule.accountId,
            schedule.mediaUrl,
            schedule.caption,
            schedule.userToken
          );

          if (result.success) {
            schedule.completed = true;
            console.log(`Post successful for ${schedule.accountId}: ${result.creationId}`);

            // Hapus file dari GitHub jika dari folder ig/image
            if (schedule.mediaUrl.includes('ig/image')) {
              const path = schedule.mediaUrl.split('/').slice(-2).join('/');
              try {
                await deleteFromGithub(path);
              } catch (deleteError) {
                console.error(`Failed to delete files for ${path}: ${deleteError.message}`);
              }
            }
          } else {
            console.error(`Failed to post for ${schedule.accountId}: ${result.error}`);
            schedule.error = result.error;
            updatedSchedules.push(schedule); // Simpan yang gagal
          }

          // Simpan perubahan segera setelah setiap posting
          await kv.set(SCHEDULE_KEY, [...updatedSchedules, ...schedulesAtTime.filter((_, idx) => idx >= i)]);
        }
      } else {
        updatedSchedules.push(...schedulesAtTime); // Simpan yang belum waktunya
      }
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
    const { accountId, username, mediaUrl, time, userToken, accountNum, completed } = req.body;
    const caption = req.body.caption || ''; // Caption opsional, default kosong
    if (!accountId || !mediaUrl || !time || !userToken || !accountNum || !username) {
      return res.status(400).json({ error: 'Missing required fields (accountId, mediaUrl, time, userToken, accountNum, username)' });
    }

    let schedules = (await kv.get(SCHEDULE_KEY)) || [];
    schedules.push({ accountId, username, mediaUrl, caption, time, userToken, accountNum, completed: completed || false });
    await kv.set(SCHEDULE_KEY, schedules);
    return res.status(200).json({ message: 'Post scheduled successfully' });
  }

  if (req.method === 'GET') {
    await runScheduledPosts();
    return res.status(200).json({ message: 'Scheduler running' });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
