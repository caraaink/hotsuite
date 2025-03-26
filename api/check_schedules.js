const { kv } = require('@vercel/kv');

const SCHEDULE_KEY = 'schedules';

module.exports = async (req, res) => {
  try {
    const schedules = (await kv.get(SCHEDULE_KEY)) || [];
    res.status(200).json({ hasSchedules: schedules.length > 0 });
  } catch (error) {
    console.error('Error checking schedules:', error);
    res.status(500).json({ error: 'Failed to check schedules' });
  }
};
