import { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Ambil jadwal dari Upstash (key: 'schedules')
    const schedules = await redis.get('schedules');

    // Jika tidak ada jadwal, kembalikan array kosong
    res.status(200).json({ schedules: schedules || [] });
  } catch (error) {
    console.error('Error fetching schedules from Upstash:', error);
    res.status(500).json({ error: 'Failed to fetch schedules', details: error.message });
  }
}
