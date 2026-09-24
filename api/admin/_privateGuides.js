const { authorizeAdminRequest } = require("./_adminAuth");
const { applyApiSecurityHeaders, enforceSameOrigin } = require("../_requestGuards");
const catalog = require("./_privateGuideCatalog.json");
const { validateProfileSyncToken } = require("../auth/_profileStore");

// Private records must stay server-side. Never import this catalog in client/SEO builds.
const regions = [
  ["seoul", "서울"],
  ["capital", "수도권"],
  ["gangwon-chungcheong", "강원·충청권"],
  ["gyeongsang", "경상권"],
  ["jeolla", "전라권"],
  ["jeju", "제주권"],
];

module.exports = async function handler(req, res) {
  applyApiSecurityHeaders(res);
  res.setHeader("Vary", "x-matpick-admin-key, x-matpick-admin-token");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!enforceSameOrigin(req, res)) return;
  const auth = authorizeAdminRequest({
    adminKey: req.headers?.["x-matpick-admin-key"],
    syncToken: req.headers?.["x-matpick-admin-token"],
  });
  if (!auth.valid) return res.status(403).json({ error: "관리자 로그인이 필요합니다." });
  const session = validateProfileSyncToken(auth.userId, req.headers?.["x-matpick-admin-token"]);
  return res.status(200).json({
    title: "레드리본 지역별 가이드",
    edition: catalog.edition,
    checkedAt: catalog.updatedAt,
    status: catalog.status,
    expiresAt: Math.min(session.expiresAt ? session.expiresAt * 1000 : Infinity, Date.now() + 5 * 60 * 1000),
    regions: regions.map(([id, name]) => ({ id, name })),
    restaurants: catalog.restaurants,
  });
};
