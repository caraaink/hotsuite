const { kv } = require('@vercel/kv');

const SCHEDULE_KEY = 'schedules';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { index, updatedSchedule } = req.body;

  if (index === undefined || index < 0 || !updatedSchedule) {
    return res.status(400).json({ error: 'Invalid index or updated schedule' });
  }

  try {
    let schedules = (await kv.get(SCHEDULE_KEY)) || [];
    if (index >= schedules.length) {
      return res.status(400).json({ error: 'Schedule not found' });
    }

    // Perbarui jadwal berdasarkan indeks
    schedules[index] = updatedSchedule;
    await kv.set(SCHEDULE_KEY, schedules);

    res.status(200).json({ message: 'Jadwal berhasil diperbarui' });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
};
