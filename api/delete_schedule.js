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
      url: process.env.KV_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    let schedules = await redis.get('schedules');
    schedules = schedules || [];

    if (index >= schedules.length) {
      return res.status(400).json({ error: 'Index out of bounds' });
    }

    schedules.splice(index, 1);

    await redis.set('schedules', schedules);

    res.status(200).json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Failed to delete schedule', details: error.message });
  }
}
