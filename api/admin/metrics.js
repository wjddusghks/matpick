const {
  readAnalyticsSummary,
  readVisitorHistory,
} = require("../analytics/_analyticsStore");
const { authorizeAdminRequest } = require("./_adminAuth");
const { enforceRateLimit, getClientIp } = require("../_rateLimit");
const {
  applyApiSecurityHeaders,
  enforceSameOrigin,
} = require("../_requestGuards");
const { logSecurityEvent, maskValue } = require("../_securityLog");

module.exports = async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!enforceSameOrigin(req, res)) {
    return;
  }

  try {
    if (
      !(await enforceRateLimit(req, res, {
        bucket: "admin:metrics:ip",
        subject: getClientIp(req),
        limit: 60,
        windowSec: 60,
        message: "Too many admin metric requests. Please try again later.",
      }))
    ) {
      return;
    }

    const authorization = await authorizeAdminRequest(req);
    if (!authorization.valid) {
      logSecurityEvent("warn", "admin-metrics-rejected", {
        route: "/api/admin/metrics",
        ip: maskValue(getClientIp(req)),
        reason: authorization.reason,
      });
      return res.status(authorization.unavailable ? 503 : 403).json({ error: "Admin access is required." });
    }

    if (req.query?.view === "visitors") {
      const daysValue = String(req.query?.days ?? "").trim();
      if (daysValue !== "7" && daysValue !== "28") {
        return res.status(400).json({ error: "days must be exactly 7 or 28" });
      }

      const history = await readVisitorHistory({ days: Number(daysValue) });
      return res.status(200).json({ history });
    }

    const day = String(req.query?.day || "").trim();
    const scope = req.query?.scope === "all" ? "all" : "today";
    const summary = await readAnalyticsSummary({
      day: day || undefined,
      scope,
    });
    return res.status(200).json({ summary });
  } catch (error) {
    logSecurityEvent("error", "admin-metrics-failed", {
      route: "/api/admin/metrics",
      ip: maskValue(getClientIp(req)),
      message: error instanceof Error ? error.message : "unknown",
    });
    return res.status(500).json({
      error: "Failed to read admin metrics",
    });
  }
};
