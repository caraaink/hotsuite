const axios = require('axios');

module.exports = async (req, res) => {
  const { path } = req.query;
  if (!path) {
    return res.status(400).json({ error: 'Path is required' });
  }

  try {
    const response = await axios.get(`https://api.github.com/repos/caraaink/hotsuite/contents/${path}`, {
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    const fileData = response.data;
    if (!fileData.content) {
      return res.status(404).json({ error: 'File content not found' });
    }

    // Decode base64 content
    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    res.status(200).json(JSON.parse(content));
  } catch (error) {
    console.error('Error fetching file content:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch file content' });
  }
};
const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  const { path } = req.query;
  if (!path) {
    return res.status(400).json({ error: 'Path is required' });
  }

  const cacheKey = `file_content:${path}`;
  const cachedContent = await kv.get(cacheKey);
  if (cachedContent) {
    console.log(`Returning cached content for path: ${path}`);
    return res.status(200).json(cachedContent);
  }

  try {
    const response = await axios.get(`https://api.github.com/repos/caraaink/hotsuite/contents/${path}`, {
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    const fileData = response.data;
    if (!fileData.content) {
      return res.status(404).json({ error: 'File content not found' });
    }

    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const parsedContent = JSON.parse(content);
    await kv.set(cacheKey, parsedContent, { ex: 3600 }); // Cache selama 1 jam
    res.status(200).json(parsedContent);
  } catch (error) {
    console.error('Error fetching file content:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch file content' });
  }
};
