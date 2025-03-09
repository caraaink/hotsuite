const fs = require("fs").promises;
const path = require("path");
const formidable = require("formidable");

const CONFIG_PATH = path.join(__dirname, "../config.json");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Dari Vercel Environment Variables
const CLIENT_SECRET = process.env.CLIENT_SECRET; // Dari Vercel Environment Variables
const REPO_OWNER = "caraaink"; // Sesuai GitHub kamu
const REPO_NAME = "hotsuite"; // Sesuai repositori kamu
const FILE_PATH = "config.json";

// Fungsi untuk membaca config.json
async function getConfig() {
    try {
        const configData = await fs.readFile(CONFIG_PATH, "utf8");
        return JSON.parse(configData);
    } catch (error) {
        console.error("Error reading config:", error);
        return { ACCESS_TOKEN: "" };
    }
}

// Fungsi untuk memperbarui config.json di GitHub
async function updateConfigInGitHub(newToken) {
    const config = await getConfig();
    config.ACCESS_TOKEN = newToken;

    const getFileResponse = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
        {
            method: "GET",
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                "Accept": "application/vnd.github.v3+json"
            }
        }
    );
    const fileData = await getFileResponse.json();
    const sha = fileData.sha;

    const updateResponse = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
        {
            method: "PUT",
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                "Accept": "application/vnd.github.v3+json"
            },
            body: JSON.stringify({
                message: "Update ACCESS_TOKEN",
                content: Buffer.from(JSON.stringify(config, null, 2)).toString("base64"),
                sha: sha
            })
        }
    );

    if (updateResponse.ok) {
        console.log("Token updated in GitHub:", newToken);
        return true;
    } else {
        throw new Error("Failed to update config in GitHub: " + (await updateResponse.text()));
    }
}

// Fungsi untuk refresh token
async function refreshToken(currentToken) {
    const url = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=573551255726328&client_secret=${CLIENT_SECRET}&fb_exchange_token=${currentToken}`;
    const response = await fetch(url, { method: "GET" });
    const data = await response.json();

    if (data.access_token) {
        return data.access_token;
    } else {
        throw new Error("Failed to refresh token: " + JSON.stringify(data));
    }
}

// Parsing form-data dengan formidable v2
async function parseForm(req) {
    const form = new formidable.IncomingForm();
    return new Promise((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
            if (err) return reject(err);
            resolve({ fields, files });
        });
    });
}

module.exports = async (req, res) => {
    let accountId, imageUrl, caption, file;

    // Parsing form-data
    try {
        const { fields, files } = await parseForm(req);
        accountId = fields.accountId;
        imageUrl = fields.imageUrl;
        caption = fields.caption;
        file = files.image; // File gambar
    } catch (error) {
        return res.status(400).json({ message: "Gagal memparsing form: " + error.message });
    }

    if (!imageUrl && !file) {
        return res.status(400).json({ message: "Harap masukkan URL gambar atau unggah gambar." });
    }

    let config = await getConfig();
    let ACCESS_TOKEN = config.ACCESS_TOKEN;

    try {
        ACCESS_TOKEN = await refreshToken(ACCESS_TOKEN);
        await updateConfigInGitHub(ACCESS_TOKEN);
    } catch (error) {
        return res.status(500).json({ message: "Gagal merefresh atau menyimpan token: " + error.message });
    }

    let finalImageUrl = imageUrl;
    if (file) {
        const formData = new FormData();
        formData.append("image", Buffer.from(await fs.readFile(file.path)).toString("base64"));
        formData.append("key", "a54b42bd860469def254d13b8f55f43e");

        const imgbbResponse = await fetch("https://api.imgbb.com/1/upload", {
            method: "POST",
            body: formData
        });
        const imgbbData = await imgbbResponse.json();
        if (!imgbbData.success) {
            return res.status(500).json({ message: "Gagal mengunggah ke ImgBB." });
        }
        finalImageUrl = imgbbData.data.url;
    }

    const igMediaResponse = await fetch(`https://graph.facebook.com/v19.0/${accountId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            image_url: finalImageUrl,
            caption: caption,
            access_token: ACCESS_TOKEN
        })
    });
    const igMediaData = await igMediaResponse.json();

    if (!igMediaData.id) {
        return res.status(500).json({ message: "Gagal mengunggah ke Instagram: " + JSON.stringify(igMediaData) });
    }

    const igPublishResponse = await fetch(`https://graph.facebook.com/v19.0/${accountId}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            creation_id: igMediaData.id,
            access_token: ACCESS_TOKEN
        })
    });
    const igPublishData = await igPublishResponse.json();

    if (igPublishData.id) {
        res.status(200).json({ message: "Foto berhasil diunggah ke Instagram!" });
    } else {
        res.status(500).json({ message: "Gagal mempublikasikan ke Instagram." });
    }
};
