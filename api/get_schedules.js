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

    const response = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
      {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch schedules from GitHub: ${response.statusText}`);
    }

    const fileData = await response.json();
    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const schedules = JSON.parse(content);

    res.status(200).json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules', details: error.message });
  }
}
