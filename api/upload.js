const formidable = require("formidable");
const fetch = require("node-fetch");
const fs = require("fs").promises;
const path = require("path");
const FormData = require("form-data");

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

// Mapping antara Instagram accountId dan Facebook pageId
const accountToPageMapping = {
    "17841472299141470": "421553057719120", // Cika Cantika
    "17841469780026465": "406559659217723", // Raisa Ayunda
    "17841472886987230": "404952282707350", // Meownime v2
    "17841402777728356": "119316994437611"  // Meownime official
};

// Fungsi untuk delay (untuk menghindari rate limit)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fungsi untuk mendapatkan page access token
async function getPageAccessToken(pageId, userAccessToken) {
    const url = `https://graph.facebook.com/v19.0/${pageId}?fields=access_token&access_token=${userAccessToken}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(`Gagal mendapatkan page access token: ${data.error?.message || "Unknown error, status: " + response.status}`);
    }
    return data.access_token;
}

// Fungsi untuk memposting ke halaman Facebook
async function postToFacebook(pageId, photoUrl, caption, pageAccessToken) {
    console.log(`Posting to Facebook Page ID: ${pageId}, URL: ${photoUrl}`);
    const fbPostUrl = `https://graph.facebook.com/v19.0/${pageId}/photos`;
    const fbPostParams = {
        url: photoUrl,
        caption: caption,
        access_token: pageAccessToken,
        published: true,
    };

    const fbResponse = await fetch(fbPostUrl, {
        method: "POST",
        body: new URLSearchParams(fbPostParams).toString(),
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "curl/7.83.1",
            "Accept": "*/*",
        },
    });

    const fbData = await fbResponse.json();
    console.log("Facebook API Response:", fbData, "Status:", fbResponse.status);
    if (!fbResponse.ok) {
        throw new Error(`Gagal memposting ke Facebook: ${fbData.error?.message || "Unknown error, status: " + fbResponse.status}`);
    }
    return fbData.id;
}

// Fungsi untuk memposting ke Instagram dengan retry mechanism
async function postToInstagram(igAccountId, photoUrl, caption, userAccessToken, retries = 2) {
    console.log(`Posting to Instagram Account ID: ${igAccountId}, URL: ${photoUrl}`);
    const igMediaUrl = `https://graph.facebook.com/v19.0/${igAccountId}/media`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const igMediaParams = {
                image_url: photoUrl,
                caption: caption,
                access_token: userAccessToken,
            };

            const igMediaResponse = await fetch(igMediaUrl, {
                method: "POST",
                body: new URLSearchParams(igMediaParams).toString(),
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "curl/7.83.1",
                    "Accept": "*/*",
                },
            });

            console.log("Instagram Response Status:", igMediaResponse.status);
            const igMediaData = await igMediaResponse.json();

            if (!igMediaResponse.ok) {
                if (igMediaResponse.status === 429) {
                    console.log(`Rate limit terdeteksi, mencoba ulang (${attempt}/${retries})...`);
                    await delay(10000);
                    continue;
                }
                throw new Error(`Gagal membuat media di Instagram: ${igMediaData.error?.message || "Unknown error"}`);
            }

            const igPublishUrl = `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`;
            const igPublishParams = {
                creation_id: igMediaData.id,
                access_token: userAccessToken,
            };

            const igPublishResponse = await fetch(igPublishUrl, {
                method: "POST",
                body: new URLSearchParams(igPublishParams).toString(),
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "curl/7.83.1",
                    "Accept": "*/*",
                },
            });

            const igPublishData = await igPublishResponse.json();
            console.log("Instagram Publish Response:", igPublishData, "Status:", igPublishResponse.status);
            if (!igPublishResponse.ok) {
                throw new Error(`Gagal mempublikasikan ke Instagram: ${igPublishData.error?.message || "Unknown error"}`);
            }

            return igPublishData.id;
        } catch (error) {
            if (attempt === retries) {
                throw error;
            }
            console.log(`Gagal memposting ke Instagram, mencoba ulang (${attempt}/${retries})...`);
            await delay(10000);
        }
    }
}

// Fungsi untuk mengunggah ke ImgBB (untuk file lokal)
async function uploadToImgBB(file) {
    const formData = new FormData();
    const apiKey = "a54b42bd860469def254d13b8f55f43e"; // Ganti dengan API key Anda jika berbeda
    console.log("Mengunggah ke ImgBB:", file.originalFilename, file.size);

    const fileBuffer = await fs.readFile(file.filepath);
    formData.append("image", fileBuffer, {
        filename: file.originalFilename,
        contentType: file.mimetype,
    });
    formData.append("key", apiKey);

    const response = await fetch("https://api.imgbb.com/1/upload", {
        method: "POST",
        body: formData,
    });

    const result = await response.json();
    console.log("Respons ImgBB:", result);
    if (!result.success) {
        throw new Error(`Gagal mengunggah ke ImgBB: ${result.error?.message || "Unknown error"}`);
    }
    return result.data.url;
}

// Handler utama
module.exports = async (req, res) => {
    const loginCode = req.query.login;
    if (loginCode !== "emi") {
        return res.status(403).json({ message: "Akses ditolak. Kode login salah." });
    }

    const form = new formidable.IncomingForm({
        keepExtensions: true,
        maxFileSize: 10 * 1024 * 1024, // Batas 10MB
    });

    try {
        const [fields, files] = await form.parse(req);
        console.log("Fields:", fields, "Files:", files);

        const config = await getConfig();
        const userAccessToken = config.ACCESS_TOKEN;

        const accountId = fields.accountId?.[0] || "";
        const caption = fields.caption?.[0] || "Foto baru diunggah!";
        let photoUrl = "";

        if (!accountId) {
            return res.status(400).json({ message: "Gagal: Pilih akun Instagram terlebih dahulu!" });
        }

        const pageId = accountToPageMapping[accountId];
        if (!pageId) {
            return res.status(400).json({ message: "Gagal: ID halaman Facebook untuk akun ini tidak ditemukan!" });
        }

        if (files.photo?.[0]) {
            const file = files.photo[0];
            console.log("File diterima:", file.originalFilename, file.size);
            photoUrl = await uploadToImgBB(file);
        } else if (fields.imageUrl?.[0]) {
            const imageUrl = fields.imageUrl[0];
            if (!imageUrl.startsWith("https://")) {
                return res.status(400).json({ message: `Gagal: URL ${imageUrl} tidak valid. Harus menggunakan HTTPS.` });
            }
            photoUrl = imageUrl;
        } else {
            return res.status(400).json({ message: "Gagal: Tidak ada file atau URL yang diberikan!" });
        }

        const pageAccessToken = await getPageAccessToken(pageId, userAccessToken);
        const fbPostId = await postToFacebook(pageId, photoUrl, caption, pageAccessToken);
        const igPostId = await postToInstagram(accountId, photoUrl, caption, userAccessToken);

        res.status(200).json({
            message: "Foto berhasil diposting ke Facebook dan Instagram!",
            facebookPostId: fbPostId,
            instagramPostId: igPostId,
        });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ message: "Gagal memposting foto: " + error.message });
    }
};
