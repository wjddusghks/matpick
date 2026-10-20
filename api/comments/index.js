const crypto = require("node:crypto");
const {
  readRemoteProfile,
} = require("../auth/_profileStore");
const { readSession, SessionStoreUnavailableError } = require("../auth/_sessionStore");
const { appendRemoteComment, readRemoteComments } = require("./_commentStore");
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

function isValidRestaurantId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_:-]{1,160}$/.test(value);
}

module.exports = async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method === "GET") {
    try {
      if (
        !(await enforceRateLimit(req, res, {
          bucket: "comments:get:ip",
          subject: getClientIp(req),
          limit: 120,
          windowSec: 60,
          message: "Too many comment requests. Please slow down and try again.",
        }))
      ) {
        return;
      }

      const restaurantId = String(req.query?.restaurantId || "").trim();
      if (!isValidRestaurantId(restaurantId)) {
        return res.status(400).json({ error: "A valid restaurantId is required" });
      }

      const comments = await readRemoteComments(restaurantId);
      res.setHeader("Cache-Control", "private, no-store");
      return res.status(200).json({ comments });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to read comments",
      });
    }
  }

  if (req.method === "POST") {
    try {
      if (!enforceSameOrigin(req, res)) {
        return;
      }

      const { restaurantId, comment } = readBody(req);
      const session = await readSession(req);
      if (!session) {
        return res.status(401).json({
          error: "Your session expired. Please sign in again before posting a comment.",
        });
      }
      const userId = session.user.id;

      if (
        !(await enforceRateLimit(req, res, {
          bucket: "comments:post:ip",
          subject: getClientIp(req),
          limit: 20,
          windowSec: 600,
          message: "Too many comment submissions. Please try again later.",
        }))
      ) {
        return;
      }

      if (
        !isValidRestaurantId(restaurantId) ||
        !comment ||
        typeof comment.text !== "string" ||
        !comment.text.trim()
      ) {
        return res.status(400).json({ error: "Invalid comment payload" });
      }

      if (
        !(await enforceRateLimit(req, res, {
          bucket: "comments:post:user",
          subject: String(userId),
          limit: 12,
          windowSec: 600,
          message: "Too many comments from this account. Please try again later.",
        }))
      ) {
        return;
      }

      const profile = await readRemoteProfile(String(userId));
      const serverComment = {
        ...comment,
        id: crypto.randomUUID(),
        user: profile?.nickname || session.user.nickname || session.user.name,
        date: new Date(Date.now() + 9 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, "."),
        createdAt: Date.now(),
      };
      const savedComment = await appendRemoteComment(
        String(restaurantId),
        serverComment
      );
      return res.status(200).json({ ok: true, comment: savedComment });
    } catch (error) {
      logSecurityEvent("error", "comment-save-failed", {
        route: "/api/comments",
        ip: maskValue(getClientIp(req)),
        message: error instanceof Error ? error.message : "unknown",
      });
      return res.status(error instanceof SessionStoreUnavailableError ? 503 : 500).json({
        error: "Failed to save comment",
      });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
};
