const path = require("path");
const fs = require("fs").promises;
const fetch = require("node-fetch");

const CONFIG_PATH = path.join(__dirname, "../config.json");

async function getConfig() {
    try {
        const rawData = await fs.readFile(CONFIG_PATH, "utf-8");
        return JSON.parse(rawData);
    } catch (error) {
        throw new Error("Gagal membaca config.json: " + error.message);
    }
}

async function exchangeToLongLivedToken(shortLivedToken) {
    const appId = "573551255726328"; // Ganti dengan App ID dari Facebook Developer
    const appSecret = process.env.CLIENT_SECRET;
    const url = `https://graph.instagram.com/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) throw new Error("Gagal tukar token: " + data.error?.message);
    return data.access_token;
}

async function refreshToken(accessToken) {
    const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`;
    const response = await fetch(url);
    const text = await response.text(); // Log raw response
    console.log("Refresh Token Response:", text);
    const data = await response.json();
    if (!response.ok) throw new Error("Gagal merefresh token: " + (data.error?.message || "Invalid JSON: " + text));
    return data.access_token;
}

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

module.exports = async (req, res) => {
    const loginCode = req.query.login;
    if (loginCode !== "emi") {
        return res.status(403).json({ message: "Akses ditolak. Kode login salah." });
    }

    try {
        const config = await getConfig();
        console.log("Access Token:", config.ACCESS_TOKEN);

        // Tukar ke long-lived token jika perlu
        let longLivedToken = config.ACCESS_TOKEN;
        // Uncomment dan isi appId jika perlu tukar token
        // longLivedToken = await exchangeToLongLivedToken(config.ACCESS_TOKEN);

        const newToken = await refreshToken(longLivedToken);
        await updateConfigInGitHub(newToken);
        res.status(200).json({ message: "Token berhasil direfresh: " + newToken });
    } catch (error) {
        res.status(500).json({ message: "Gagal merefresh token: " + error.message });
    }
};
