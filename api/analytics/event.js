const { recordAnalyticsEvent } = require("./_analyticsStore");
const { enforceRateLimit, getClientIp } = require("../_rateLimit");
const {
  applyApiSecurityHeaders,
  enforceSameOrigin,
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
    if (
      !(await enforceRateLimit(req, res, {
        bucket: "analytics:event:ip",
        subject: getClientIp(req),
        limit: 240,
        windowSec: 60,
        message: "Too many analytics events. Please slow down and try again.",
      }))
    ) {
      return;
    }

    const payload = readJsonBody(req, { maxBytes: 12_000 });
    const result = await recordAnalyticsEvent(payload);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    logSecurityEvent("error", "analytics-event-failed", {
      route: "/api/analytics/event",
      ip: maskValue(getClientIp(req)),
      message: error instanceof Error ? error.message : "unknown",
    });
    const status = Number(error?.statusCode) || 500;
    return res.status(status).json({
      error: status < 500 ? error.message : "Failed to record analytics event",
    });
  }
};
