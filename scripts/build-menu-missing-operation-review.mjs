import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const reviewDir = path.join(
  root,
  "source-data",
  "menu-missing-operation-review-2026-09-28",
);
const names = fs
  .readFileSync(path.join(reviewDir, "live-admin-menu-missing-names.txt"), "utf8")
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);
const deployed = JSON.parse(
  fs.readFileSync(path.join(reviewDir, "live-admin-menu-missing.json"), "utf8"),
);
const current = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      "matpick_all",
      "client",
      "src",
      "data",
      "generated",
      "public-dataset.json",
    ),
    "utf8",
  ),
);
const operationAudit = JSON.parse(
  fs.readFileSync(
    path.join(root, "source-data", "operation-audit-2026-09-21", "review-actions.json"),
    "utf8",
  ),
);
const verifiedMenus = JSON.parse(
  fs.readFileSync(
    path.join(root, "source-data", "naver-menu-live-2026-09-27", "verified-menu-overrides.json"),
    "utf8",
  ),
);
const freshSearchPath = path.join(reviewDir, "fresh-web-searches.json");
const freshSearches = fs.existsSync(freshSearchPath)
  ? JSON.parse(fs.readFileSync(freshSearchPath, "utf8"))
  : { batches: [] };
const extraSearchPath = path.join(reviewDir, "fresh-web-search-extra.json");
const extraSearches = fs.existsSync(extraSearchPath)
  ? JSON.parse(fs.readFileSync(extraSearchPath, "utf8"))
  : { batches: [] };

const deployedByName = new Map(
  deployed.restaurants.map((restaurant) => [restaurant.name, restaurant]),
);
const currentById = new Map(
  current.restaurants.map((restaurant) => [restaurant.id, restaurant]),
);
const auditById = new Map(
  operationAudit.restaurants.map((restaurant) => [restaurant.id, restaurant]),
);
const identityDecisionById = new Map(
  (verifiedMenus.identityReviewDecisions || []).map((row) => [row.restaurantId, row]),
);
const relocationById = new Map(
  (Array.isArray(verifiedMenus.relocationEvidence)
    ? verifiedMenus.relocationEvidence
    : verifiedMenus.relocationEvidence
      ? [verifiedMenus.relocationEvidence]
      : []
  ).map((row) => [row.restaurantId, row]),
);
const sourceById = new Map(
  (deployed.sources || []).map((source) => [source.id, source.name]),
);
const linksByRestaurant = new Map();
for (const link of deployed.sourceLinks || []) {
  const rows = linksByRestaurant.get(link.restaurantId) || [];
  rows.push({
    sourceId: link.sourceId,
    sourceName: sourceById.get(link.sourceId) || link.sourceId,
    label: link.label || "",
  });
  linksByRestaurant.set(link.restaurantId, rows);
}

function initialClassification(base, latest, audit, identityDecision, relocation) {
  if (identityDecision?.decision?.disposition?.includes("delete"))
    return "closed_confirmed_user_review";
  if (relocation || identityDecision?.decision?.currentAddress)
    return "moved_confirmed_user_review";
  if ((latest?.menus || []).length) return "menu_now_registered";
  if (/폐업/.test(base.name)) return "closed_labeled_existing";
  if (/이전/.test(base.name)) return "moved_labeled_existing";
  if (audit?.group === "licensed_closed" || audit?.status === "closed_at_address")
    return "closed_prior_evidence";
  if (audit?.group === "operating" || /operating/.test(audit?.status || ""))
    return "operating_prior_evidence";
  return "needs_fresh_web_check";
}

