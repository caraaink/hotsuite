const fs = require("fs").promises;
const path = require("path");
const formidable = require("formidable");

const CONFIG_PATH = path.join(__dirname, "../config.json");

async function getConfig() {
    try {
        const configData = await fs.readFile(CONFIG_PATH, "utf8");
        return JSON.parse(configData);
    } catch (error) {
        console.error("Error reading config:", error);
        return { ACCESS_TOKEN: "" };
    }
}

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
        return res.status(500).json({ message: "Gagal: Token akses tidak tersedia. Silakan refresh token secara manual di /api/refresh-token." });
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