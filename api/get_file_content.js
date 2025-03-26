const axios = require('axios');
const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  const { paths } = req.query;

  if (!paths) {
    return res.status(400).json({ error: 'Paths are required' });
  }

  const pathArray = Array.isArray(paths) ? paths : [paths];
  const results = {};
  const pathsToFetch = [];

  // Cek cache untuk semua path
  for (const path of pathArray) {
    const cacheKey = `file_content:${path}`;
    const cachedContent = await kv.get(cacheKey);
    if (cachedContent) {
      console.log(`Returning cached content for path: ${path}`, cachedContent);
      results[path] = cachedContent;
    } else {
      pathsToFetch.push(path);
    }
  }

  // Jika ada path yang tidak ada di cache, ambil dari GitHub
  if (pathsToFetch.length > 0) {
    try {
      const promises = pathsToFetch.map(async (path) => {
        try {
          const response = await axios.get(`https://api.github.com/repos/caraaink/hotsuite/contents/${path}`, {
            headers: {
              Authorization: `token ${process.env.GITHUB_TOKEN}`,
              Accept: 'application/vnd.github.v3+json',
            },
          });

          const fileData = response.data;
          if (!fileData.content) {
            throw new Error('File content not found');
          }

          const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
          let parsedContent;
          try {
            parsedContent = JSON.parse(content);
          } catch (parseError) {
            console.error(`Error parsing JSON for path ${path}:`, parseError.message);
            parsedContent = { caption: '' }; // Fallback ke caption kosong jika JSON tidak valid
          }

          const cacheKey = `file_content:${path}`;
          await kv.set(cacheKey, parsedContent, { ex: 3600 }); // Cache selama 1 jam
          return { path, content: parsedContent };
        } catch (error) {
          console.error(`Error fetching file content for path ${path}:`, error.response?.data || error.message);
          return { path, content: null };
        }
      });

      const fetchedResults = await Promise.allSettled(promises);

      fetchedResults.forEach((result, index) => {
        const path = pathsToFetch[index];
        if (result.status === 'fulfilled') {
          results[path] = result.value.content;
        } else {
          console.error(`Error in Promise for path ${path}:`, result.reason);
          results[path] = null; // Jika gagal, set null
        }
      });
    } catch (error) {
      console.error('Error fetching file contents:', error.response?.data || error.message);
      pathsToFetch.forEach(path => {
        results[path] = null; // Jika terjadi error, set null untuk path yang gagal
      });
    }
  }

  res.status(200).json(results);
};
