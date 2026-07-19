const {
  createProfileSyncToken,
  readRemoteProfile,
} = require("./_profileStore");
const { recordAuthMember } = require("./_memberStore");
const { enforceRateLimit, getClientIp } = require("../_rateLimit");
const {
  applyApiSecurityHeaders,
  enforceSameOrigin,
  isAllowedRedirectUri,
  readJsonBody,
} = require("../_requestGuards");
const { logSecurityEvent, maskValue } = require("../_securityLog");
const { fetchWithTimeout, readJsonResponse } = require("../_safeFetch");

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
      bucket: "auth:naver:ip",
      subject: getClientIp(req),
      limit: 20,
      windowSec: 600,
      message: "Too many Naver login attempts. Please try again in a few minutes.",
    }))
  ) {
    return;
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
    const { code, state, redirectUri } = readJsonBody(req, { maxBytes: 16_000 });

    if (
      typeof code !== "string" ||
      code.length < 1 ||
      code.length > 2_048 ||
      typeof state !== "string" ||
      state.length < 16 ||
      state.length > 256 ||
      !isAllowedRedirectUri(req, redirectUri, "/auth/callback/naver")
    ) {
      return res.status(400).json({
        error: "Invalid Naver authorization payload.",
      });
    }

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      state,
    });

    const tokenResponse = await fetchWithTimeout(
      `https://nid.naver.com/oauth2.0/token?${tokenParams.toString()}`,
      {
        method: "GET",
      }
    );

    const tokenPayload = await readJsonResponse(tokenResponse, 256_000);
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      return res.status(502).json({
        error:
          tokenPayload.error_description ||
          "Failed to exchange the Naver authorization code.",
      });
    }

    const userResponse = await fetchWithTimeout("https://openapi.naver.com/v1/nid/me", {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
      },
    });

    const userPayload = await readJsonResponse(userResponse, 256_000);
    if (!userResponse.ok || userPayload.resultcode !== "00") {
      return res.status(502).json({
        error: userPayload.message || "Failed to load the Naver user profile.",
      });
    }

    const profile = userPayload.response || {};
    const userId = `naver_${String(profile.id || "")}`;
    const storedProfile = await readRemoteProfile(userId);
    const user = {
      id: userId,
      name: profile.name || profile.nickname || "Naver User",
      email: profile.email || "",
      profileImage: profile.profile_image || "",
      provider: "naver",
      nickname: storedProfile?.nickname || "",
      consentAcceptedAt: storedProfile?.consentAcceptedAt,
      allowLocationPersonalization: storedProfile?.allowLocationPersonalization,
      syncToken: createProfileSyncToken(userId),
    };

    try {
      await recordAuthMember(user);
    } catch (error) {
      logSecurityEvent("warn", "member-record-failed", {
        route: "/api/auth/naver",
        userId: maskValue(userId),
        message: error instanceof Error ? error.message : "unknown",
      });
    }

    return res.status(200).json({
      user,
    });
  } catch (error) {
    logSecurityEvent("error", "naver-auth-failed", {
      route: "/api/auth/naver",
      ip: maskValue(getClientIp(req)),
      message: error instanceof Error ? error.message : "unknown",
    });
    const status = Number(error?.statusCode) || 502;
    return res.status(status).json({
      error:
        status < 500
          ? error.message
          : "Naver login could not be completed. Please try again.",
    });
  }
};
