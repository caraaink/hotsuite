import { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
  try {
    const redis = new Redis({
      url: process.env.KV_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    const schedules = await redis.get('schedules');
    res.status(200).json({ schedules: schedules || [] });
  } catch (error) {
    console.error('Error fetching schedules from Upstash:', error);
    res.status(500).json({ error: 'Failed to fetch schedules', details: error.message });
  }
}
