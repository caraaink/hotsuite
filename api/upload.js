const formidable = require("formidable");
const fetch = require("node-fetch");
const fs = require("fs").promises;
const path = require("path");

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

// Fungsi untuk memeriksa apakah URL dapat diakses
async function isUrlAccessible(url) {
    let urlString = url;
    if (Array.isArray(url)) {
        console.log("URL received as array, using first element:", url);
        urlString = url[0];
    } else if (typeof url !== "string" || !url) {
        throw new Error(`URL ${url} tidak valid: Harus berupa string yang tidak kosong.`);
    }

    console.log("Checking URL accessibility for:", urlString, "Type:", typeof urlString);
    if (!urlString.startsWith("https://")) {
        throw new Error(`URL ${urlString} tidak valid. Harus menggunakan HTTPS.`);
    }

    try {
        const response = await fetch(urlString, { method: "HEAD" });
        console.log(`URL ${urlString} accessibility check: ${response.ok}, Status: ${response.status}`);
        if (!response.ok) {
            throw new Error(`URL ${urlString} tidak dapat diakses, status: ${response.status}`);
        }
        return true;
    } catch (error) {
        console.error(`URL ${urlString} tidak dapat diakses:`, error.message);
        throw error;
    }
}

// Fungsi untuk mengunduh gambar dari URL dan mengunggah ke ImgBB
async function uploadToImgBBFromUrl(imageUrl) {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Gagal mengunduh gambar dari ${imageUrl}, status: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer(); // Gunakan arrayBuffer untuk kompatibilitas
        const blob = new Blob([new Uint8Array(arrayBuffer)], { type: response.headers.get("content-type") || "application/octet-stream" });
        const formData = new FormData();
        const randomNum = Math.floor(10000 + Math.random() * 90000).toString();
        formData.append("image", blob, `${randomNum}.jpg`); // Gunakan ekstensi default .jpg
        formData.append("key", "a54b42bd860469def254d13b8f55f43e");

        const uploadResponse = await fetch("https://api.imgbb.com/1/upload", {
            method: "POST",
            body: formData,
        });

        const result = await uploadResponse.json();
        if (!result.success) throw new Error("Gagal mengunggah ke ImgBB: " + JSON.stringify(result));
        console.log("Upload to ImgBB successful, new URL:", result.data.url);
        return result.data.url;
    } catch (error) {
        console.error("Upload to ImgBB failed:", error.message);
        throw error;
    }
}

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
            await isUrlAccessible(photoUrl);

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
            const igMediaText = await igMediaResponse.text();
            console.log("Instagram Media Creation Raw Response:", igMediaText);

            let igMediaData;
            try {
                igMediaData = JSON.parse(igMediaText);
            } catch (parseError) {
                console.error("Failed to parse Instagram response as JSON:", igMediaText);
                if (igMediaText.includes("Sorry, this content isn't available right now")) {
                    throw new Error("Gagal memposting ke Instagram: Akun atau izin tidak valid.");
                }
                throw new Error(`Gagal memparsing respons Instagram: ${parseError.message}`);
            }

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

module.exports = async (req, res) => {
    const loginCode = req.query.login;
    if (loginCode !== "emi") {
        return res.status(403).json({ message: "Akses ditolak. Kode login salah." });
    }

    try {
        const form = new formidable.IncomingForm();
        form.parse(req, async (err, fields, files) => {
            if (err) {
                return res.status(500).json({ message: "Gagal memproses form: " + err.message });
            }

            const config = await getConfig();
            const userAccessToken = config.ACCESS_TOKEN;

            const accountId = fields.accountId || "";
            const caption = fields.caption || "Foto baru diunggah!";
            let photoUrl = "";

            if (!accountId) {
                return res.status(400).json({ message: "Gagal: Pilih akun Instagram terlebih dahulu!" });
            }

            const pageId = accountToPageMapping[accountId];
            if (!pageId) {
                return res.status(400).json({ message: "Gagal: ID halaman Facebook untuk akun ini tidak ditemukan!" });
            }

            // Proses file atau URL
            if (files.photo) {
                const formData = new FormData();
                const sanitizedFile = sanitizeFileName(files.photo[0]);
                formData.append("image", sanitizedFile);
                formData.append("key", "a54b42bd860469def254d13b8f55f43e");

                const response = await fetch("https://api.imgbb.com/1/upload", {
                    method: "POST",
                    body: formData,
                });
                const result = await response.json();
                if (!result.success) throw new Error("Gagal mengunggah ke ImgBB: " + JSON.stringify(result));
                photoUrl = result.data.url;
            } else if (fields.imageUrl) {
                const imageUrl = fields.imageUrl[0];
                await isUrlAccessible(imageUrl);
                photoUrl = imageUrl; // Gunakan URL langsung untuk posting ke Instagram/Facebook
                // Opsional: Jika ingin tetap unggah ke ImgBB, aktifkan baris di bawah
                // photoUrl = await uploadToImgBBFromUrl(imageUrl);
            } else {
                return res.status(400).json({ message: "Gagal: Tidak ada file atau URL yang diberikan!" });
            }

            const pageAccessToken = await getPageAccessToken(pageId, userAccessToken);

            const fbPostId = await postToFacebook(pageId, photoUrl, caption, pageAccessToken);

            const igPostId = await postToInstagram(accountId, photoUrl, caption, userAccessToken);

            const message = "Foto berhasil diposting ke Facebook dan Instagram!";

            res.status(200).json({
                message: message,
                facebookPostId: fbPostId,
                instagramPostId: igPostId,
            });
        });
    } catch (error) {
        console.error("Upload error:", error.message);
        res.status(500).json({ message: "Gagal memposting foto: " + error.message });
    }
};

// Fungsi sanitasi nama file (digunakan di backend untuk file lokal)
function sanitizeFileName(file) {
    const randomNum = Math.floor(10000 + Math.random() * 90000).toString();
    const extension = file.originalFilename.split('.').pop().toLowerCase();
    return new File([file], `${randomNum}.${extension}`, { type: file.mimetype });
}
