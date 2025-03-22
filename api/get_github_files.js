import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req, res) {
  const { path } = req.query;

  if (!path) {
    return res.status(400).json({ error: 'Path is required' });
  }

  try {
    const githubToken = process.env.GITHUB_TOKEN;
    const repoOwner = 'caraaink';
    const repoName = 'hotsuite';

    if (!githubToken) {
      return res.status(500).json({ error: 'GitHub token not configured' });
    }

    const response = await axios.get(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`,
      {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
        timeout: 5000,
      }
    );

    const files = response.data;
    res.status(200).json({ files });
  } catch (error) {
    console.error('Error fetching GitHub files:', error);
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Request to GitHub timed out' });
    }
    res.status(500).json({ error: 'Failed to fetch GitHub files', details: error.message });
  }
}
