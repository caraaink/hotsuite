const { Octokit } = require('@octokit/rest');

module.exports = async (req, res) => {
    const { path, message } = req.body;

    if (!path) {
        return res.status(400).json({ error: 'Missing required field: path' });
    }

    // Validasi path: pastikan tidak menghapus folder 'ig' atau subfoldernya secara langsung
    if (path === 'ig' || (path.startsWith('ig/') && path.split('/').length <= 2 && path !== 'ig/image')) {
        return res.status(400).json({ error: "Cannot delete 'ig' or its direct subfolders except 'ig/image'" });
    }

    try {
        const octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN,
        });

        const owner = 'caraaink';
        const repo = 'hotsuite';

        // Hapus file utama (misalnya 42382.jpg)
        const deleteMessage = message || `Delete file ${path}`;
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path,
        });

        await octokit.repos.deleteFile({
            owner,
            repo,
            path,
            message: deleteMessage,
            sha: data.sha,
        });

        // Hapus file meta terkait (misalnya 42382.jpg.meta.json)
        const metaPath = `${path}.meta.json`;
        try {
            const { data: metaData } = await octokit.repos.getContent({
                owner,
                repo,
                path: metaPath,
            });

            const metaMessage = message ? message.replace(`Delete file ${path}`, `Delete meta file ${metaPath}`) : `Delete meta file ${metaPath}`;
            await octokit.repos.deleteFile({
                owner,
                repo,
                path: metaPath,
                message: metaMessage,
                sha: metaData.sha,
            });
            console.log(`Meta file ${metaPath} successfully deleted from GitHub!`);
        } catch (metaError) {
            if (metaError.status === 404) {
                console.log(`No meta file found for ${path}, skipping meta deletion.`);
            } else {
                console.error(`Error deleting meta file ${metaPath}:`, metaError.message);
                return res.status(500).json({ error: `Failed to delete meta file from GitHub`, details: metaError.message });
            }
        }

        res.status(200).json({ message: `File ${path} and its meta file (if any) successfully deleted from GitHub!` });
    } catch (error) {
        console.error('Error deleting from GitHub:', error.message);
        res.status(500).json({ error: 'Failed to delete from GitHub', details: error.message });
    }
};
