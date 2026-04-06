const { validateProfileSyncToken } = require("../auth/_profileStore");
const { appendRemoteReview, readRemoteReviews, readReviewFeed } = require("./_reviewStore");
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

  if (req.method === "GET") {
    try {
      if (
        !(await enforceRateLimit(req, res, {
          bucket: "reviews:get:ip",
          subject: getClientIp(req),
          limit: 120,
          windowSec: 60,
          message: "Too many review requests. Please slow down and try again.",
        }))
      ) {
        return;
      }

      const scope = String(req.query?.scope || "").trim();
      if (scope === "feed") {
        const limit = Math.min(Math.max(Number(req.query?.limit) || 60, 1), 120);
        const reviews = await readReviewFeed(limit);
        return res.status(200).json({ reviews });
      }

      const restaurantId = String(req.query?.restaurantId || "").trim();
      if (!restaurantId) {
        return res.status(400).json({ error: "restaurantId is required" });
      }

      const reviews = await readRemoteReviews(restaurantId);
      return res.status(200).json({ reviews });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to read reviews",
      });
    }
  }

  if (req.method === "POST") {
    try {
      if (!enforceSameOrigin(req, res)) {
        return;
      }

      const { restaurantId, userId, syncToken, review } = readBody(req);

      if (
        !(await enforceRateLimit(req, res, {
          bucket: "reviews:post:ip",
          subject: getClientIp(req),
          limit: 20,
          windowSec: 600,
          message: "Too many review submissions. Please try again later.",
        }))
      ) {
        return;
      }

      if (!restaurantId || !userId || !review) {
        return res.status(400).json({ error: "Invalid review payload" });
      }

      if (
        !(await enforceRateLimit(req, res, {
          bucket: "reviews:post:user",
          subject: String(userId),
          limit: 12,
          windowSec: 600,
          message: "Too many review submissions from this account. Please try again later.",
        }))
      ) {
        return;
      }

      const tokenValidation = validateProfileSyncToken(userId, syncToken);

      if (!tokenValidation.valid) {
        logSecurityEvent("warn", "review-sync-token-rejected", {
          route: "/api/reviews",
          userId: maskValue(userId),
          restaurantId: maskValue(restaurantId),
          ip: maskValue(getClientIp(req)),
          version: tokenValidation.version,
          reason: tokenValidation.reason,
        });
        return res.status(401).json({
          error: "Your session expired. Please sign in again before posting a review.",
        });
      }

      if (tokenValidation.version === "legacy") {
        logSecurityEvent("warn", "legacy-sync-token-used", {
          route: "/api/reviews",
          userId: maskValue(userId),
          restaurantId: maskValue(restaurantId),
          ip: maskValue(getClientIp(req)),
        });
        res.setHeader("X-Matpick-Legacy-Token", "1");
      }

      const savedReview = await appendRemoteReview(String(restaurantId), review);
      return res.status(200).json({ ok: true, review: savedReview });
    } catch (error) {
      logSecurityEvent("error", "review-save-failed", {
        route: "/api/reviews",
        ip: maskValue(getClientIp(req)),
        message: error instanceof Error ? error.message : "unknown",
      });
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to save review",
      });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
};
