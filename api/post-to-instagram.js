const INSTAGRAM_USER_ID = process.env.INSTAGRAM_USER_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

async function postToInstagram(req, res) {
    const { imageUrl, caption } = await req.json();

    const response = await fetch(`https://graph.facebook.com/v19.0/${INSTAGRAM_USER_ID}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl, caption, access_token: ACCESS_TOKEN })
    });

    const data = await response.json();
    return res.json({ success: !!data.id, response: data });
}

export default postToInstagram;
