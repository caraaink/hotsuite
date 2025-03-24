const { kv } = require('@vercel/kv');

const SCHEDULE_KEY = 'schedules';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { scheduleId, ...updatedData } = req.body;

    if (!scheduleId) {
        return res.status(400).json({ error: 'Invalid scheduleId: ScheduleId must be provided' });
    }

    if (!updatedData || Object.keys(updatedData).length === 0) {
        return res.status(400).json({ error: 'Invalid updated data: At least one field must be provided' });
    }

    if ('time' in updatedData) {
        const time = updatedData.time;
        if (!time || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?([+-]\d{2}:\d{2}|Z)?$/.test(time)) {
            return res.status(400).json({ error: 'Invalid time format: Time must be in ISO 8601 format (e.g., 2025-03-14T15:00)' });
        }
    }

    if ('caption' in updatedData) {
        if (typeof updatedData.caption !== 'string') {
            return res.status(400).json({ error: 'Invalid caption: Caption must be a string' });
        }
    }

    try {
        let schedules = (await kv.get(SCHEDULE_KEY)) || [];
