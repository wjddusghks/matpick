const {
  createProfileSyncToken,
  readRemoteProfile,
} = require("./_profileStore");

function readBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }

  return req.body;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const clientId =
    process.env.KAKAO_REST_API_KEY || process.env.VITE_KAKAO_REST_API_KEY;
  const clientSecret = process.env.KAKAO_CLIENT_SECRET || "";

  if (!clientId) {
    return res.status(500).json({
      error: "Kakao REST API credentials are not configured.",
    });
  }

  try {
    const { code, redirectUri } = readBody(req);

    if (!code || !redirectUri) {
      return res.status(400).json({
        error: "Missing Kakao authorization payload.",
      });
    }

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code,
    });

    if (clientSecret) {
      tokenParams.set("client_secret", clientSecret);
    }

    const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
      body: tokenParams,
    });

    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      return res.status(502).json({
        error:
          tokenPayload.error_description ||
          "Failed to exchange the Kakao authorization code.",
      });
    }

    const userResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
    });

    const userPayload = await userResponse.json();
    if (!userResponse.ok || !userPayload.id) {
      return res.status(502).json({
        error: userPayload.msg || "Failed to load the Kakao user profile.",
      });
    }

    const account = userPayload.kakao_account || {};
    const profile = account.profile || {};
    const userId = `kakao_${String(userPayload.id)}`;
    const storedProfile = await readRemoteProfile(userId);

    return res.status(200).json({
      user: {
        id: userId,
        name: profile.nickname || account.name || "Kakao User",
        email: account.email || "",
        profileImage:
          profile.profile_image_url || profile.thumbnail_image_url || "",
        provider: "kakao",
        nickname: storedProfile?.nickname || "",
        consentAcceptedAt: storedProfile?.consentAcceptedAt,
        allowLocationPersonalization: storedProfile?.allowLocationPersonalization,
        syncToken: createProfileSyncToken(userId),
      },
    });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "An unknown error occurred while processing the Kakao login.",
    });
  }
};
