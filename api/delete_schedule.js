const { kv } = require('@vercel/kv');

const SCHEDULE_KEY = 'schedules';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { scheduleId } = req.body;

    if (!scheduleId) {
        return res.status(400).json({ error: 'Invalid scheduleId' });
    }

    try {
        let schedules = (await kv.get(SCHEDULE_KEY)) || [];
        const scheduleIndex = schedules.findIndex(schedule => schedule.scheduleId === scheduleId);
        if (scheduleIndex === -1) {
            return res.status(400).json({ error: 'Schedule not found' });
        }

        schedules.splice(scheduleIndex, 1);
        await kv.set(SCHEDULE_KEY, schedules);

        res.status(200).json({ message: 'Jadwal berhasil dihapus' });
    } catch (error) {
        console.error('Error deleting schedule:', error);
        res.status(500).json({ error: 'Failed to delete schedule' });
    }
};