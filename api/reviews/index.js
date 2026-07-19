const crypto = require("node:crypto");
const { validateProfileSyncToken } = require("../auth/_profileStore");
const { readRemoteProfile } = require("../auth/_profileStore");
const { appendRemoteReview, readRemoteReviews, readReviewFeed } = require("./_reviewStore");
const { enforceRateLimit, getClientIp } = require("../_rateLimit");
const {
  applyApiSecurityHeaders,
  enforceSameOrigin,
  isSafeIdentifier,
  readJsonBody,
} = require("../_requestGuards");
const { logSecurityEvent, maskValue } = require("../_securityLog");

function isAllowedReviewPhotoUrl(value, restaurantId) {
  try {
    const url = new URL(String(value || ""));
    const configuredHost = (() => {
      try {
        return new URL(process.env.VITE_PUBLIC_APP_URL || "").hostname;
      } catch {
        return "";
      }
    })();
    const extraHosts = String(process.env.REVIEW_IMAGE_ALLOWED_HOSTS || "")
      .split(/[\s,]+/)
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
    const hostname = url.hostname.toLowerCase();
    const allowedHost =
      hostname.endsWith(".public.blob.vercel-storage.com") ||
      (configuredHost && hostname === configuredHost.toLowerCase()) ||
      extraHosts.includes(hostname);
    const expectedPathPrefix = `/reviews/${restaurantId}/`;

    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      allowedHost &&
      url.pathname.startsWith(expectedPathPrefix) &&
      url.href.length <= 1_000
    );
  } catch {
    return false;
  }
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
      if (!isSafeIdentifier(restaurantId, 160)) {
        return res.status(400).json({ error: "A valid restaurantId is required" });
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

      const { restaurantId, userId, syncToken, review } = readJsonBody(req, {
        maxBytes: 32_000,
      });
      const stars = Number(review?.stars);
      const text = typeof review?.text === "string" ? review.text.trim() : "";
      const fallbackUser =
        typeof review?.user === "string" ? review.user.trim() : "";
      const photos = Array.isArray(review?.photos) ? review.photos : [];

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

      if (
        !isSafeIdentifier(restaurantId, 160) ||
        !isSafeIdentifier(userId, 160) ||
        typeof syncToken !== "string" ||
        syncToken.length > 4_096 ||
        !Number.isInteger(stars) ||
        stars < 1 ||
        stars > 5 ||
        text.length > 2_000 ||
        fallbackUser.length > 40 ||
        /[\u0000-\u001f\u007f]/.test(text + fallbackUser) ||
        photos.length > 6 ||
        !photos.every((photo) => isAllowedReviewPhotoUrl(photo, restaurantId))
      ) {
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

      const profile = await readRemoteProfile(String(userId));
      const serverReview = {
        id: crypto.randomUUID(),
        user: profile?.nickname || fallbackUser || "회원",
        date: new Date(Date.now() + 9 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, "."),
        stars,
        text,
        photos,
        createdAt: Date.now(),
      };
      const savedReview = await appendRemoteReview(String(restaurantId), serverReview);
      return res.status(200).json({ ok: true, review: savedReview });
    } catch (error) {
      logSecurityEvent("error", "review-save-failed", {
        route: "/api/reviews",
        ip: maskValue(getClientIp(req)),
        message: error instanceof Error ? error.message : "unknown",
      });
      const status = Number(error?.statusCode) || 500;
      return res.status(status).json({
        error: status < 500 ? error.message : "Failed to save review",
      });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
};
