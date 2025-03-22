import { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import axios from 'axios';

export default async function handler(req, res) {
  try {
    const redis = new Redis({
      url: process.env.KV_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    let schedules = await redis.get('schedules');
    schedules = schedules || [];

    const now = new Date();
    let updated = false;

    for (let i = 0; i < schedules.length; i++) {
      const schedule = schedules[i];
      if (schedule.completed) continue;

      const scheduleTime = new Date(schedule.time);
      if (now >= scheduleTime) {
        const publishResponse = await axios.post(
          'https://hotsuite.vercel.app/api/publish',
          {
            accountId: schedule.accountId,
            mediaUrl: schedule.mediaUrl,
            caption: schedule.caption,
            userToken: schedule.userToken,
            accountNum: schedule.accountNum,
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000,
          }
        );

        if (publishResponse.status === 200) {
          schedules[i].completed = true;
          updated = true;
        } else {
          console.error(`Failed to publish schedule ${i}: ${publishResponse.statusText}`);
        }
      }
    }

    if (updated) {
      await redis.set('schedules', schedules);
    }

    res.status(200).json({ message: 'Schedules checked and updated' });
  } catch (error) {
    console.error('Error checking schedules:', error);
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Request to publish API timed out' });
    }
    res.status(500).json({ error: 'Failed to check schedules', details: error.message });
  }
}
