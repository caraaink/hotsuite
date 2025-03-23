const { Octokit } = require('@octokit/rest');

module.exports = async (req, res) => {
    const { path } = req.body;

    if (!path) {
        return res.status(400).json({ error: 'Missing required field: path' });
    }

    try {
        const octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN,
        });

        const owner = 'caraaink';
        const repo = 'hotsuite';
        const message = `Delete file ${path}`;

        // Dapatkan SHA file yang akan dihapus
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path,
        });

        // Hapus file dari GitHub
        await octokit.repos.deleteFile({
            owner,
            repo,
            path,
            message,
            sha: data.sha,
        });

        res.status(200).json({ message: `File ${path} berhasil dihapus dari GitHub!` });
    } catch (error) {
        console.error('Error deleting from GitHub:', error.message);
        res.status(500).json({ error: 'Failed to delete from GitHub', details: error.message });
    }
};
