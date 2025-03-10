const path = require("path");
const fs = require("fs").promises;
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)); // Dynamic import untuk kompatibilitas

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
    const appId = "573551255726328";
    const appSecret = process.env.CLIENT_SECRET || "46cbbde0a360da161359e4cab05cf0ee";

    const url = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
    const response = await fetch(url);
    const text = await response.text(); // Ambil teks terlebih dahulu
    console.log("Raw Response:", text);

    let data;
    try {
        data = JSON.parse(text);
    } catch (parseError) {
        throw new Error(`Invalid JSON response: ${text.substring(0, 50)}... (Parse error: ${parseError.message})`);
    }

    if (!response.ok) {
        throw new Error(`Gagal tukar token: ${data.error?.message || "Unknown error"} (Status: ${response.status})`);
    }
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

    if (!getFileResponse.ok) {
        throw new Error(`Gagal mengambil file dari GitHub: ${fileData.message} (Status: ${getFileResponse.status})`);
    }

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

    if (!updateResponse.ok) {
        throw new Error(`Gagal memperbarui file di GitHub: ${updateData.message} (Status: ${updateResponse.status})`);
    }

    await fs.writeFile(CONFIG_PATH, updatedConfig, "utf-8");
}

module.exports = async (req, res) => {
    const loginCode = req.query.login;
    if (loginCode !== "emi") {
        return res.status(403).json({ message: "Akses ditolak. Kode login salah." });
    }

    try {
        const config = await getConfig();
        console.log("Current Access Token:", config.ACCESS_TOKEN);

        const shortLivedToken = config.ACCESS_TOKEN;
        const newToken = await exchangeToLongLivedToken(shortLivedToken);
        await updateConfigInGitHub(newToken);

        res.status(200).json({ message: "Token berhasil ditukar ke long-lived: " + newToken });
    } catch (error) {
        console.error("Error in token exchange:", error);
        res.status(500).json({ message: "Gagal menukar token: " + error.message });
    }
};
