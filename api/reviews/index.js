const {
  readRemoteProfile,
} = require("../auth/_profileStore");
const { readSession, SessionStoreUnavailableError } = require("../auth/_sessionStore");
const { createMemberReview } = require("./_reviewSubmission");
const {
  appendRemoteReview,
  readRemoteReviews,
  readReviewFeed,
} = require("./_reviewStore");
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
        const limit = Math.min(
          Math.max(Number(req.query?.limit) || 60, 1),
          120,
        );
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
        error:
          error instanceof Error ? error.message : "Failed to read reviews",
      });
    }
  }

  if (req.method === "POST") {
    try {
      if (!enforceSameOrigin(req, res)) {
        return;
      }

      const { restaurantId, review } = readBody(req);
      const session = await readSession(req);
      if (!session) {
        return res.status(401).json({
          error: "Your session expired. Please sign in again before posting a review.",
        });
      }
      const userId = session.user.id;

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

      if (!restaurantId || !review) {
        return res.status(400).json({ error: "Invalid review payload" });
      }

      if (
        !(await enforceRateLimit(req, res, {
          bucket: "reviews:post:user",
          subject: String(userId),
          limit: 12,
          windowSec: 600,
          message:
            "Too many review submissions from this account. Please try again later.",
        }))
      ) {
        return;
      }

      const profile = await readRemoteProfile(String(userId));
      const memberReview = createMemberReview({
        restaurantId: String(restaurantId),
        userId,
        profile,
        review,
        ageProfile: session.user.ageProfile,
      });
      const savedReview = await appendRemoteReview(
        String(restaurantId),
        memberReview,
      );
      return res.status(200).json({ ok: true, review: savedReview });
    } catch (error) {
      logSecurityEvent("error", "review-save-failed", {
        route: "/api/reviews",
        ip: maskValue(getClientIp(req)),
        message: error instanceof Error ? error.message : "unknown",
      });
      return res.status(error instanceof SessionStoreUnavailableError ? 503 : error?.status || 500).json({
        error: error instanceof Error ? error.message : "Failed to save review",
      });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
};
