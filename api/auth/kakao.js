const { readRemoteProfile } = require("./_profileStore");
const { beginOAuth, OAuthConfigurationError } = require("./_oauthFlow");
const {
  consumeOAuthTransaction,
  createSession,
  SessionStoreUnavailableError,
} = require("./_sessionStore");
const { recordAuthMember } = require("./_memberStore");
const { deriveAgeProfile } = require("./_ageProfile");
const { enforceRateLimit, getClientIp } = require("../_rateLimit");
const {
  applyApiSecurityHeaders,
  enforceSameOrigin,
} = require("../_requestGuards");
const { logSecurityEvent, maskValue } = require("../_securityLog");

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
  applyApiSecurityHeaders(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!enforceSameOrigin(req, res)) {
    return;
  }

  if (
    !(await enforceRateLimit(req, res, {
      bucket: "auth:kakao:ip",
      subject: getClientIp(req),
      limit: 20,
      windowSec: 600,
      message:
        "Too many Kakao login attempts. Please try again in a few minutes.",
    }))
  ) {
    return;
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
    const { action, code, state } = readBody(req);

    if (action === "start") {
      const authorizeUrl = await beginOAuth(req, res, "kakao");
      if (!authorizeUrl) {
        return res.status(500).json({
          error: "Kakao REST API credentials are not configured.",
        });
      }
      return res.status(200).json({ authorizeUrl });
    }

    if (!code || !state) {
      return res.status(400).json({
        error: "Missing Kakao authorization payload.",
      });
    }

    const transaction = await consumeOAuthTransaction(req, res, {
      provider: "kakao",
      state,
    });
    if (!transaction) {
      return res.status(400).json({
        error: "The login request expired or failed its security check.",
      });
    }

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: transaction.redirectUri,
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
    const ageProfile = deriveAgeProfile("kakao", account);
    const profile = account.profile || {};
    const userId = `kakao_${String(userPayload.id)}`;
    const storedProfile = await readRemoteProfile(userId);
    const user = {
      id: userId,
      name: profile.nickname || account.name || "Kakao User",
      email: account.email || "",
      profileImage:
        profile.profile_image_url || profile.thumbnail_image_url || "",
      provider: "kakao",
      nickname: storedProfile?.nickname || "",
      consentAcceptedAt: storedProfile?.consentAcceptedAt,
      allowLocationPersonalization: storedProfile?.allowLocationPersonalization,
      ageProfile,
    };

    try {
      await recordAuthMember(user);
    } catch (error) {
      logSecurityEvent("warn", "member-record-failed", {
        route: "/api/auth/kakao",
        userId: maskValue(userId),
        message: error instanceof Error ? error.message : "unknown",
      });
    }

    await createSession(req, res, user);
    return res.status(200).json({ user });
  } catch (error) {
    logSecurityEvent("error", "kakao-auth-failed", {
      route: "/api/auth/kakao",
      ip: maskValue(getClientIp(req)),
      message: error instanceof Error ? error.message : "unknown",
    });
    return res
      .status(error instanceof SessionStoreUnavailableError ? 503 : 500)
      .json({
        error:
          error instanceof OAuthConfigurationError
            ? error.message
            : "An unknown error occurred while processing the Kakao login.",
      });
  }
};
