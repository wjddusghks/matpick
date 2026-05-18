const { readMembersDashboard } = require("../auth/_memberStore");
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
        bucket: "admin:members:ip",
        subject: getClientIp(req),
        limit: 60,
        windowSec: 60,
        message: "Too many admin member requests. Please try again later.",
      }))
    ) {
      return;
    }

    const adminKey = getHeader(req, "x-matpick-admin-key");
    if (!isAllowedAdminKey(adminKey)) {
      logSecurityEvent("warn", "admin-members-rejected", {
        route: "/api/admin/members",
        ip: maskValue(getClientIp(req)),
        adminKey: maskValue(adminKey),
      });
      return res.status(403).json({ error: "Admin access is required." });
    }

    const dashboard = await readMembersDashboard();
    return res.status(200).json({ dashboard });
  } catch (error) {
    logSecurityEvent("error", "admin-members-failed", {
      route: "/api/admin/members",
      ip: maskValue(getClientIp(req)),
      message: error instanceof Error ? error.message : "unknown",
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to read member dashboard",
    });
  }
};
