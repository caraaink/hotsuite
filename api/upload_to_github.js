const { Octokit } = require("@octokit/rest");

module.exports = async (req, res) => {
    const { fileName, content, message } = req.body;

    if (!fileName || !content) {
        return res.status(400).json({ error: "Missing fileName or content" });
    }

    const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
    });

    try {
        // Cek apakah file sudah ada untuk mendapatkan SHA (jika diperlukan untuk update)
        let sha;
        try {
            const { data } = await octokit.repos.getContent({
                owner: "caraaink", // Ganti dengan owner repository kamu
                repo: "hotsuite", // Ganti dengan nama repository kamu
                path: fileName,
            });
            sha = data.sha;
        } catch (error) {
            if (error.status !== 404) throw error;
        }

        // Upload file ke GitHub
        const response = await octokit.repos.createOrUpdateFileContents({
            owner: "caraaink", // Ganti dengan owner repository kamu
            repo: "hotsuite", // Ganti dengan nama repository kamu
            path: fileName,
            message: message || `Upload ${fileName}`, // Gunakan message dari request, atau default
            content: content,
            sha: sha, // Sertakan SHA jika file sudah ada (untuk update)
        });

        res.status(200).json({
            download_url: response.data.content.download_url,
        });
    } catch (error) {
        console.error("Error uploading to GitHub:", error);
        res.status(error.status || 500).json({ error: error.message });
    }
};
