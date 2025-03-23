const { kv } = require('@vercel/kv');

const SCHEDULE_KEY = 'schedules';

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const schedules = (await kv.get(SCHEDULE_KEY)) || [];
    res.status(200).json({ schedules, message: 'This endpoint is for debugging purposes only' });
  } catch (error) {
    console.error('Error checking schedules:', error);
    res.status(500).json({ error: 'Failed to check schedules' });
  }
};
