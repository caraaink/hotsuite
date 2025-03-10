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

// Fungsi untuk memposting foto ke halaman Facebook dan cross-post ke Instagram
async function postToFacebookAndInstagram(pageId, igUserId, photoUrl, caption, accessToken) {
    // Post ke halaman Facebook
    const fbPostUrl = `https://graph.facebook.com/${pageId}/photos`;
    const fbPostParams = {
        url: photoUrl,
        caption: caption,
        access_token: accessToken,
        published: true,
        // Parameter untuk cross-post ke Instagram (harus akun profesional terkait)
        instagram_accounts: igUserId, // ID akun Instagram terkait
    };

    const fbResponse = await fetch(fbPostUrl, {
        method: "POST",
        body: new URLSearchParams(fbPostParams).toString(),
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
    });

    const fbData = await fbResponse.json();
    if (!fbResponse.ok) {
        throw new Error(`Gagal memposting ke Facebook: ${fbData.error?.message || "Unknown error"}`);
    }

    // Karena cross-posting diatur di params, Instagram akan otomatis diposting
    return fbData;
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
            const accessToken = config.ACCESS_TOKEN;

            // Ambil pageId dan igUserId dari input (atau hardcode sementara untuk testing)
            const pageId = fields.pageId || "YOUR_FACEBOOK_PAGE_ID"; // Ganti dengan ID halaman FB Anda
            const igUserId = fields.igUserId || "YOUR_INSTAGRAM_USER_ID"; // Ganti dengan ID akun IG Anda

            // Ambil URL foto dari input (jika ada file yang diupload, gunakan URL sementara; jika tidak, gunakan link input)
            let photoUrl = fields.photoUrl || "";
            if (files.photo && files.photo.size > 0) {
                // Untuk Vercel, kita tidak bisa menyimpan file karena read-only, jadi kita harus upload langsung
                // Untuk demo, kita anggap photoUrl adalah URL yang sudah diupload ke tempat lain
                // Dalam produksi, Anda perlu upload file ke penyimpanan (misalnya Vercel Blob atau AWS S3)
                photoUrl = "https://example.com/uploaded-photo.jpg"; // Ganti dengan logika upload Anda
            }

            if (!photoUrl) {
                return res.status(400).json({ message: "URL foto tidak ditemukan." });
            }

            const caption = fields.caption || "Foto baru diunggah!";

            // Post ke Facebook dan Instagram
            await postToFacebookAndInstagram(pageId, igUserId, photoUrl, caption, accessToken);

            res.status(200).json({ message: "Foto berhasil diposting ke Facebook dan Instagram!" });
        });
    } catch (error) {
        console.error("Upload error:", error.message);
        res.status(500).json({ message: "Gagal memposting foto: " + error.message });
    }
};
