const {
  validateProfileSyncToken,
  writeRemoteProfile,
} = require("./_profileStore");
const { enforceRateLimit, getClientIp } = require("../_rateLimit");
const { applyApiSecurityHeaders, enforceSameOrigin } = require("../_requestGuards");
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

  try {
    const { userId, syncToken, profile } = readBody(req);

    if (
      !(await enforceRateLimit(req, res, {
        bucket: "auth:profile:ip",
        subject: getClientIp(req),
        limit: 30,
        windowSec: 600,
        message: "Too many profile update attempts. Please try again later.",
      }))
    ) {
      return;
    }

    if (!userId || !profile?.nickname || !profile?.consentAcceptedAt) {
      return res.status(400).json({ error: "Invalid profile payload" });
    }

    if (
      !(await enforceRateLimit(req, res, {
        bucket: "auth:profile:user",
        subject: String(userId),
        limit: 20,
        windowSec: 600,
        message: "Too many profile update attempts for this account. Please try again later.",
      }))
    ) {
      return;
    }

    const tokenValidation = validateProfileSyncToken(userId, syncToken);

    if (!tokenValidation.valid) {
      logSecurityEvent("warn", "profile-sync-token-rejected", {
        route: "/api/auth/profile",
        userId: maskValue(userId),
        ip: maskValue(getClientIp(req)),
        version: tokenValidation.version,
        reason: tokenValidation.reason,
      });
      return res.status(401).json({
        error: "Your session expired. Please sign in again before saving profile updates.",
      });
    }

    if (tokenValidation.version === "legacy") {
      logSecurityEvent("warn", "legacy-sync-token-used", {
        route: "/api/auth/profile",
        userId: maskValue(userId),
        ip: maskValue(getClientIp(req)),
      });
      res.setHeader("X-Matpick-Legacy-Token", "1");
    }

    await writeRemoteProfile(userId, profile);

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to save profile",
    });
  }
};
