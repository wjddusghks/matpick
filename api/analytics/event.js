const { recordAnalyticsEvent } = require("./_analyticsStore");
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

function getPlatformCountryCode(req) {
  if (process.env.VERCEL !== "1") {
    return "";
  }

  const value = req.headers?.["x-vercel-ip-country"] || "";
  const countryCode = String(Array.isArray(value) ? value[0] : value)
    .trim()
    .toUpperCase();
  return /^[A-Z]{2}$/.test(countryCode) && countryCode !== "XX"
    ? countryCode
    : "";
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

    const payload = readBody(req);
    const result = await recordAnalyticsEvent(payload, {
      countryCode: getPlatformCountryCode(req),
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    logSecurityEvent("error", "analytics-event-failed", {
      route: "/api/analytics/event",
      ip: maskValue(getClientIp(req)),
      message: error instanceof Error ? error.message : "unknown",
    });
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to record analytics event",
    });
  }
};
