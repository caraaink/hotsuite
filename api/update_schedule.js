const { kv } = require('@vercel/kv');

const SCHEDULE_KEY = 'schedules';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { index, ...updatedData } = req.body;

  // Validasi index
  if (index === undefined || typeof index !== 'number' || index < 0) {
    return res.status(400).json({ error: 'Invalid index: Index must be a non-negative number' });
  }

  // Validasi updatedData
  if (!updatedData || Object.keys(updatedData).length === 0) {
    return res.status(400).json({ error: 'Invalid updated data: At least one field must be provided' });
  }

  // Validasi field yang diperbarui
  if ('time' in updatedData) {
    // Pastikan time dalam format ISO 8601
    const time = updatedData.time;
    if (!time || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?([+-]\d{2}:\d{2}|Z)?$/.test(time)) {
      return res.status(400).json({ error: 'Invalid time format: Time must be in ISO 8601 format (e.g., 2025-03-14T15:00)' });
    }
  }

  if ('caption' in updatedData) {
    // Pastikan caption adalah string
    if (typeof updatedData.caption !== 'string') {
      return res.status(400).json({ error: 'Invalid caption: Caption must be a string' });
    }
  }

  try {
    // Ambil daftar jadwal dari KV
    let schedules = (await kv.get(SCHEDULE_KEY)) || [];
    if (!Array.isArray(schedules)) {
      console.error('Schedules is not an array:', schedules);
      schedules = [];
    }

    // Periksa apakah jadwal di indeks yang diberikan ada
    if (index >= schedules.length) {
      return res.status(404).json({ error: `Schedule not found at index ${index}` });
    }

    // Log data sebelum perubahan
    console.log(`Updating schedule at index ${index}. Previous data:`, schedules[index]);
    console.log('Updated data:', updatedData);

    // Perbarui hanya field yang dikirim
    schedules[index] = {
      ...schedules[index],
      ...updatedData,
    };

    // Simpan kembali ke KV
    await kv.set(SCHEDULE_KEY, schedules);

    // Log data setelah perubahan
    console.log(`Schedule at index ${index} updated successfully. New data:`, schedules[index]);

    res.status(200).json({ message: 'Jadwal berhasil diperbarui' });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: `Failed to update schedule: ${error.message}` });
  }
};
