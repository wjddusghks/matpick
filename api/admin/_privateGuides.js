const { authorizeAdminRequest } = require("./_adminAuth");
const { applyApiSecurityHeaders, enforceSameOrigin } = require("../_requestGuards");

// Official reference links, not an imported Blue Ribbon restaurant database.
// Keep the regional catalog on the server, out of public search and SEO data.
const regions = [
  ["seoul", "서울", "FFGO2w8e"],
  ["capital", "수도권", "GJTqNSq5"],
  ["gangwon-chungcheong", "강원·충청권", "5Rh6V31q"],
  ["gyeongsang", "경상권", "5WODjzsW"],
  ["jeolla", "전라권", "5chg0w6h"],
  ["jeju", "제주권", "F88r39Mq"],
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
  return res.status(200).json({
    title: "레드리본 지역별 가이드",
    edition: "2026",
    sourceUrl: "https://linktr.ee/cocacolaredribbon_N",
    checkedAt: "2026-09-24",
    regions: regions.map(([id, name, shortCode]) => ({ id, name, url: `https://naver.me/${shortCode}` })),
  });
};
