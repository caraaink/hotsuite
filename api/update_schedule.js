import { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { index, completed } = req.body;

    if (index === undefined || index < 0 || completed === undefined) {
      return res.status(400).json({ error: 'Invalid index or completed status' });
    }

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Ambil jadwal yang ada dari Upstash
    let schedules = await redis.get('schedules');
    schedules = schedules || [];

    // Perbarui status jadwal
    if (index >= schedules.length) {
      return res.status(400).json({ error: 'Index out of bounds' });
    }

    schedules[index].completed = completed;

    // Simpan kembali ke Upstash
    await redis.set('schedules', schedules);

    res.status(200).json({ message: 'Schedule updated successfully' });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Failed to update schedule', details: error.message });
  }
}
