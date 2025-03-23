const axios = require('axios');
const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  const { paths } = req.query;

  if (!paths) {
    return res.status(400).json({ error: 'Paths are required' });
  }

  // paths bisa berupa string (satu path) atau array (multiple paths)
  const pathArray = Array.isArray(paths) ? paths : [paths];

  // Cek cache untuk semua path
  const results = {};
  const pathsToFetch = [];

  for (const path of pathArray) {
    const cacheKey = `file_content:${path}`;
    const cachedContent = await kv.get(cacheKey);
    if (cachedContent) {
      console.log(`Returning cached content for path: ${path}`);
      results[path] = cachedContent;
    } else {
      pathsToFetch.push(path);
    }
  }

  // Jika ada path yang tidak ada di cache, ambil dari GitHub
  if (pathsToFetch.length > 0) {
    try {
      const promises = pathsToFetch.map(async (path) => {
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
        const parsedContent = JSON.parse(content);
        const cacheKey = `file_content:${path}`;
        await kv.set(cacheKey, parsedContent, { ex: 3600 }); // Cache selama 1 jam
        return { path, content: parsedContent };
      });

      const fetchedResults = await Promise.allSettled(promises);

      fetchedResults.forEach((result, index) => {
        const path = pathsToFetch[index];
        if (result.status === 'fulfilled') {
          results[path] = result.value.content;
        } else {
          console.error(`Error fetching file content for path ${path}:`, result.reason?.response?.data || result.reason?.message);
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
