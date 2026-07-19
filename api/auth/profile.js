const {
  validateProfileSyncToken,
  writeRemoteProfile,
} = require("./_profileStore");
const { recordMemberProfileCompletion } = require("./_memberStore");
const { enforceRateLimit, getClientIp } = require("../_rateLimit");
const {
  applyApiSecurityHeaders,
  enforceSameOrigin,
  isSafeIdentifier,
  readJsonBody,
} = require("../_requestGuards");
const { logSecurityEvent, maskValue } = require("../_securityLog");

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
    const { userId, syncToken, profile } = readJsonBody(req, { maxBytes: 16_000 });
    const nickname =
      typeof profile?.nickname === "string" ? profile.nickname.trim() : "";
    const consentAcceptedAt = Number(profile?.consentAcceptedAt);
    const safeProfile = {
      nickname,
      consentAcceptedAt,
      allowLocationPersonalization: profile?.allowLocationPersonalization === true,
    };

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

    if (
      !isSafeIdentifier(userId) ||
      typeof syncToken !== "string" ||
      syncToken.length > 4_096 ||
      !nickname ||
      nickname.length > 40 ||
      /[\u0000-\u001f\u007f]/.test(nickname) ||
      !Number.isFinite(consentAcceptedAt) ||
      consentAcceptedAt < 1_577_836_800_000 ||
      consentAcceptedAt > Date.now() + 5 * 60 * 1000
    ) {
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

    await writeRemoteProfile(userId, safeProfile);

    try {
      await recordMemberProfileCompletion(userId, safeProfile);
    } catch (error) {
      logSecurityEvent("warn", "member-profile-completion-record-failed", {
        route: "/api/auth/profile",
        userId: maskValue(userId),
        message: error instanceof Error ? error.message : "unknown",
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    const status = Number(error?.statusCode) || 500;
    return res.status(status).json({
      error: status < 500 ? error.message : "Failed to save profile",
    });
  }
};
