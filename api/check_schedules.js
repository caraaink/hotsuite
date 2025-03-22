import { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Ambil jadwal yang ada dari Upstash
    let schedules = await redis.get('schedules');
    schedules = schedules || [];

    const now = new Date();
    let updated = false;

    for (let i = 0; i < schedules.length; i++) {
      const schedule = schedules[i];
      if (schedule.completed) continue;

      const scheduleTime = new Date(schedule.time);
      if (now >= scheduleTime) {
        // Publikasikan postingan
        const publishResponse = await fetch('https://hotsuite.vercel.app/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: schedule.accountId,
            mediaUrl: schedule.mediaUrl,
            caption: schedule.caption,
            userToken: schedule.userToken,
            accountNum: schedule.accountNum,
          }),
        });

        if (publishResponse.ok) {
          schedules[i].completed = true;
          updated = true;
        } else {
          console.error(`Failed to publish schedule ${i}: ${publishResponse.statusText}`);
        }
      }
    }

    // Jika ada perubahan, simpan kembali ke Upstash
    if (updated) {
      await redis.set('schedules', schedules);
    }

    res.status(200).json({ message: 'Schedules checked and updated' });
  } catch (error) {
    console.error('Error checking schedules:', error);
    res.status(500).json({ error: 'Failed to check schedules', details: error.message });
  }
}
