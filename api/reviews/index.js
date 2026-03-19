const { isValidProfileSyncToken } = require("../auth/_profileStore");
const { appendRemoteReview, readRemoteReviews, readReviewFeed } = require("./_reviewStore");

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
  if (req.method === "GET") {
    try {
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
      const { restaurantId, userId, syncToken, review } = readBody(req);

      if (!restaurantId || !userId || !review) {
        return res.status(400).json({ error: "Invalid review payload" });
      }

      if (!isValidProfileSyncToken(userId, syncToken)) {
        return res.status(401).json({ error: "Invalid sync token" });
      }

      const savedReview = await appendRemoteReview(String(restaurantId), review);
      return res.status(200).json({ ok: true, review: savedReview });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to save review",
      });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
};
