const { authorizeAdminRequest } = require("./_adminAuth");
// Invoked by /api/restaurants; keep a single deployed function for the catalog.
const {
  applyApiSecurityHeaders,
  enforceSameOrigin,
} = require("../_requestGuards");
const { enforceRateLimit, getClientIp } = require("../_rateLimit");
const {
  createRestaurant,
  readEdits,
  saveEdit,
  validateChanges,
  validateNewRestaurant,
} = require("../restaurants/_restaurantEdits");
const dataset = require("../../matpick_all/client/src/data/generated/public-dataset.json");
const datasetRestaurantIds = new Set(
  dataset.restaurants.map((restaurant) => restaurant.id),
);
const sourceIds = new Set((dataset.sources || []).map((source) => source.id));
const ADMIN_CATALOG_PAGE_SIZE = 800;
const sourceLinksByRestaurant = new Map();
for (const link of dataset.sourceLinks || []) {
  const links = sourceLinksByRestaurant.get(link.restaurantId) || [];
  links.push(link);
  sourceLinksByRestaurant.set(link.restaurantId, links);
}

function createdRestaurants(edits) {
  return edits
    .filter(
      (edit) => edit.createdAt && !datasetRestaurantIds.has(edit.restaurantId),
    )
    .map((edit) => ({ id: edit.restaurantId, ...edit.changes }));
}

function effectiveRestaurants(edits) {
  const editsById = new Map(edits.map((edit) => [edit.restaurantId, edit]));
  return [...dataset.restaurants, ...createdRestaurants(edits)]
    .filter((restaurant) => !editsById.get(restaurant.id)?.deletedAt)
    .map((restaurant) => ({
      ...restaurant,
      ...(editsById.get(restaurant.id)?.changes || {}),
      id: restaurant.id,
    }));
}

function catalogPage(
  allRestaurants,
  offset,
  includeMetadata,
  editsById = new Map(),
) {
  const restaurants = allRestaurants.slice(
    offset,
    offset + ADMIN_CATALOG_PAGE_SIZE,
  );
  const nextOffset = offset + restaurants.length;
  return {
    restaurants,
    ...(includeMetadata ? { sources: dataset.sources || [] } : {}),
    sourceLinks: restaurants.flatMap((restaurant) => {
      const edited = editsById.get(restaurant.id)?.changes?.sourceLinks;
      return Array.isArray(edited)
        ? edited
        : sourceLinksByRestaurant.get(restaurant.id) || [];
    }),
    pageSize: ADMIN_CATALOG_PAGE_SIZE,
    totalCount: allRestaurants.length,
    nextCursor: nextOffset < allRestaurants.length ? String(nextOffset) : null,
  };
}

function normalizeIdentity(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^a-z0-9가-힣]/g, "");
}

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
      const includeCatalog = req.query?.includeCatalog === "1";
      const offset = Math.max(
        0,
        Number.parseInt(String(req.query?.cursor || "0"), 10) || 0,
      );
      const editState = await readEdits();
      const editsById = new Map(
        editState.edits.map((edit) => [edit.restaurantId, edit]),
      );
      const adminRestaurants = [
        ...dataset.restaurants,
        ...createdRestaurants(editState.edits),
      ];
      // Cursor zero carries the edit snapshot used for the whole admin load.
      if (includeCatalog && offset > 0) {
        return res.status(200).json({
          catalog: catalogPage(adminRestaurants, offset, false, editsById),
        });
      }
      if (req.query?.summaryOnly === "1") {
        const publicRestaurants = adminRestaurants
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
              (restaurant) => restaurant.lat && restaurant.lng,
            ).length,
            restaurantsWithPhotos: publicRestaurants.filter((restaurant) =>
              restaurant.imageUrl?.trim(),
            ).length,
            restaurantsWithMenus: publicRestaurants.filter(
              (restaurant) => (restaurant.menus?.length || 0) > 0,
            ).length,
            menuCount: publicRestaurants.reduce(
              (sum, restaurant) => sum + (restaurant.menus?.length || 0),
              0,
            ),
            sourceCount: (dataset.sources || []).length,
            visitCount: (dataset.visits || []).length,
          },
        });
      }
      if (!includeCatalog) return res.status(200).json(editState);
      return res.status(200).json({
        ...editState,
        catalog: catalogPage(adminRestaurants, offset, true, editsById),
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
    const editState = await readEdits();
    if (body.action === "create") {
      if (
        typeof body.requestId !== "string" ||
        !/^[a-zA-Z0-9_-]{16,100}$/.test(body.requestId)
      )
        return res
          .status(400)
          .json({ error: "등록 요청 식별자를 확인해 주세요." });
      const restaurantId = `pending_${Date.now().toString(36)}`;
      const changes = validateNewRestaurant(
        body.changes,
        restaurantId,
        sourceIds,
        body.locationValidated,
      );
      const normalizedName = normalizeIdentity(changes.name);
      const normalizedAddress = normalizeIdentity(changes.address);
      const identity = `${normalizedName}:${normalizedAddress}`;
      const retried = editState.edits.find(
        (edit) => edit.createRequestId === body.requestId,
      );
      if (retried) return res.status(200).json({ ok: true, edit: retried });
      const allRestaurants = effectiveRestaurants(editState.edits);
      if (
        allRestaurants.some(
          (restaurant) =>
            normalizeIdentity(restaurant.name) === normalizedName &&
            normalizeIdentity(restaurant.address) === normalizedAddress,
        )
      )
        return res.status(409).json({
          error: "같은 이름과 주소의 식당이 이미 등록되어 있습니다.",
        });
      const edit = await createRestaurant({
        changes,
        actor: adminKey,
        requestId: body.requestId,
        identity,
      });
      return res.status(201).json({ ok: true, edit });
    }
    const knownRestaurantIds = new Set([
      ...datasetRestaurantIds,
      ...editState.edits
        .filter((edit) => edit.createdAt)
        .map((edit) => edit.restaurantId),
    ]);
    if (!knownRestaurantIds.has(body.restaurantId))
      return res.status(404).json({ error: "등록된 식당을 찾을 수 없습니다." });
    if (!["save", "reset", "delete", "restore"].includes(body.action))
      return res.status(400).json({ error: "작업을 확인해 주세요." });
    const existingEdit = editState.edits.find(
      (edit) => edit.restaurantId === body.restaurantId,
    );
    if (body.action === "reset" && existingEdit?.createdAt)
      return res
        .status(400)
        .json({ error: "직접 등록한 식당은 초기화할 수 없습니다." });
    const changes =
      body.action !== "save"
        ? {}
        : validateChanges(body.changes, body.restaurantId, sourceIds);
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
