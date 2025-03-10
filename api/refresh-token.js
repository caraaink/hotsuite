const path = require("path");
const fs = require("fs").promises;
const fetch = require("node-fetch");

// Path ke config.json (di root proyek)
const CONFIG_PATH = path.join(__dirname, "../config.json");

// Fungsi untuk membaca config.json
async function getConfig() {
    try {
        const rawData = await fs.readFile(CONFIG_PATH, "utf-8");
        return JSON.parse(rawData);
    } catch (error) {
        throw new Error("Gagal membaca config.json: " + error.message);
    }
}

// Fungsi untuk merefresh token Instagram
async function refreshToken(accessToken) {
    const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
        throw new Error("Gagal merefresh token: " + (data.error?.message || "Unknown error"));
    }

    return data.access_token;
}

// Fungsi untuk memperbarui config.json di GitHub
async function updateConfigInGitHub(newToken) {
    const config = await getConfig();
    const githubToken = process.env.GITHUB_TOKEN;
    const clientSecret = process.env.CLIENT_SECRET;

    if (!githubToken || !clientSecret) {
        throw new Error("GITHUB_TOKEN atau CLIENT_SECRET tidak ditemukan di environment variables.");
    }

    // Update token di config
    config.ACCESS_TOKEN = newToken;
    const updatedConfig = JSON.stringify(config, null, 2);

    // Ambil SHA file config.json dari GitHub
    const repoOwner = "caraaink";
    const repoName = "hotsuite";
    const filePath = "config.json";
    const getFileUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;
    const getFileResponse = await fetch(getFileUrl, {
        headers: {
            Authorization: `token ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
        },
    });
    const fileData = await getFileResponse.json();

    if (!getFileResponse.ok) {
        throw new Error("Gagal mengambil file dari GitHub: " + (fileData.message || "Unknown error"));
    }

    // Update file di GitHub
    const updateFileUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;
    const updateResponse = await fetch(updateFileUrl, {
        method: "PUT",
        headers: {
            Authorization: `token ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({
            message: "Update ACCESS_TOKEN in config.json",
            content: Buffer.from(updatedConfig).toString("base64"),
            sha: fileData.sha,
            branch: "main",
        }),
    });

    const updateData = await updateResponse.json();
    if (!updateResponse.ok) {
        throw new Error("Gagal memperbarui file di GitHub: " + (updateData.message || "Unknown error"));
    }

    // Update file lokal (opsional, kalau Vercel butuh file lokal)
    await fs.writeFile(CONFIG_PATH, updatedConfig, "utf-8");
}

// Handler utama untuk endpoint
module.exports = async (req, res) => {
    // Cek kode login
    const loginCode = req.query.login;
    if (loginCode !== "emi") {
        return res.status(403).json({ message: "Akses ditolak. Kode login salah." });
    }

    try {
        // Ambil config
        const config = await getConfig();

        // Refresh token
        const newToken = await refreshToken(config.ACCESS_TOKEN);

        // Update config di GitHub
        await updateConfigInGitHub(newToken);

        // Kirim respons sukses
        res.status(200).json({ message: "Token berhasil direfresh: " + newToken });
    } catch (error) {
        res.status(500).json({ message: "Gagal merefresh token: " + error.message });
    }
};
