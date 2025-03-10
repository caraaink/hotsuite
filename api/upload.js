const fs = require("fs").promises;
const path = require("path");
const formidable = require("formidable");

const CONFIG_PATH = path.join(__dirname, "../config.json");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REPO_OWNER = "caraaink";
const REPO_NAME = "hotsuite";
const FILE_PATH = "config.json";

async function getConfig() {
    try {
        const configData = await fs.readFile(CONFIG_PATH, "utf8");
        return JSON.parse(configData);
    } catch (error) {
        console.error("Error reading config:", error);
        return { ACCESS_TOKEN: "" };
    }
}

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
        throw new Error("Gagal memperbarui config di GitHub: " + (await updateResponse.text()));
    }
}

async function refreshToken(currentToken) {
    const url = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=573551255726328&client_secret=${CLIENT_SECRET}&fb_exchange_token=${currentToken}`;
    const response = await fetch(url, { method: "GET" });
    const data = await response.json();

    if (data.access_token) {
        return data.access_token;
    } else {
        throw new Error("Gagal merefresh token: " + JSON.stringify(data));
    }
}

// Endpoint untuk refresh token secara manual
module.exports.refreshToken = async (req, res) => {
    try {
        const config = await getConfig();
        const newToken = await refreshToken(config.ACCESS_TOKEN);
        await updateConfigInGitHub(newToken);
        res.status(200).json({ message: "Token berhasil direfresh: " + newToken });
    } catch (error) {
        res.status(500).json({ message: "Gagal merefresh token: " + error.message });
    }
};

// Endpoint untuk upload (tanpa refresh token per submit)
module.exports.upload = async (req, res) => {
    let accountId, imageUrl, caption;

    try {
        const { fields } = await parseForm(req);
        accountId = fields.accountId;
        imageUrl = fields.imageUrl;
        caption = fields.caption;
        console.log("Received fields:", fields);
    } catch (error) {
        return res.status(400).json({ message: "Gagal memparsing form: " + error.message });
    }

    if (!imageUrl) {
        return res.status(400).json({ message: "Gagal: Harap masukkan URL gambar." });
    }

    let config = await getConfig();
    let ACCESS_TOKEN = config.ACCESS_TOKEN;

    // Tidak ada refresh token di sini, gunakan token yang ada
    if (!ACCESS_TOKEN) {
        return res.status(500).json({ message: "Gagal: Token akses tidak tersedia. Silakan refresh token secara manual." });
    }

    const igMediaResponse = await fetch(`https://graph.facebook.com/v19.0/${accountId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            image_url: imageUrl,
            caption: caption,
            access_token: ACCESS_TOKEN
        })
    });
    const igMediaData = await igMediaResponse.json();

    if (!igMediaData.id) {
        const errorMessage = igMediaData.error?.message || "Unknown error";
        if (errorMessage.includes("Media tidak dapat diambil dari URI")) {
            return res.status(500).json({
                message: `Gagal mengunggah ke Instagram: ${JSON.stringify(igMediaData)}. Nama file mungkin terlalu panjang atau mengandung karakter khusus. Coba ganti nama file dan unggah ulang.`
            });
        }
        return res.status(500).json({ message: `Gagal mengunggah ke Instagram: ${JSON.stringify(igMediaData)}` });
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
        return res.status(500).json({ message: "Gagal mempublikasikan ke Instagram." });
    }
};

async function parseForm(req) {
    const form = new formidable.IncomingForm();
    return new Promise((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
            if (err) return reject(err);
            resolve({ fields, files });
        });
    });
}