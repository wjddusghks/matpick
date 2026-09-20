import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { identityMatch } from "./menu-research/matching.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "source-data/menu-research-2026-09");
const queue = JSON.parse(
  await fs.readFile(path.join(dir, "queue.json"), "utf8"),
);
const results = JSON.parse(
  await fs.readFile(path.join(dir, "results.json"), "utf8"),
);
let manual = {};
try {
  manual = JSON.parse(await fs.readFile(path.join(dir, "manual.json"), "utf8"));
} catch {}
const patches = {};
const unresolved = [];
for (const restaurant of queue) {
  const record = manual[restaurant.id] || results.restaurants[restaurant.id];
  if (
    !record ||
    !["verified_priced", "verified_menu_only"].includes(record.status)
  ) {
    unresolved.push({
      ...restaurant,
      status: record?.status || "pending",
      checkedAt: record?.checkedAt,
      candidates: record?.candidates || [],
    });
    continue;
  }
  if (
    !record.menus?.length ||
    !identityMatch(restaurant, record.place).accepted ||
    !/^https:\/\//.test(record.place.placeUrl) ||
    !record.checkedAt
  )
    throw new Error(`Unverified menu patch ${restaurant.id}`);
  patches[restaurant.id] = {
    menus: record.menus,
    menuPriceStatus: record.status,
    menuPriceVerifiedAt: record.checkedAt.slice(0, 10),
    menuPriceSources: [
      {
        label: record.sourceLabel || "카카오지도 공개 메뉴",
        url: record.place.placeUrl,
        ...(record.sourceUpdatedAt
          ? { publishedAt: record.sourceUpdatedAt.slice(0, 10) }
          : {}),
      },
    ],
    menuPriceNote:
      "같은 상호와 주소의 공개 메뉴를 확인했습니다. 매장 가격은 바뀔 수 있습니다.",
  };
}
const filename = path.join(
  root,
  "matpick_all/client/src/data/generated/menu-research.generated.json",
);
await fs.writeFile(filename, JSON.stringify(patches, null, 2) + "\n");
const summary = {
  target: queue.length,
  checked: Object.keys(results.restaurants).length,
  withMenus: Object.keys(patches).length,
  withPrices: Object.values(patches).filter((p) => p.menus.some((m) => m.price))
    .length,
  menuItems: Object.values(patches).reduce((n, p) => n + p.menus.length, 0),
  unresolved: unresolved.length,
  withoutVerifiedPrices: queue.length - Object.values(patches).filter((p) => p.menus.some((m) => m.price)).length,
  unresolvedByStatus: unresolved.reduce(
    (a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a),
    {},
  ),
};
await fs.writeFile(
  path.join(dir, "report.json"),
  JSON.stringify(
    { updatedAt: results.updatedAt, summary, unresolved },
    null,
    2,
  ) + "\n",
);
const escape = (s) =>
  String(s || "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
const statusLabels = {
  identity_review: "상호·주소 일치 여부 재확인",
  ambiguous_branch: "같은 주소의 복수 지점 후보",
  public_menu_unavailable: "동일 지점 확인 / 공개 메뉴 없음",
  operation_review: "기존 폐업·이전 표시 또는 영업 상태 확인 필요",
  request_error: "조회 오류 / 재시도 필요",
  pending: "조회 대기",
};
const priceMissing = queue.filter((r) => patches[r.id] && !patches[r.id].menus.some((m) => m.price));
await fs.writeFile(
  path.join(dir, "report.md"),
  `# 메뉴·가격 확보 현황\n\n${Object.entries(summary)
    .filter(([, v]) => typeof v === "number")
    .map(([k, v]) => `- ${k}: ${v}`)
    .join(
      "\n",
    )}\n\n882곳은 시작 시점의 메뉴 누락 대상입니다. 조회 완료와 가격 확보는 다릅니다. 동일 지점 검증에 통과한 공개 메뉴만 화면에 반영합니다. 사진·타인 후기는 수집하지 않습니다. 가격은 조회 시점에 공개되어 있던 값이며 매장 현장 확인을 뜻하지 않습니다. 메뉴 항목별 가격 누락은 추정으로 채우지 않았습니다.\n\n- 반영 메뉴: 앱의 generated/menu-research.generated.json\n- 원문 URL·조회 날짜·가격 자료: results.json 및 manual.json\n- 상세 후보·주소 대조: report.json\n\n## 메뉴만 확인되고 가격이 없는 식당\n\n${priceMissing.map((r) => `- ${r.name} — ${r.address}`).join("\n")}\n\n## 추가 확인 대상\n\n| 식당 | 주소 | 상태 |\n|---|---|---|\n${unresolved.map((r) => `| [${escape(r.name)}](https://map.naver.com/p/search/${encodeURIComponent(`${r.name} ${r.address}`)}) | ${escape(r.address)} | ${statusLabels[r.status] || r.status} |`).join("\n")}\n`,
);
console.log(JSON.stringify(summary));
