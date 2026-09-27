const { readEdits } = require("./_restaurantEdits");
const adminHandler = require("../admin/_restaurantAdmin");
const {
  applyApiSecurityHeaders,
  enforceSameOrigin,
  enforceBrowserRequest,
} = require("../_requestGuards");
const { enforceRateLimit, getClientIp } = require("../_rateLimit");
const { queryCatalog } = require("./_catalog");

async function enforceCatalogLimits(req, res) {
  const ip = getClientIp(req);
  if (!(await enforceRateLimit(req, res, {
    bucket: "catalog:minute:ip",
    subject: ip,
    limit: 30,
    windowSec: 60,
    message: "Too many catalog requests. Please slow down.",
  }))) return false;
  return enforceRateLimit(req, res, {
    bucket: "catalog:day:ip",
    subject: ip,
    limit: 400,
    windowSec: 86400,
    message: "The daily catalog request limit has been reached.",
  });
}

module.exports = async function handler(req, res) {
  if (req.query?.scope === "private-guides") {
    applyApiSecurityHeaders(res);
    return res.status(410).json({ error: "삭제된 기능입니다." });
  }
  if (req.query?.scope === "suggestions")
    return require("./_suggestions")(req, res);
  if (req.query?.scope === "topic-research")
    return require("../admin/_topicResearch")(req, res);
  if (req.method === "POST" || req.query?.scope === "admin")
    return adminHandler(req, res);
  applyApiSecurityHeaders(res);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    if (req.query?.scope !== "catalog") {
      if (!enforceSameOrigin(req, res)) return;
      return res.status(404).json({ error: "Not found" });
    }
    res.setHeader("Vary", "Origin, Referer, Sec-Fetch-Site");
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    if (!enforceBrowserRequest(req, res)) return;
    if (!(await enforceCatalogLimits(req, res))) return;
    const { edits } = await readEdits();
    const result = queryCatalog(req.query || {}, edits);
    return res.status(result.status).json(result.body);
  } catch {
    return res
      .status(503)
      .json({ error: "Catalog temporarily unavailable" });
  }
};
