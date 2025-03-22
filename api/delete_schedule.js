import { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { index } = req.body;

    if (index === undefined || index < 0) {
      return res.status(400).json({ error: 'Invalid index' });
    }

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Ambil jadwal yang ada dari Upstash
    let schedules = await redis.get('schedules');
    schedules = schedules || [];

    // Hapus jadwal berdasarkan indeks
    if (index >= schedules.length) {
      return res.status(400).json({ error: 'Index out of bounds' });
    }

    schedules.splice(index, 1);

    // Simpan kembali ke Upstash
    await redis.set('schedules', schedules);

    res.status(200).json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Failed to delete schedule', details: error.message });
  }
}
