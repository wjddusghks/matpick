const {
  applyApiSecurityHeaders,
  enforceSameOrigin,
} = require("../_requestGuards");
const { enforceRateLimit } = require("../_rateLimit");
const {
  reserveRouteCall,
  readRouteCache,
  writeRouteCache,
} = require("./_budget");
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
    body.restaurantIds.length !== 1 ||
    body.restaurantIds.some(
      (id) => typeof id !== "string" || !restaurants.has(id),
    )
  )
    return res
      .status(400)
      .json({
        error: "A valid origin and exactly one restaurant ID are required",
      });
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
        limit: 6,
        windowSec: 60,
      }))
    )
      return;
    const restaurant = destinations[0];
    if (!config.id || !config.secret)
      return res
        .status(200)
        .json({
          routes: [
            {
              restaurantId: restaurant.id,
              driving: { status: "not_configured" },
            },
          ],
        });
    const cached = await readRouteCache(body.origin, restaurant);
    if (cached)
      return res
        .status(200)
        .json({
          routes: [{ restaurantId: restaurant.id, ...cached }],
          checkedAt: cached.checkedAt,
        });
    if (!(await reserveRouteCall()))
      return res
        .status(429)
        .json({ error: "Route lookup limit reached. Use the Naver Map link." });
    const route = {
      ...(await getTravelTimes(body.origin, restaurant, config)),
      checkedAt: Date.now(),
    };
    await writeRouteCache(body.origin, restaurant, route).catch(() => {});
    const routes = [{ restaurantId: restaurant.id, ...route }];
    // Origins, credentials and raw provider responses are never returned or logged.
    return res.status(200).json({ routes, checkedAt: Date.now() });
  } catch {
    return res
      .status(503)
      .json({ error: "Route service temporarily unavailable" });
  }
};
