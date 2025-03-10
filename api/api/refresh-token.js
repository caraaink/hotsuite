const fs = require("fs").promises;
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "../config.json");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REPO_OWNER = "caraaink";
const REPO_NAME = "hotsuite";
const FILE_PATH = "config.json";

async function getConfig() {
    try {
        const configData = await fs.readFile(CONFIG_PATH, "utf8");
        return JSON.parse(configData);
    } catch (error) {
        console.error("Error reading config:", error);
        return { ACCESS_TOKEN: "" };
    }
}

async function updateConfigInGitHub(newToken) {
    const config = await getConfig();
    config.ACCESS_TOKEN = newToken;

    const getFileResponse = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
        {
            method: "GET",
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                "Accept": "application/vnd.github.v3+json"
            }
        }
    );
    const fileData = await getFileResponse.json();
    const sha = fileData.sha;

    const updateResponse = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
        {
            method: "PUT",
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                "Accept": "application/vnd.github.v3+json"
            },
            body: JSON.stringify({
                message: "Update ACCESS_TOKEN",
                content: Buffer.from(JSON.stringify(config, null, 2)).toString("base64"),
                sha: sha
            })
        }
    );

    if (updateResponse.ok) {
        console.log("Token updated in GitHub:", newToken);
        return true;
    } else {
        throw new Error("Gagal memperbarui config di GitHub: " + (await updateResponse.text()));
    }
}

async function refreshToken(currentToken) {
    const url = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=573551255726328&client_secret=${CLIENT_SECRET}&fb_exchange_token=${currentToken}`;
    const response = await fetch(url, { method: "GET" });
    const data = await response.json();

    if (data.access_token) {
        return data.access_token;
    } else {
        throw new Error("Gagal merefresh token: " + JSON.stringify(data));
    }
}

module.exports = async (req, res) => {
    try {
        const config = await getConfig();
        const newToken = await refreshToken(config.ACCESS_TOKEN);
        await updateConfigInGitHub(newToken);
        res.status(200).json({ message: "Token berhasil direfresh: " + newToken });
    } catch (error) {
        res.status(500).json({ message: "Gagal merefresh token: " + error.message });
    }
}
