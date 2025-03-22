const axios = require('axios');

module.exports = async (req, res) => {
  const { path = 'ig' } = req.query; // Default ke folder 'ig'
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    return res.status(500).json({ message: 'GITHUB_TOKEN not found in environment variables' });
  }

  try {
    const response = await axios.get(`https://api.github.com/repos/caraaink/hotsuite/contents/${path}`, {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    const files = response.data.map(item => ({
      name: item.name,
      path: item.path,
      type: item.type, // 'file' atau 'dir'
      download_url: item.download_url, // URL untuk file
    }));

    res.status(200).json({ files });
  } catch (error) {
    console.error('Error fetching GitHub files:', error.response?.data || error.message);
    res.status(500).json({ message: `Failed to fetch GitHub files: ${error.message}` });
  }
};
