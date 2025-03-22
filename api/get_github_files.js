import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

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

    // Set timeout untuk fetch (5 detik)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`,
      {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch GitHub files: ${response.statusText} - ${errorText}`);
    }

    const files = await response.json();
    res.status(200).json({ files });
  } catch (error) {
    console.error('Error fetching GitHub files:', error);
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request to GitHub timed out' });
    }
    res.status(500).json({ error: 'Failed to fetch GitHub files', details: error.message });
  }
}
