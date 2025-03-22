import { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accountId, username, mediaUrl, caption, time, userToken, accountNum, completed } = req.body;

    if (!accountId || !mediaUrl || !time || !userToken || !accountNum) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Ambil jadwal yang ada dari Upstash
    let schedules = await redis.get('schedules');
    schedules = schedules || [];

    // Tambahkan jadwal baru
    schedules.push({
      accountId,
      username,
      mediaUrl,
      caption,
      time,
      userToken,
      accountNum,
      completed: completed || false,
    });

    // Simpan kembali ke Upstash
    await redis.set('schedules', schedules);

    res.status(200).json({ message: 'Schedule added successfully' });
  } catch (error) {
    console.error('Error scheduling post:', error);
    res.status(500).json({ error: 'Failed to schedule post', details: error.message });
  }
}
