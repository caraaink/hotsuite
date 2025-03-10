const path = require("path");
const fs = require("fs").promises;
const fetch = require("node-fetch");

const CONFIG_PATH = path.join(__dirname, "../config.json");

// Fungsi untuk membaca config
async function getConfig() {
    try {
        const rawData = await fs.readFile(CONFIG_PATH, "utf-8");
        return JSON.parse(rawData);
    } catch (error) {
        throw new Error("Gagal membaca config.json: " + error.message);
    }
}

// Fungsi untuk menukar token short-lived ke long-lived token (Facebook)
async function exchangeToLongLivedToken(shortLivedToken) {
    const appId = process.env.FACEBOOK_APP_ID || "573551255726328"; // Ambil dari env atau fallback ke default
    const appSecret = process.env.CLIENT_SECRET; // Ambil dari env (sudah diatur di Vercel)
    if (!appSecret) throw new Error("CLIENT_SECRET tidak ditemukan di environment variables.");

    const url = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(`Gagal tukar token: ${data.error?.message || "Unknown error"}`);
    }
    return data.access_token;
}

// Fungsi untuk merefresh token (Instagram)
async function refreshToken(accessToken) {
    const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`;
    const response = await fetch(url);
    const data = await response.json();

    console.log("Refresh Token Response:", data); // Log response untuk debugging
    if (!response.ok) {
        throw new Error(`Gagal merefresh token: ${data.error?.message || "Unknown error"}`);
    }
    return data.access_token;
}

// Fungsi untuk memperbarui config di GitHub
async function updateConfigInGitHub(newToken) {
    const config = await getConfig();
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) throw new Error("GITHUB_TOKEN tidak ditemukan di environment variables.");

    config.ACCESS_TOKEN = newToken;
    const updatedConfig = JSON.stringify(config, null, 2);

    const repoOwner = "caraaink";
    const repoName = "hotsuite";
    const filePath = "config.json";
    const getFileUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;
    const getFileResponse = await fetch(getFileUrl, {
        headers: { Authorization: `token ${githubToken}`, Accept: "application/vnd.github.v3+json" },
    });
    const fileData = await getFileResponse.json();

    if (!getFileResponse.ok) throw new Error("Gagal mengambil file dari GitHub: " + fileData.message);

    const updateFileUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;
    const updateResponse = await fetch(updateFileUrl, {
        method: "PUT",
        headers: { Authorization: `token ${githubToken}`, Accept: "application/vnd.github.v3+json" },
        body: JSON.stringify({
            message: "Update ACCESS_TOKEN in config.json",
            content: Buffer.from(updatedConfig).toString("base64"),
            sha: fileData.sha,
            branch: "main",
        }),
    });
    const updateData = await updateResponse.json();
    if (!updateResponse.ok) throw new Error("Gagal memperbarui file di GitHub: " + updateData.message);

    await fs.writeFile(CONFIG_PATH, updatedConfig, "utf-8");
}

// Handler utama untuk endpoint /api/refresh-token
module.exports = async (req, res) => {
    const loginCode = req.query.login;
    if (loginCode !== "emi") {
        return res.status(403).json({ message: "Akses ditolak. Kode login salah." });
    }

    try {
        const config = await getConfig();
        let currentToken = config.ACCESS_TOKEN;

        // Jika token adalah token Facebook (dimulai dengan "EAA"), tukar ke long-lived token
        if (currentToken.startsWith("EAA")) {
            currentToken = await exchangeToLongLivedToken(currentToken);
        }

        // Refresh token yang sudah long-lived
        const newToken = await refreshToken(currentToken);

        // Simpan token baru ke GitHub
        await updateConfigInGitHub(newToken);

        res.status(200).json({ message: "Token berhasil direfresh." });
    } catch (error) {
        console.error("Refresh token error:", error.message);
        res.status(500).json({ message: "Gagal merefresh token: " + error.message });
    }
};
