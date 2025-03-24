const { Octokit } = require('@octokit/rest');

module.exports = async (req, res) => {
    const { fileName, content } = req.body;

    if (!fileName || !content) {
        return res.status(400).json({ error: 'Missing required fields: fileName and content' });
    }

    // Validasi format file (jika bukan meta JSON)
    if (!fileName.endsWith('.meta.json')) {
        const allowedExtensions = ['.jpg', '.png', '.jpeg', '.mp4'];
        const fileExtension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
        if (!allowedExtensions.includes(fileExtension)) {
            return res.status(400).json({ error: 'File must be JPG, PNG, or MP4' });
        }
    }

    try {
        const octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN,
        });

        const owner = 'caraaink';
        const repo = 'hotsuite';
        const path = fileName; // Gunakan path langsung dari fileName
        const message = fileName.endsWith('.meta.json') 
            ? `Update meta file for ${fileName}` 
            : `Upload file ${fileName} to ${path.split('/').slice(0, -1).join('/')}`;

        // Cek apakah file sudah ada
        let sha = null;
        try {
            const { data } = await octokit.repos.getContent({
                owner,
                repo,
                path,
            });
            sha = data.sha;
        } catch (error) {
            if (error.status !== 404) {
                throw error;
            }
        }

        // Upload atau update file ke GitHub
        const response = await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path,
            message,
            content,
            sha,
        });

        const download_url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
        res.status(200).json({ message: `File ${fileName} berhasil diunggah ke GitHub!`, download_url });
    } catch (error) {
        console.error('Error uploading to GitHub:', error.message);
        res.status(500).json({ error: 'Failed to upload to GitHub', details: error.message });
    }
};
