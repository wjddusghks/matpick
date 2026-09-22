const { authorizeAdminRequest } = require("./_adminAuth");
const {
  applyApiSecurityHeaders,
  enforceSameOrigin,
} = require("../_requestGuards");
const { enforceRateLimit, getClientIp } = require("../_rateLimit");

let cache;
function readQueue() {
  if (cache) return cache;
  // Server-only snapshots. Do not import this research into browser bundles.
  const {
    records,
  } = require("../../source-data/topic-publication-2026-09-22/candidates.json");
  const {
    summary,
    decisions,
  } = require("../../source-data/topic-publication-2026-09-22/publication.json");
  const manual = require("../../source-data/topic-publication-2026-09-22/manual-associations.json");
  const byId = new Map(decisions.map((d) => [d.id, d]));
  const rows = records.map((r) => ({ ...r, publication: byId.get(r.id) }));
  cache = { rows, byId: new Map(rows.map((r) => [r.id, r])), summary, manual };
  return cache;
}
const scalar = (value) => (typeof value === "string" ? value : "");
const normalize = (value) =>
  value.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
const statuses = new Set([
  "all",
  "pending",
  "published",
  "partly_published",
  "identity_review",
  "source_review",
  "operation_review",
]);

module.exports = async function handler(req, res) {
  applyApiSecurityHeaders(res);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!enforceSameOrigin(req, res)) return;
  const auth = authorizeAdminRequest({
    adminKey: req.headers?.["x-matpick-admin-key"],
    syncToken: req.headers?.["x-matpick-admin-token"],
  });
  if (!auth.valid)
    return res
      .status(403)
      .json({ error: "관리자 권한이 필요합니다. 다시 로그인해 주세요." });
  try {
    if (
      !(await enforceRateLimit(req, res, {
        bucket: "admin:topic-research",
        subject: getClientIp(req),
        limit: 90,
        windowSec: 60,
        message: "요청이 많습니다. 잠시 후 다시 시도해 주세요.",
      }))
    )
      return;
    const data = readQueue();
    const query = req.query || {};
    if (query.id !== undefined) {
      const row = data.byId.get(scalar(query.id));
      if (!row)
        return res.status(404).json({ error: "조사 후보를 찾을 수 없습니다." });
      return res
        .status(200)
        .json({
          row: {
            ...row,
            manualEvidence: data.manual.filter((m) => m.candidateId === row.id),
          },
        });
    }
    const search = normalize(scalar(query.q).slice(0, 200));
    const topic = Number(scalar(query.topic) || 0);
    const status = scalar(query.status) || "pending";
    if (
      !Number.isInteger(topic) ||
      topic < 0 ||
      topic > 10 ||
      !statuses.has(status)
    )
      return res.status(400).json({ error: "검색 조건을 확인해 주세요." });
    const limit = Math.min(
      100,
      Math.max(1, Math.floor(Number(scalar(query.limit)) || 30)),
    );
    const filtered = data.rows.filter(
      (r) =>
        (!topic || r.topicRanks.includes(topic)) &&
        (status === "all" ||
          (status === "pending"
            ? r.publication.reason !== "published"
            : r.publication.reason === status)) &&
        (!search ||
          normalize(
            `${r.name} ${r.address} ${r.menuLabels.join(" ")}`,
          ).includes(search)),
    );
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(
      pages,
      Math.max(1, Math.floor(Number(scalar(query.page)) || 1)),
    );
    const rows = filtered.slice((page - 1) * limit, page * limit).map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      topicRanks: r.topicRanks,
      menuLabels: r.menuLabels.slice(0, 3),
      menuStatus: r.menuStatus,
      registryStatus: r.registryStatus,
      evidenceCount: r.evidence.length,
      publication: r.publication,
    }));
    return res
      .status(200)
      .json({ summary: data.summary, total, page, pages, limit, rows });
  } catch {
    return res
      .status(503)
      .json({
        error: "조사 자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      });
  }
};
