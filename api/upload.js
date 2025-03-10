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

// Fungsi untuk memeriksa apakah URL dapat diakses dan valid
async function isUrlAccessible(url) {
    try {
        // Validasi format URL
        const imageExtensions = /\.(jpg|jpeg|png)$/i;
        if (!url.startsWith("https://") || !imageExtensions.test(url)) {
            throw new Error(`URL gambar ${url} tidak valid. Harus menggunakan HTTPS dan berakhiran .jpg, .jpeg, atau .png.`);
        }

        const response = await fetch(url, { method: "HEAD" });
        console.log(`URL ${url} accessibility check: ${response.ok}, Status: ${response.status}`);
        if (!response.ok) {
            throw new Error(`URL ${url} tidak dapat diakses, status: ${response.status}`);
        }
        return true;
    } catch (error) {
        console.error(`URL ${url} tidak dapat diakses:`, error.message);
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

    return fbData.id; // ID postingan Facebook
}

// Fungsi untuk memposting ke Instagram dengan retry mechanism
async function postToInstagram(igAccountId, photoUrl, caption, userAccessToken, retries = 2) {
    console.log(`Posting to Instagram Account ID: ${igAccountId}, URL: ${photoUrl}`);
    const igMediaUrl = `https://graph.facebook.com/v19.0/${igAccountId}/media`;
    const igMediaParams = {
        image_url: photoUrl,
        caption: caption,
        access_token: userAccessToken,
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            // Periksa apakah URL dapat diakses
            await isUrlAccessible(photoUrl);

            const igMediaResponse = await fetch(igMediaUrl, {
                method: "POST",
                body: new URLSearchParams(igMediaParams).toString(),
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "curl/7.83.1",
                    "Accept": "*/*",
                },
            });

            // Log header dan status
            console.log("Instagram Response Status:", igMediaResponse.status);
            console.log("Instagram Response Headers:", Object.fromEntries(igMediaResponse.headers.entries()));
            const rateLimitRemaining = igMediaResponse.headers.get("x-app-usage");
            console.log("Instagram Rate Limit Remaining:", rateLimitRemaining);

            const igMediaText = await igMediaResponse.text();
            console.log("Instagram Media Creation Raw Response:", igMediaText);

            let igMediaData;
            try {
                igMediaData = JSON.parse(igMediaText);
            } catch (parseError) {
                console.error("Invalid JSON from Instagram:", igMediaText);
                if (igMediaText.includes("Sorry, this content isn't available right now")) {
                    throw new Error("Gagal memposting ke Instagram: Akun atau izin tidak valid. Pastikan token memiliki 'instagram_content_publish' dan akun terkait dengan aplikasi.");
                } else {
                    throw new Error(`Gagal memparsing respons Instagram: ${parseError.message}, Raw response: ${igMediaText}`);
                }
            }
            console.log("Instagram Media Creation Parsed Response:", igMediaData);

            if (!igMediaResponse.ok) {
                if (igMediaResponse.status === 429 || (igMediaData.error && igMediaData.error.message.includes("rate limit"))) {
                    console.log(`Rate limit terdeteksi, mencoba ulang (${attempt}/${retries})...`);
                    await delay(10000); // Delay 10 detik sebelum retry
                    continue;
                }
                throw new Error(`Gagal membuat media Instagram: ${igMediaData.error?.message || "Unknown error, status: " + igMediaResponse.status}`);
            }

            // Publish media
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
                throw new Error(`Gagal mempublikasikan ke Instagram: ${igPublishData.error?.message || "Unknown error, status: " + igPublishResponse.status}`);
            }

            return igPublishData.id;
        } catch (error) {
            if (attempt === retries) {
                throw error; // Jika sudah mencapai batas retry, lempar error
            }
            console.log(`Gagal memposting ke Instagram, mencoba ulang (${attempt}/${retries})...`);
            await delay(10000); // Delay 10 detik sebelum retry
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

            // Ambil data dari form
            const accountId = fields.accountId || "";
            const photoUrl = fields.imageUrl || "";
            const caption = fields.caption || "Foto baru diunggah!";

            if (!accountId) {
                return res.status(400).json({ message: "Gagal: Pilih akun Instagram terlebih dahulu!" });
            }

            if (!photoUrl) {
                return res.status(400).json({ message: "Gagal: URL foto tidak ditemukan!" });
            }

            // Dapatkan pageId berdasarkan accountId
            const pageId = accountToPageMapping[accountId];
            if (!pageId) {
                return res.status(400).json({ message: "Gagal: ID halaman Facebook untuk akun ini tidak ditemukan!" });
            }

            // Dapatkan page access token
            const pageAccessToken = await getPageAccessToken(pageId, userAccessToken);

            // Post ke Facebook
            const fbPostId = await postToFacebook(pageId, photoUrl, caption, pageAccessToken);

            // Post ke Instagram
            const igPostId = await postToInstagram(accountId, photoUrl, caption, userAccessToken);

            // Buat pesan respons
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
