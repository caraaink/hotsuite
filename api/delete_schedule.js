const { kv } = require('@vercel/kv');

const SCHEDULE_KEY = 'schedules';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { index } = req.body;

  if (index === undefined || index < 0) {
    return res.status(400).json({ error: 'Invalid index' });
  }

  try {
    let schedules = (await kv.get(SCHEDULE_KEY)) || [];
    if (index >= schedules.length) {
      return res.status(400).json({ error: 'Schedule not found' });
    }

    // Hapus jadwal berdasarkan indeks
    schedules.splice(index, 1);
    await kv.set(SCHEDULE_KEY, schedules);

    res.status(200).json({ message: 'Jadwal berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
};
