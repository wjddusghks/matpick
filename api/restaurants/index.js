const { readEdits } = require("./_restaurantEdits");
const adminHandler = require("../admin/_restaurantAdmin");
const {
  applyApiSecurityHeaders,
  enforceSameOrigin,
  enforceBrowserRequest,
} = require("../_requestGuards");
const { enforceRateLimits, getClientIp } = require("../_rateLimit");
const { queryCatalog } = require("./_catalog");
const { listPublishedSuggestions } = require("./_suggestionStore");

async function enforceCatalogLimits(req, res) {
  const ip = getClientIp(req);
  return enforceRateLimits(req, res, [
    {
      bucket: "catalog:minute:ip",
      subject: ip,
      limit: 30,
      windowSec: 60,
      message: "Too many catalog requests. Please slow down.",
    },
    {
      bucket: "catalog:day:ip",
      subject: ip,
      limit: 400,
      windowSec: 86400,
      message: "The daily catalog request limit has been reached.",
    },
  ]);
}

const CATALOG_STATE_TTL_MS = 10_000;
let catalogStateCache = null;

function clearCatalogStateCache() {
  catalogStateCache = null;
}

async function readCatalogState() {
  const now = Date.now();
  if (catalogStateCache && catalogStateCache.expiresAt > now) {
    return catalogStateCache.promise;
  }
  const promise = Promise.all([readEdits(), listPublishedSuggestions()])
    .then(([{ edits }, publications]) => ({ edits, publications }));
  const entry = { expiresAt: now + CATALOG_STATE_TTL_MS, promise };
  catalogStateCache = entry;
  try {
    return await promise;
  } catch (error) {
    if (catalogStateCache === entry) clearCatalogStateCache();
    throw error;
  }
}

async function runWithCatalogCacheInvalidation(action) {
  clearCatalogStateCache();
  try {
    return await action();
  } finally {
    // A catalog read may have started while the mutation was in flight. Drop
    // that snapshot as well so the next request observes the completed write.
    clearCatalogStateCache();
  }
}

module.exports = async function handler(req, res) {
  if (req.query?.scope === "private-guides") {
    applyApiSecurityHeaders(res);
    return res.status(410).json({ error: "삭제된 기능입니다." });
  }
  if (req.query?.scope === "suggestions") {
    if (req.method !== "GET") {
      return runWithCatalogCacheInvalidation(() => require("./_suggestions")(req, res));
    }
    return require("./_suggestions")(req, res);
  }
  if (req.query?.scope === "topic-research")
    return require("../admin/_topicResearch")(req, res);
  if (req.method === "POST" || req.query?.scope === "admin") {
    if (req.method !== "GET") {
      return runWithCatalogCacheInvalidation(() => adminHandler(req, res));
    }
    return adminHandler(req, res);
  }
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
    const { edits, publications } = await readCatalogState();
    const result = queryCatalog(req.query || {}, edits, publications);
    return res.status(result.status).json(result.body);
  } catch {
    return res
      .status(503)
      .json({ error: "Catalog temporarily unavailable" });
  }
};

module.exports.clearCatalogStateCache = clearCatalogStateCache;
module.exports.readCatalogState = readCatalogState;
