const axios = require('axios');

module.exports = async (req, res) => {
  const { path } = req.query;
  if (!path) {
    return res.status(400).json({ error: 'Path is required' });
  }

  try {
    let allFiles = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await axios.get(`https://api.github.com/repos/caraaink/hotsuite/contents/${path}`, {
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
        params: {
          per_page: 100, // Maksimum item per halaman
          page: page,
        },
      });

      const files = response.data;
      allFiles = allFiles.concat(files);

      // Cek apakah ada halaman berikutnya
      const linkHeader = response.headers.link;
      hasMore = linkHeader && linkHeader.includes('rel="next"');
      page++;
    }

    res.status(200).json({ files: allFiles });
  } catch (error) {
    console.error('Error fetching GitHub files:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch GitHub files' });
  }
};
