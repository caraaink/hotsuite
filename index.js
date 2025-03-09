import fetch from 'node-fetch';
import express from 'express';
import cron from 'node-cron';

const app = express();
app.use(express.json());

const ACCESS_TOKEN = "EAAIJpE7bqPgBO8ktaECeILtOyHg5VBCK34LAy5H1dHQrXF3Du8eUU3fYZCNuqDeZBsxErqmOvG81nRd8ZCBaxpT2r50bIZBUE5av24gJvqxuOUr0rZCx7RGR37z0YWgFlqGMgf3lOVe6tgD1oxnpB0pXsLsB2UINs5iC8VwS59wTojx72Qr5FjCZCE";
const IG_USER_ID = "17841402777728356";
const CLIENT_ID = "573551255726328";
const CLIENT_SECRET = "46cbbde0a360da161359e4cab05cf0ee";

// Fungsi untuk unggah media ke Instagram
const uploadToInstagram = async (imageUrl, caption) => {
    try {
        // 1. Upload Media Container
        const containerRes = await fetch(`https://graph.facebook.com/v19.0/${IG_USER_ID}/media`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_url: imageUrl,
                caption: caption,
                access_token: ACCESS_TOKEN
            })
        });
        const containerData = await containerRes.json();
        console.log("Container Response:", containerData);
        
        if (!containerData.id) throw new Error("Gagal membuat container media");

        // 2. Publish Media
        const publishRes = await fetch(`https://graph.facebook.com/v19.0/${IG_USER_ID}/media_publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creation_id: containerData.id,
                access_token: ACCESS_TOKEN
            })
        });
        const publishData = await publishRes.json();
        console.log("Publish Response:", publishData);

        return publishData;
    } catch (error) {
        console.error("Error uploading to Instagram:", error);
    }
};

// Endpoint untuk manual posting
app.post('/post', async (req, res) => {
    const { imageUrl, caption } = req.body;
    const response = await uploadToInstagram(imageUrl, caption);
    res.json(response);
});

// Fungsi untuk refresh token setiap bulan
const refreshAccessToken = async () => {
    try {
        const refreshRes = await fetch(`https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&fb_exchange_token=${ACCESS_TOKEN}`);
        const refreshData = await refreshRes.json();
        console.log("New Access Token:", refreshData.access_token);
    } catch (error) {
        console.error("Error refreshing access token:", error);
    }
};

// Jadwal refresh token setiap bulan
cron.schedule('0 0 1 * *', () => {
    console.log("Refreshing Access Token...");
    refreshAccessToken();
});

// Jalankan server di Vercel
app.listen(3000, () => {
    console.log("Server running on port 3000");
});

export default app;
