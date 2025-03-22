import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const repoOwner = 'caraaink';
    const repoName = 'hotsuite';
    const filePath = 'data/schedules.json';
    const githubToken = process.env.GITHUB_TOKEN;

    if (!githubToken) {
      return res.status(500).json({ error: 'GitHub token not configured' });
    }

    // Set timeout untuk fetch (5 detik)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
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
      throw new Error(`Failed to fetch schedules from GitHub: ${response.statusText} - ${errorText}`);
    }

    const fileData = await response.json();
    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const schedules = JSON.parse(content);

    res.status(200).json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request to GitHub timed out' });
    }
    res.status(500).json({ error: 'Failed to fetch schedules', details: error.message });
  }
}
