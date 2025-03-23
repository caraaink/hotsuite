const { Octokit } = require('@octokit/rest');

module.exports = async (req, res) => {
    const { fileName, content } = req.body;

    if (!fileName || !content) {
        return res.status(400).json({ error: 'Missing required fields: fileName and content' });
    }

    try {
        const octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN,
        });

        const owner = 'caraaink';
        const repo = 'hotsuite';
        const path = `ig/image/${fileName}`;
        const message = `Upload file ${fileName} to ig/image`;

        // Cek apakah file sudah ada
        let sha = null;
        try {
            const { data } = await octokit.repos.getContent({
                owner,
                repo,
                path,
            });
            sha = data.sha; // Jika file sudah ada, kita akan memperbarui (update)
        } catch (error) {
            if (error.status !== 404) {
                throw error; // Jika error bukan 404, lempar error
            }
        }

        // Upload file ke GitHub
        const response = await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path,
            message,
            content, // Konten dalam base64
            sha, // Jika file sudah ada, sertakan sha untuk update
        });

        const download_url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
        res.status(200).json({ message: `File ${fileName} berhasil diunggah ke GitHub!`, download_url });
    } catch (error) {
        console.error('Error uploading to GitHub:', error.message);
        res.status(500).json({ error: 'Failed to upload to GitHub', details: error.message });
    }
};
