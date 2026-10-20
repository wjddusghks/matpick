const { readRemoteProfile, writeRemoteProfile } = require("./_profileStore");
const {
  readSession,
  revokeSession,
  SessionStoreUnavailableError,
} = require("./_sessionStore");
const { recordMemberProfileCompletion } = require("./_memberStore");
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

  if (!["GET", "POST", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!enforceSameOrigin(req, res)) {
    return;
  }

  try {
    if (req.method === "DELETE") {
      await revokeSession(req, res);
      return res.status(200).json({ ok: true });
    }

    const session = await readSession(req);
    if (!session) {
      return res.status(401).json({ error: "Authentication is required." });
    }

    const userId = session.user.id;
    if (req.method === "GET") {
      const storedProfile = await readRemoteProfile(userId);
      return res.status(200).json({
        user: {
          ...session.user,
          ...(storedProfile || {}),
        },
      });
    }

    const { profile } = readBody(req);

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

    await writeRemoteProfile(userId, profile);

    try {
      await recordMemberProfileCompletion(userId, profile);
    } catch (error) {
      logSecurityEvent("warn", "member-profile-completion-record-failed", {
        route: "/api/auth/profile",
        userId: maskValue(userId),
        message: error instanceof Error ? error.message : "unknown",
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(error instanceof SessionStoreUnavailableError ? 503 : 500).json({
      error: "Failed to save profile",
    });
  }
};
