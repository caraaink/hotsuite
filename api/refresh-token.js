const fs = require("fs").promises;
const path = require("path");
const fetch = require("node-fetch");

const CONFIG_PATH = path.join(__dirname, "../config.json");

// Fungsi untuk membaca config.json
async function getConfig() {
    try {
        const rawData = await fs.readFile(CONFIG_PATH, "utf-8");
        return JSON.parse(rawData);
    } catch (error) {
        console.error("Gagal membaca config.json:", error);
        return { ACCESS_TOKEN: "" };
    }
}

// Fungsi untuk menyimpan token baru ke config.json
async function saveConfig(newToken) {
    try {
        const config = await getConfig();
        config.ACCESS_TOKEN = newToken;
        await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
        console.log("Token berhasil diperbarui di config.json");
    } catch (error) {
        console.error("Gagal menyimpan token ke config.json:", error);
    }
}

// Fungsi untuk menukar token short-lived ke long-lived token (Facebook)
async function exchangeToLongLivedToken(shortLivedToken) {
    const appId = "573551255726328";
    const appSecret = "46cbbde0a360da161359e4cab05cf0ee";
    const url = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;

    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) throw new Error(`Gagal menukar token: ${data.error?.message}`);
    return data.access_token;
}

// Handler utama untuk endpoint refresh-token
module.exports = async (req, res) => {
    if (req.query.login !== "emi") {
        return res.status(403).json({ message: "Akses ditolak" });
    }
    
    try {
        const config = await getConfig();
        let currentToken = config.ACCESS_TOKEN;
        
        // Tukar token ke long-lived token (jika perlu)
        if (currentToken.startsWith("EAA")) {
            currentToken = await exchangeToLongLivedToken(currentToken);
        }

        // Simpan token yang baru diperbarui
        await saveConfig(currentToken);
        res.status(200).json({ message: "Token berhasil diperbarui." });
    } catch (error) {
        console.error("Error saat refresh token:", error.message);
        res.status(500).json({ message: "Gagal memperbarui token: " + error.message });
    }
};
