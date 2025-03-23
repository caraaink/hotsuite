const { kv } = require('@vercel/kv');

const SCHEDULE_KEY = 'schedules';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { accountId, username, mediaUrl, caption, time, userToken, accountNum } = req.body;
    if (!accountId || !username || !mediaUrl || !caption || !time || !userToken || !accountNum) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        let schedules = (await kv.get(SCHEDULE_KEY)) || [];
        schedules.push({ accountId, username, mediaUrl, caption, time, userToken, accountNum, completed: false });
        await kv.set(SCHEDULE_KEY, schedules);
        res.status(200).json({ message: 'Post scheduled successfully' });
    } catch (error) {
        console.error('Error saving schedule:', error);
        res.status(500).json({ error: 'Failed to save schedule', details: error.message });
    }
};
