import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config(); // ✅ Load environment variables

const app = express();
app.use(express.json()); // ✅ Enable JSON parsing

const IG_USER_ID = process.env.IG_USER_ID; // ✅ Instagram User ID
const ACCESS_TOKEN = process.env.ACCESS_TOKEN; // ✅ Instagram Access Token
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// 🔄 Auto-refresh token setiap bulan
async function refreshToken() {
  try {
    const url = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&fb_exchange_token=${ACCESS_TOKEN}`;

    const response = await fetch(url, { method: "GET" });
    const data = await response.json();

    if (data.access_token) {
      console.log("✅ Token diperbarui:", data.access_token);
    } else {
      console.error("❌ Gagal memperbarui token:", data);
    }
  } catch (error) {
    console.error("❌ Error refreshing token:", error);
  }
}

// 🔄 Refresh token setiap 30 hari
setInterval(refreshToken, 30 * 24 * 60 * 60 * 1000);

// 📤 API untuk posting ke Instagram
app.post("/post", async (req, res) => {
  try {
    console.log("📥 Request Diterima:", req.body);

    const { imageUrl, caption } = req.body;
    if (!imageUrl || !caption) {
      return res.status(400).json({ error: "imageUrl dan caption diperlukan" });
    }

    // 1️⃣ Upload gambar ke Instagram
    const mediaUrl = `https://graph.facebook.com/v17.0/${IG_USER_ID}/media`;
    console.log("🔗 Posting ke:", mediaUrl);

    const mediaResponse = await fetch(mediaUrl, {
      method: "POST",
      body: JSON.stringify({
        image_url: imageUrl,
        caption: caption,
        access_token: ACCESS_TOKEN,
      }),
      headers: { "Content-Type": "application/json" },
    });

    const mediaData = await mediaResponse.json();
    console.log("📷 Upload Response:", mediaData);

    if (!mediaData.id) {
      return res.status(500).json({ error: "Gagal mengunggah media", details: mediaData });
    }

    // 2️⃣ Publish postingan ke Instagram
    const publishUrl = `https://graph.facebook.com/v17.0/${IG_USER_ID}/media_publish`;
    const publishResponse = await fetch(publishUrl, {
      method: "POST",
      body: JSON.stringify({
        creation_id: mediaData.id,
        access_token: ACCESS_TOKEN,
      }),
      headers: { "Content-Type": "application/json" },
    });

    const publishData = await publishResponse.json();
    console.log("🚀 Publish Response:", publishData);

    if (!publishData.id) {
      return res.status(500).json({ error: "Gagal memposting ke Instagram", details: publishData });
    }

    res.json({ success: true, post_id: publishData.id });

  } catch (error) {
    console.error("❌ Error Terjadi:", error);
    res.status(500).json({ error: "Terjadi kesalahan di server", details: error.message });
  }
});

// Jalankan server
app.listen(3000, () => {
  console.log("🚀 Server berjalan di port 3000");
});

export default app;
