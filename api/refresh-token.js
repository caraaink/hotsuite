const CONFIG_PATH = path.join(__dirname, "../config.json");
 
 // Fungsi untuk membaca config
 async function getConfig() {
     try {
         const rawData = await fs.readFile(CONFIG_PATH, "utf-8");
 @@ -13,28 +14,36 @@ async function getConfig() {
     }
 }
 
 async function refreshToken(accessToken) {
     const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`;
 // Fungsi untuk menukar token short-lived ke long-lived token (Facebook)
 async function exchangeToLongLivedToken(shortLivedToken) {
     const appId = process.env.FACEBOOK_APP_ID || "573551255726328"; // Ambil dari env atau fallback ke default
     const appSecret = process.env.CLIENT_SECRET; // Ambil dari env (sudah diatur di Vercel)
     if (!appSecret) throw new Error("CLIENT_SECRET tidak ditemukan di environment variables.");
 
     const url = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
     const response = await fetch(url);
     const data = await response.json(); // Hanya panggil ini sekali
     const data = await response.json();
 
     console.log("Refresh Token Response:", data); // Log data JSON
     if (!response.ok) {
         throw new Error(`Gagal merefresh token: ${data.error?.message || "Unknown error"}`);
         throw new Error(`Gagal tukar token: ${data.error?.message || "Unknown error"}`);
     }
     return data.access_token;
 }
 
 // Fungsi untuk merefresh token (Instagram)
 async function refreshToken(accessToken) {
     const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`;
     const response = await fetch(url);
     const text = await response.text(); // Log raw response
     console.log("Refresh Token Response:", text);
     const data = await response.json();
     if (!response.ok) throw new Error("Gagal merefresh token: " + (data.error?.message || "Invalid JSON: " + text));
 
     console.log("Refresh Token Response:", data); // Log response untuk debugging
     if (!response.ok) {
         throw new Error(`Gagal merefresh token: ${data.error?.message || "Unknown error"}`);
     }
     return data.access_token;
 }
 
 // Fungsi untuk memperbarui config di GitHub
 async function updateConfigInGitHub(newToken) {
     const config = await getConfig();
     const githubToken = process.env.GITHUB_TOKEN;
 @@ -71,6 +80,7 @@ async function updateConfigInGitHub(newToken) {
     await fs.writeFile(CONFIG_PATH, updatedConfig, "utf-8");
 }
 
 // Handler utama untuk endpoint /api/refresh-token
 module.exports = async (req, res) => {
     const loginCode = req.query.login;
     if (loginCode !== "emi") {
 @@ -79,17 +89,22 @@ module.exports = async (req, res) => {
 
     try {
         const config = await getConfig();
         console.log("Access Token:", config.ACCESS_TOKEN);
         let currentToken = config.ACCESS_TOKEN;
 
         // Tukar ke long-lived token jika perlu
         let longLivedToken = config.ACCESS_TOKEN;
         // Uncomment dan isi appId jika perlu tukar token
         // longLivedToken = await exchangeToLongLivedToken(config.ACCESS_TOKEN);
         // Jika token adalah token Facebook (dimulai dengan "EAA"), tukar ke long-lived token
         if (currentToken.startsWith("EAA")) {
             currentToken = await exchangeToLongLivedToken(currentToken);
         }
 
         const newToken = await refreshToken(longLivedToken);
         // Refresh token yang sudah long-lived
         const newToken = await refreshToken(currentToken);
 
         // Simpan token baru ke GitHub
         await updateConfigInGitHub(newToken);
         res.status(200).json({ message: "Token berhasil direfresh: " + newToken });
 
         res.status(200).json({ message: "Token berhasil direfresh." });
     } catch (error) {
         console.error("Refresh token error:", error.message);
         res.status(500).json({ message: "Gagal merefresh token: " + error.message });
     }
 };