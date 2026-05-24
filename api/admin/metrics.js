const { readAnalyticsSummary } = require("../analytics/_analyticsStore");
const { isAllowedAdminKey } = require("./_adminAuth");
const { enforceRateLimit, getClientIp } = require("../_rateLimit");
const { applyApiSecurityHeaders, enforceSameOrigin } = require("../_requestGuards");
const { logSecurityEvent, maskValue } = require("../_securityLog");

function getHeader(req, name) {
  const value = req.headers?.[name] || req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value || "";
}

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

    const adminKey = getHeader(req, "x-matpick-admin-key");
    if (!isAllowedAdminKey(adminKey)) {
      logSecurityEvent("warn", "admin-metrics-rejected", {
        route: "/api/admin/metrics",
        ip: maskValue(getClientIp(req)),
        adminKey: maskValue(adminKey),
      });
      return res.status(403).json({ error: "Admin access is required." });
    }

    const day = String(req.query?.day || "").trim();
    const scope = req.query?.scope === "all" ? "all" : "today";
    const summary = await readAnalyticsSummary({ day: day || undefined, scope });
    return res.status(200).json({ summary });
  } catch (error) {
    logSecurityEvent("error", "admin-metrics-failed", {
      route: "/api/admin/metrics",
      ip: maskValue(getClientIp(req)),
      message: error instanceof Error ? error.message : "unknown",
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to read admin metrics",
    });
  }
};
