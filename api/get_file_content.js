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
      return res.status(404).json({ error: 'File not found' });
    }

    const fileData = await response.json();
    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    res.status(200).json(JSON.parse(content));
  } catch (error) {
    console.error('Error fetching file content:', error);
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request to GitHub timed out' });
    }
    res.status(500).json({ error: 'Failed to fetch file content', details: error.message });
  }
}