function searchName(value) {
  return value
    .replace(/^서울\s+|^부산\s+|^인천\s+|^대전\s+|^대구\s+|^광주\s+|^울산\s+|^제주\s+/, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const freshBatchById = new Map();
for (const batch of [
  ...(freshSearches.batches || []),
  ...(extraSearches.batches || []),
]) {
  for (const item of batch.items || []) freshBatchById.set(item.id, batch.result || "");
}

function freshWebCheck(base) {
  const raw = freshBatchById.get(base.id);
  if (!raw) return null;
  const needle = searchName(base.name).toLowerCase();
  const fallback = needle.split(/\s+/).sort((a, b) => b.length - a.length)[0] || needle;
  const sections = String(raw)
    .split(/-{20,}/)
    .map((section) => section.trim())
    .filter(
      (section) =>
        section.toLowerCase().includes(needle) ||
        (fallback.length >= 3 && section.toLowerCase().includes(fallback)),
    )
    .slice(0, 8);
  const evidenceText = sections.join("\n");
  const signalWindows = sections
    .map((section) => {
      const lower = section.toLowerCase();
      const index = lower.indexOf(needle);
      return index < 0
        ? ""
        : section.slice(Math.max(0, index - 180), index + needle.length + 240);
    })
    .filter(Boolean)
    .join("\n");
  const evidenceUrls = Array.from(
    new Set(
      [...evidenceText.matchAll(/\((https?:\/\/[^\s)]+)\)/g)].map(
        (match) => match[1],
      ),
    ),
  );
  let outcome = "inconclusive";
  if (/폐업하지\s*않|정상\s*영업/.test(signalWindows))
    outcome = "operating_signal";
  else if (/확장\s*이전|이전\s*오픈|이전하여|새로운\s*주소|현\s*위치로\s*이전/.test(signalWindows))
    outcome = "moved_signal";
  else if (/현재\s*폐업|폐업(?:했|한|으로|됨|입니다|했다)|영업\s*종료|영업종료|폐점/.test(signalWindows))
    outcome = "closed_signal";
  return {
    checkedAt: freshSearches.generatedAt || null,
    query: `${base.region || base.address.split(/\s+/)[0] || ""} ${searchName(base.name)} 폐업?`,
    outcome,
    matchedResultCount: sections.length,
    evidenceUrls,
    evidenceSnippets: sections,
    caution:
      "검색 결과 신호는 자동 반영하지 않는다. 폐업·이전 후보는 동일 지점 주소와 최근 원문을 한 번 더 확인한다.",
  };
}

const restaurants = names.map((name, index) => {
  const base = deployedByName.get(name);
  if (!base) throw new Error(`운영 목록에서 식당을 찾지 못했습니다: ${name}`);
  const latest = currentById.get(base.id);
  const audit = auditById.get(base.id);
  const identityDecision = identityDecisionById.get(base.id);
  const relocation = relocationById.get(base.id);
  const suggestedName =
    identityDecision?.decision?.currentName ||
    relocation?.name ||
    (latest?.name !== base.name ? latest?.name : "");
  const suggestedAddress =
    identityDecision?.decision?.currentAddress ||
    relocation?.address ||
    (latest?.address !== base.address ? latest?.address : "");
  const startingClassification = initialClassification(
    base,
    latest,
    audit,
    identityDecision,
    relocation,
  );
  const webCheck =
    startingClassification === "needs_fresh_web_check"
      ? freshWebCheck(base)
      : null;
  const classification =
    webCheck?.outcome === "closed_signal"
      ? "closed_fresh_search_signal"
      : webCheck?.outcome === "moved_signal"
        ? "moved_fresh_search_signal"
        : webCheck?.outcome === "operating_signal"
          ? "operating_fresh_search_signal"
          : webCheck
            ? "fresh_search_inconclusive"
            : startingClassification;
  return {
    number: index + 1,
    restaurantId: base.id,
    name: base.name,
    address: base.address,
    region: base.region || "",
    searchQuery: `${base.region || base.address.split(/\s+/)[0] || ""} ${base.name.replace(/\s*\([^)]*\)\s*/g, " ").trim()} 폐업?`,
    classification,
    suggestedName: suggestedName || null,
    suggestedAddress: suggestedAddress || null,
    priorEvidence: audit
      ? {
          status: audit.status,
          group: audit.group,
          reason: audit.reason,
          checkedAt: operationAudit.checkedAt,
          evidenceUrls: audit.evidenceUrls || [],
        }
      : null,
    userReviewedEvidence: identityDecision
      ? {
          checkedAt: verifiedMenus.checkedAt,
          decision: identityDecision.decision,
          sourceUrl: identityDecision.sourceUrl || null,
        }
      : relocation || null,
    currentGeneratedRecord: latest
      ? {
          name: latest.name,
          address: latest.address,
          operationState: latest.operationState || null,
          operationStatus: latest.operationStatus || null,
          menuCount: (latest.menus || []).length,
        }
      : null,
    sources: linksByRestaurant.get(base.id) || [],
    freshWebCheck: webCheck,
    automaticDatabaseChanges: false,
  };
});

const counts = restaurants.reduce((result, restaurant) => {
  result[restaurant.classification] =
    (result[restaurant.classification] || 0) + 1;
  return result;
}, {});
const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: "맛픽 운영 관리자 > 메뉴 미등록 347곳",
  sourceUrl: "https://matpick.co.kr/admin/restaurants",
  scopeCount: restaurants.length,
  mode: "review-only",
  automaticDatabaseChanges: false,
  note: "이 파일은 폐업·이전 조사용이며 사이트 데이터에 자동 반영하지 않는다.",
  counts,
  restaurants,
};
fs.writeFileSync(
  path.join(reviewDir, "operation-review.json"),
  `${JSON.stringify(output, null, 2)}\n`,
);
const closed = restaurants.filter((restaurant) =>
  restaurant.classification.startsWith("closed_"),
);
const moved = restaurants.filter((restaurant) =>
  restaurant.classification.startsWith("moved_"),
);
const inconclusive = restaurants.filter(
  (restaurant) => restaurant.classification === "fresh_search_inconclusive",
);
const markdown = [
  "# 메뉴 미등록 식당 영업 상태 조사",
  "",
  `- 조사 범위: 운영 관리자 화면의 메뉴 미등록 식당 **${restaurants.length}곳**`,
  `- 폐업 신호·기존 근거: **${closed.length}곳**`,
  `- 이전 신호·기존 근거: **${moved.length}곳**`,
  `- 최신 웹 검색 결과만으로 결론을 내릴 수 없음: **${inconclusive.length}곳**`,
  "- 사이트 자동 반영: **하지 않음**",
  "",
  "> 검색 결과의 요약·업체 목록만으로 삭제하거나 주소를 바꾸지 않습니다. 동일 지점의 최근 원문과 주소를 다시 확인한 뒤 관리자에서 반영해야 합니다.",
  "",
  "## 이전 후보",
  "",
  "| 식당 | 기존 주소 | 확인된/제안 주소 | 근거 |",
  "| --- | --- | --- | --- |",
  ...moved.map((restaurant) => {
    const urls = [
      ...(restaurant.priorEvidence?.evidenceUrls || []),
      ...(restaurant.freshWebCheck?.evidenceUrls || []),
      ...(restaurant.userReviewedEvidence?.sourceUrl
        ? [restaurant.userReviewedEvidence.sourceUrl]
        : []),
    ];
    return `| ${restaurant.name.replaceAll("|", "\\|")} | ${restaurant.address.replaceAll("|", "\\|")} | ${(restaurant.suggestedAddress || "주소 추가 확인 필요").replaceAll("|", "\\|")} | ${urls.slice(0, 2).map((url, index) => `[${index + 1}](${url})`).join(" ") || restaurant.classification} |`;
  }),
  "",
  "## 폐업 후보",
  "",
  "| 식당 | 기존 주소 | 분류 | 근거 |",
  "| --- | --- | --- | --- |",
  ...closed.map((restaurant) => {
    const urls = [
      ...(restaurant.priorEvidence?.evidenceUrls || []),
      ...(restaurant.freshWebCheck?.evidenceUrls || []),
      ...(restaurant.userReviewedEvidence?.sourceUrl
        ? [restaurant.userReviewedEvidence.sourceUrl]
        : []),
    ];
    return `| ${restaurant.name.replaceAll("|", "\\|")} | ${restaurant.address.replaceAll("|", "\\|")} | ${restaurant.classification} | ${urls.slice(0, 2).map((url, index) => `[${index + 1}](${url})`).join(" ") || "기존 명칭·검토 기록"} |`;
  }),
  "",
  "## 결론 미확정",
  "",
  ...inconclusive.map(
    (restaurant) =>
      `- ${restaurant.name} — ${restaurant.address} — 검색어: \`${restaurant.searchQuery}\``,
  ),
  "",
].join("\n");
fs.writeFileSync(path.join(reviewDir, "README.md"), markdown);

function csv(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}
const csvRows = [
  [
    "번호",
    "식당 ID",
    "상호",
    "기존 주소",
    "분류",
    "제안 상호",
    "제안 주소",
    "검색어",
    "검색 결과",
    "근거 URL",
  ],
  ...restaurants.map((restaurant) => [
    restaurant.number,
    restaurant.restaurantId,
    restaurant.name,
    restaurant.address,
    restaurant.classification,
    restaurant.suggestedName,
    restaurant.suggestedAddress,
    restaurant.searchQuery,
    restaurant.freshWebCheck?.outcome || restaurant.priorEvidence?.status || "",
    [
      ...(restaurant.priorEvidence?.evidenceUrls || []),
      ...(restaurant.freshWebCheck?.evidenceUrls || []),
    ].join(" "),
  ]),
];
fs.writeFileSync(
  path.join(reviewDir, "operation-review.csv"),
  `\uFEFF${csvRows.map((row) => row.map(csv).join(",")).join("\n")}\n`,
);
console.log(JSON.stringify({ scopeCount: restaurants.length, counts }, null, 2));
