const JSZip = require('jszip');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed, please use POST' });
    }

    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim() === '') {
        return res.status(400).json({ error: 'Valid text input is required' });
    }

    try {
        const zip = new JSZip();
        const caption = text.trim();

        // Generate 15 JSON files
        for (let i = 1; i <= 15; i++) {
            const jsonContent = JSON.stringify({ caption }, null, 2);
            zip.file(`${i}.json`, jsonContent);
        }

        // Generate the ZIP file
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

        // Set headers for file download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=captions.zip');
        res.setHeader('Content-Length', zipBuffer.length);

        // Send the ZIP file
        return res.status(200).send(zipBuffer);
    } catch (error) {
        console.error('Error generating ZIP:', error);
        return res.status(500).json({ error: 'Failed to generate ZIP file' });
    }
};