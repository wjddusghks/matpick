const {
  applyApiSecurityHeaders,
  enforceSameOrigin,
} = require("../_requestGuards");
const { enforceRateLimit, getClientIp } = require("../_rateLimit");
const { authorizeAdminRequest } = require("../admin/_adminAuth");
const store = require("./_feedbackStore");

function createFeedbackHandler(backend = store) {
  return async function handler(req, res) {
    applyApiSecurityHeaders(res);
    if (!["GET", "POST", "PATCH"].includes(req.method)) {
      res.setHeader("Allow", "GET, POST, PATCH");
      return res.status(405).json({ error: "Method not allowed" });
    }
    if (!enforceSameOrigin(req, res)) return;
    let admin = null;
    if (req.method !== "POST") {
      admin = await authorizeAdminRequest(req);
      if (!admin.valid)
        return res.status(admin.unavailable ? 503 : 403).json({ error: "Admin access is required." });
    }
    try {
      if (
        !(await enforceRateLimit(req, res, {
          bucket: `feedback:${req.method}`,
          subject: getClientIp(req),
          limit: req.method === "POST" ? 5 : 60,
          windowSec: req.method === "POST" ? 600 : 60,
          message: "Too many feedback requests. Please try again later.",
        }))
      )
        return;
      if (req.method === "GET") {
        const page = Number(req.query?.page || 0);
        if (!Number.isInteger(page) || page < 0 || page > 1000)
          return res.status(400).json({ error: "Invalid page." });
        return res.status(200).json(await backend.listFeedback(page));
      }
      const raw =
        typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body || {});
      if (Buffer.byteLength(raw) > 12000)
        return res.status(413).json({ error: "Feedback is too long." });
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return res.status(400).json({ error: "Invalid request body." });
      }
      if (req.method === "PATCH") {
        const item = await backend.updateFeedback(
          body.requestId,
          body.status,
          admin.userId,
        );
        return res.status(200).json({ ok: true, item });
      }
      const receipt = await backend.saveFeedback(
        backend.validateFeedback(body),
      );
      return res.status(200).json({ ok: true, receipt });
    } catch (error) {
      return res
        .status(error.status || 503)
        .json({
          error: error.status
            ? error.message
            : "Feedback service is temporarily unavailable.",
        });
    }
  };
}

module.exports = createFeedbackHandler();
module.exports.createFeedbackHandler = createFeedbackHandler;
