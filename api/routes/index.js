const {
  applyApiSecurityHeaders,
  enforceSameOrigin,
} = require("../_requestGuards");
const { enforceRateLimit } = require("../_rateLimit");
const {
  getRouteConfig,
  getTravelTimes,
  isKoreanPoint,
} = require("./_providers");
const dataset = require("../../matpick_all/client/src/data/generated/public-dataset.json");
const restaurants = new Map(
  dataset.restaurants.map((restaurant) => [restaurant.id, restaurant]),
);

module.exports = async function handler(req, res) {
  applyApiSecurityHeaders(res);
  if (!enforceSameOrigin(req, res)) return;
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const config = getRouteConfig();
  if (req.method === "GET")
    return res.status(200).json({
      driving: Boolean(config.id && config.secret),
      transit: false,
    });
  let body;
  try {
    if (
      Number(req.headers?.["content-length"] || 0) > 4096 ||
      (typeof req.body === "string" && req.body.length > 4096)
    )
      return res.status(413).json({ error: "Request too large" });
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Invalid request" });
  }
  if (
    !isKoreanPoint(body?.origin) ||
    !Array.isArray(body?.restaurantIds) ||
    !body.restaurantIds.length ||
    body.restaurantIds.length > 6 ||
    body.restaurantIds.some(
      (id) => typeof id !== "string" || !restaurants.has(id),
    )
  )
    return res
      .status(400)
      .json({ error: "A valid origin and 1–6 restaurant IDs are required" });
  const destinations = [...new Set(body.restaurantIds)].map((id) =>
    restaurants.get(id),
  );
  if (
    destinations.some(
      (restaurant) =>
        restaurant.recommendationHold ||
        restaurant.isOverseas ||
        !isKoreanPoint(restaurant) ||
        ["closed", "moved", "temporarily_closed"].includes(
          restaurant.operationState,
        ) ||
        /폐업|이전|휴업|permanently\s*closed|temporarily\s*closed|relocated/i.test(
          restaurant.operationStatus || "",
        ),
    )
  )
    return res.status(400).json({ error: "Destination unavailable" });
  try {
    if (
      !(await enforceRateLimit(req, res, {
        bucket: "routes:ip",
        limit: 12,
        windowSec: 60,
      }))
    )
      return;
    // Use a shared store in production; also retain the provider console's hard quota.
    if (
      !(await enforceRateLimit(req, res, {
        bucket: "routes:daily",
        subject: "all",
        limit: Math.max(
          1,
          Number(process.env.ROUTE_DAILY_REQUEST_LIMIT) || 300,
        ),
        windowSec: 86400,
      }))
    )
      return;
    const routes = await Promise.all(
      destinations.map(async (restaurant) => ({
        restaurantId: restaurant.id,
        ...(await getTravelTimes(body.origin, restaurant, config)),
      })),
    );
    // Origins, credentials and raw provider responses are never returned or logged.
    return res.status(200).json({ routes, checkedAt: Date.now() });
  } catch {
    return res
      .status(503)
      .json({ error: "Route service temporarily unavailable" });
  }
};
