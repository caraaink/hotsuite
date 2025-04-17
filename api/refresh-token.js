const axios = require('axios');
   const JSZip = require('jszip');

   module.exports = async (req, res) => {
     // Handle GET /api/refresh-token (original token fetching logic)
     if (req.method === 'GET' && !req.query.action) {
       const { accountNum } = req.query;

       if (!accountNum) {
         return res.status(400).json({ error: 'Missing accountNum parameter' });
       }

       try {
         const token = process.env[`TOKEN_${accountNum}`];
         if (!token) {
           return res.status(404).json({ error: `No token found for Akun ${accountNum}` });
         }

         console.log(`Token for Akun ${accountNum}:`, token);
         res.status(200).json({ token });
       } catch (error) {
         console.error('Error fetching token:', error);
         res.status(500).json({ error: 'Failed to fetch token' });
       }
     }
     // Handle POST /api/refresh-token?action=generate-zip (ZIP generation logic)
     else if (req.method === 'POST' && req.query.action === 'generate-zip') {
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
     }
     // Handle invalid methods or endpoints
     else {
       return res.status(405).json({ error: 'Method not allowed or invalid endpoint' });
     }
   };
