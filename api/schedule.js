import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accountId, username, mediaUrl, caption, time, userToken, accountNum, completed } = req.body;

    if (!accountId || !mediaUrl || !time || !userToken || !accountNum) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const repoOwner = 'caraaink';
    const repoName = 'hotsuite';
    const filePath = 'data/schedules.json';
    const githubToken = process.env.GITHUB_TOKEN;

    if (!githubToken) {
      return res.status(500).json({ error: 'GitHub token not configured' });
    }

    const getFileResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
      {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!getFileResponse.ok) {
      throw new Error(`Failed to fetch schedules from GitHub: ${getFileResponse.statusText}`);
    }

    const fileData = await getFileResponse.json();
    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const schedulesData = JSON.parse(content);
    const schedules = schedulesData.schedules || [];

    schedules.push({
      accountId,
      username,
      mediaUrl,
      caption,
      time,
      userToken,
      accountNum,
      completed: completed || false,
    });

    const newContent = Buffer.from(JSON.stringify({ schedules }, null, 2)).toString('base64');

    const updateResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          message: 'Add new schedule',
          content: newContent,
          sha: fileData.sha,
        }),
      }
    );

    if (!updateResponse.ok) {
      throw new Error(`Failed to update schedules on GitHub: ${updateResponse.statusText}`);
    }

    res.status(200).json({ message: 'Schedule added successfully' });
  } catch (error) {
    console.error('Error scheduling post:', error);
    res.status(500).json({ error: 'Failed to schedule post', details: error.message });
  }
}
