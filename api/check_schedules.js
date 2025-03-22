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
    let schedules = schedulesData.schedules || [];

    const now = new Date();
    let updated = false;

    for (let i = 0; i < schedules.length; i++) {
      const schedule = schedules[i];
      if (schedule.completed) continue;

      const scheduleTime = new Date(schedule.time);
      if (now >= scheduleTime) {
        const publishResponse = await fetch('https://hotsuite.vercel.app/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: schedule.accountId,
            mediaUrl: schedule.mediaUrl,
            caption: schedule.caption,
            userToken: schedule.userToken,
          }),
        });

        if (publishResponse.ok) {
          schedules[i].completed = true;
          updated = true;
        } else {
          console.error(`Failed to publish schedule ${i}: ${publishResponse.statusText}`);
        }
      }
    }

    if (updated) {
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
            message: 'Update schedules after publishing',
            content: newContent,
            sha: fileData.sha,
          }),
        }
      );

      if (!updateResponse.ok) {
        throw new Error(`Failed to update schedules on GitHub: ${updateResponse.statusText}`);
      }
    }

    res.status(200).json({ message: 'Schedules checked and updated' });
  } catch (error) {
    console.error('Error checking schedules:', error);
    res.status(500).json({ error: 'Failed to check schedules', details: error.message });
  }
}
