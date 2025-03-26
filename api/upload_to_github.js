const { Octokit } = require("@octokit/rest");

module.exports = async (req, res) => {
    const { fileName, content, message } = req.body;

    if (!fileName || !content) {
        return res.status(400).json({ error: "Missing fileName or content" });
    }

    // Validasi path: pastikan tidak langsung ke 'ig' atau subfolder selain 'ig/image' jika tidak diizinkan
    if (fileName.startsWith('ig/') && !fileName.startsWith('ig/image/')) {
        return res.status(400).json({ error: "Cannot upload directly to 'ig' or its subfolders except 'ig/image'" });
    }

    const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
    });

    try {
        let sha;
        try {
            const { data } = await octokit.repos.getContent({
                owner: "caraaink",
                repo: "hotsuite",
                path: fileName,
            });
            sha = data.sha;
            console.log(`File ${fileName} already exists, SHA: ${sha}`);
        } catch (error) {
            if (error.status !== 404) {
                console.error("Error checking file existence:", error.message);
                return res.status(500).json({ error: "Failed to check file existence", details: error.message });
            }
            console.log(`File ${fileName} does not exist yet`);
        }

        console.log(`Uploading to GitHub: ${fileName}`);
        const response = await octokit.repos.createOrUpdateFileContents({
            owner: "caraaink",
            repo: "hotsuite",
            path: fileName,
            message: message || `Upload ${fileName}`,
            content: content,
            sha: sha,
        });

        console.log(`Successfully uploaded ${fileName}`);
        res.status(200).json({
            download_url: response.data.content.download_url,
        });
    } catch (error) {
        console.error("Error uploading to GitHub:", error.message, error.status);
        res.status(error.status || 500).json({ error: "Failed to upload to GitHub", details: error.message });
    }
};
