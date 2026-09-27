const { authorizeAdminRequest } = require("./_adminAuth");
// Invoked by /api/restaurants; keep a single deployed function for the catalog.
const {
  applyApiSecurityHeaders,
  enforceSameOrigin,
} = require("../_requestGuards");
const { enforceRateLimit, getClientIp } = require("../_rateLimit");
const {
  readEdits,
  saveEdit,
  validateChanges,
} = require("../restaurants/_restaurantEdits");
const dataset = require("../../matpick_all/client/src/data/generated/public-dataset.json");
const restaurantIds = new Set(
  dataset.restaurants.map((restaurant) => restaurant.id),
);

module.exports = async function handler(req, res) {
  applyApiSecurityHeaders(res);
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!enforceSameOrigin(req, res)) return;
  const adminKey = req.headers?.["x-matpick-admin-key"];
  const auth = authorizeAdminRequest({
    adminKey,
    syncToken: req.headers?.["x-matpick-admin-token"],
  });
  if (!auth.valid)
    return res
      .status(403)
      .json({ error: "관리자 권한이 필요합니다. 다시 로그인해 주세요." });
  try {
    if (
      !(await enforceRateLimit(req, res, {
        bucket: "admin:restaurants",
        subject: getClientIp(req),
        limit: 60,
        windowSec: 60,
        message: "요청이 많습니다. 잠시 후 다시 시도해 주세요.",
      }))
    )
      return;
    if (req.method === "GET") {
      const editState = await readEdits();
      if (req.query?.summaryOnly === "1") {
        const editsById = new Map(
          editState.edits.map((edit) => [edit.restaurantId, edit])
        );
        const publicRestaurants = dataset.restaurants
          .filter((restaurant) => !editsById.get(restaurant.id)?.deletedAt)
          .map((restaurant) => ({
            ...restaurant,
            ...(editsById.get(restaurant.id)?.changes || {}),
            id: restaurant.id,
          }));
        return res.status(200).json({
          configured: editState.configured,
          summary: {
            restaurantCount: publicRestaurants.length,
            restaurantsWithCoordinates: publicRestaurants.filter(
              (restaurant) => restaurant.lat && restaurant.lng
            ).length,
            restaurantsWithPhotos: publicRestaurants.filter((restaurant) =>
              restaurant.imageUrl?.trim()
            ).length,
            restaurantsWithMenus: publicRestaurants.filter(
              (restaurant) => (restaurant.menus?.length || 0) > 0
            ).length,
            menuCount: publicRestaurants.reduce(
              (sum, restaurant) => sum + (restaurant.menus?.length || 0),
              0
            ),
            sourceCount: (dataset.sources || []).length,
            visitCount: (dataset.visits || []).length,
          },
        });
      }
      if (req.query?.includeCatalog !== "1") return res.status(200).json(editState);
      const offset = Math.max(0, Number.parseInt(String(req.query?.cursor || "0"), 10) || 0);
      const pageSize = 200;
      const restaurants = dataset.restaurants.slice(offset, offset + pageSize);
      const restaurantIds = new Set(restaurants.map((restaurant) => restaurant.id));
      const nextOffset = offset + restaurants.length;
      return res.status(200).json({
        ...editState,
        catalog: {
          restaurants,
          sources: dataset.sources || [],
          sourceLinks: (dataset.sourceLinks || []).filter((link) =>
            restaurantIds.has(link.restaurantId)
          ),
          nextCursor: nextOffset < dataset.restaurants.length ? String(nextOffset) : null,
        },
      });
    }
    const raw =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    if (Buffer.byteLength(raw) > 100000)
      return res.status(413).json({ error: "수정 내용이 너무 큽니다." });
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return res.status(400).json({ error: "요청 형식이 올바르지 않습니다." });
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return res.status(400).json({ error: "요청 형식이 올바르지 않습니다." });
    if (!restaurantIds.has(body.restaurantId))
      return res.status(404).json({ error: "등록된 식당을 찾을 수 없습니다." });
    if (!["save", "reset", "delete", "restore"].includes(body.action))
      return res.status(400).json({ error: "작업을 확인해 주세요." });
    const changes =
      body.action !== "save"
        ? {}
        : validateChanges(body.changes, body.restaurantId);
    const edit = await saveEdit({
      restaurantId: body.restaurantId,
      expectedRevision: body.expectedRevision,
      changes,
      actor: adminKey,
      action: body.action,
    });
    return res.status(200).json({ ok: true, edit });
  } catch (error) {
    return res.status(error.status || 503).json({
      error: error.status
        ? error.message
        : "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    });
  }
};
