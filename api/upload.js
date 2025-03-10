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

// Mapping antara Instagram accountId dan Facebook pageId berdasarkan data Anda
const accountToPageMapping = {
    "17841472299141470": "421553057719120", // Cika Cantika
    "17841469780026465": "406559659217723", // Raisa Ayunda
    "17841472886987230": "404952282707350", // Meownime v2
    "17841402777728356": "119316994437611"  // Meownime official
};

// Fungsi untuk memposting foto ke halaman Facebook dan cross-post ke Instagram
async function postToFacebookAndInstagram(pageId, igAccountId, photoUrl, caption, accessToken) {
    // Post ke halaman Facebook
    const fbPostUrl = `https://graph.facebook.com/${pageId}/photos`;
    const fbPostParams = {
        url: photoUrl,
        caption: caption,
        access_token: accessToken,
        published: true,
        // Parameter untuk cross-post ke Instagram
        instagram_accounts: igAccountId,
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

            // Post ke Facebook dan Instagram
            await postToFacebookAndInstagram(pageId, accountId, photoUrl, caption, accessToken);

            res.status(200).json({ message: "Foto berhasil diposting ke Facebook dan Instagram!" });
        });
    } catch (error) {
        console.error("Upload error:", error.message);
        res.status(500).json({ message: "Gagal memposting foto: " + error.message });
    }
};
