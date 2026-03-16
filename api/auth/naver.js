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
    process.env.NAVER_LOGIN_CLIENT_ID || process.env.VITE_NAVER_LOGIN_CLIENT_ID;
  const clientSecret = process.env.NAVER_LOGIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: "Naver login client credentials are not configured.",
    });
  }

  try {
    const { code, state } = readBody(req);

    if (!code || !state) {
      return res.status(400).json({
        error: "Missing Naver authorization payload.",
      });
    }

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      state,
    });

    const tokenResponse = await fetch(
      `https://nid.naver.com/oauth2.0/token?${tokenParams.toString()}`,
      {
        method: "GET",
      }
    );

    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      return res.status(502).json({
        error:
          tokenPayload.error_description ||
          "Failed to exchange the Naver authorization code.",
      });
    }

    const userResponse = await fetch("https://openapi.naver.com/v1/nid/me", {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
      },
    });

    const userPayload = await userResponse.json();
    if (!userResponse.ok || userPayload.resultcode !== "00") {
      return res.status(502).json({
        error: userPayload.message || "Failed to load the Naver user profile.",
      });
    }

    const profile = userPayload.response || {};
    const userId = `naver_${String(profile.id || "")}`;
    const storedProfile = await readRemoteProfile(userId);

    return res.status(200).json({
      user: {
        id: userId,
        name: profile.name || profile.nickname || "Naver User",
        email: profile.email || "",
        profileImage: profile.profile_image || "",
        provider: "naver",
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
          : "An unknown error occurred while processing the Naver login.",
    });
  }
};
