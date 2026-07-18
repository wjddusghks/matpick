import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..", "..");
const datasetId = process.argv[2];
const datasetNames = {
  "sikgaek-baekban-trip": "식객 허영만의 백반기행",
  "wednesday-gourmet": "수요미식회",
};

if (!datasetNames[datasetId]) {
  throw new Error(
    "Usage: node scripts/report-source-menu-gaps.mjs <sikgaek-baekban-trip|wednesday-gourmet>"
  );
}

const sourceDirectory = path.join(workspaceRoot, "source-data", datasetId);
const menuPricePath = path.join(sourceDirectory, "menu-prices.json");
const reportJsonPath = path.join(sourceDirectory, "menu-missing-report.json");
const reportMarkdownPath = path.join(sourceDirectory, "menu-missing-report.md");
const menuPriceData = JSON.parse(fs.readFileSync(menuPricePath, "utf8"));

const statusLabels = {
  unmatched: "식당 검색 불일치",
  matched_no_priced_menu: "가격 메뉴판 비공개",
  closed: "폐업",
  error: "수집 오류",
};
const statusReasons = {
  unmatched: "주소와 상호가 모두 일치하는 공개 장소 정보를 확인하지 못함",
  matched_no_priced_menu: "식당 장소는 확인했으나 가격이 표시된 공개 메뉴판이 없음",
  closed: "원본 자료 또는 공개 장소 정보에서 폐업으로 확인됨",
  error: "공개 장소 정보 수집 중 오류가 발생함",
};

const missingRestaurants = Object.entries(menuPriceData.restaurants ?? {})
  .filter(([, restaurant]) => (restaurant.menus ?? []).length === 0)
  .map(([id, restaurant]) => ({
    id,
    name: restaurant.name ?? "",
    address: restaurant.address ?? "",
    status: restaurant.status ?? "unmatched",
    statusLabel: statusLabels[restaurant.status] ?? restaurant.status ?? "확인 필요",
    reason: restaurant.note || statusReasons[restaurant.status] || "가격 메뉴 정보 없음",
    matchedName: restaurant.pageName ?? "",
    matchedAddress: restaurant.pageAddress ?? "",
    phone: restaurant.phone ?? "",
    placeUrl: restaurant.placeUrl ?? "",
    verifiedAt: restaurant.verifiedAt ?? "",
    candidates: restaurant.candidates ?? [],
  }))
  .sort((a, b) => {
    const statusOrder = ["unmatched", "matched_no_priced_menu", "closed", "error"];
    const statusDifference = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
    return statusDifference || a.name.localeCompare(b.name, "ko");
  });

const countsByStatus = Object.fromEntries(
  Object.keys(statusLabels).map((status) => [
    status,
    missingRestaurants.filter((restaurant) => restaurant.status === status).length,
  ])
);
const pricedRestaurants = Object.values(menuPriceData.restaurants ?? {}).filter(
  (restaurant) => (restaurant.menus ?? []).length > 0
);
const pricedMenuCount = pricedRestaurants.reduce(
  (total, restaurant) => total + restaurant.menus.length,
  0
);

const report = {
  datasetId,
  datasetName: datasetNames[datasetId],
  verifiedAt: menuPriceData.collectedAt,
  source: menuPriceData.source,
  totals: {
    restaurants: Object.keys(menuPriceData.restaurants ?? {}).length,
    restaurantsWithPricedMenus: pricedRestaurants.length,
    pricedMenus: pricedMenuCount,
    restaurantsWithoutPricedMenus: missingRestaurants.length,
    ...countsByStatus,
  },
  missingRestaurants,
};

const escapeTableCell = (value) => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
const markdownLines = [
  `# ${report.datasetName} 메뉴·가격 미확인 식당`,
  "",
  `- 확인 시각: ${report.verifiedAt}`,
  `- 전체 원본 식당: ${report.totals.restaurants}곳`,
  `- 가격 메뉴 확보: ${report.totals.restaurantsWithPricedMenus}곳 / ${report.totals.pricedMenus}개 메뉴`,
  `- 가격 메뉴 미확인: ${report.totals.restaurantsWithoutPricedMenus}곳`,
  `- 식당 검색 불일치: ${report.totals.unmatched}곳`,
  `- 가격 메뉴판 비공개: ${report.totals.matched_no_priced_menu}곳`,
  `- 폐업: ${report.totals.closed}곳`,
  "",
  "> 가격을 추정하거나 임의 입력하지 않았습니다. 장소와 공개 메뉴판을 확인할 수 없는 식당만 아래에 분리했습니다.",
  "",
];

for (const status of ["unmatched", "matched_no_priced_menu", "closed", "error"]) {
  const restaurants = missingRestaurants.filter((restaurant) => restaurant.status === status);
  if (restaurants.length === 0) continue;
  markdownLines.push(`## ${statusLabels[status]} (${restaurants.length}곳)`, "");
  markdownLines.push("| 식당 | 원본 주소 | 확인 내용 | 공개 장소 |", "|---|---|---|---|");
  for (const restaurant of restaurants) {
    const matchedPlace = restaurant.placeUrl
      ? `[${escapeTableCell(restaurant.matchedName || "카카오맵")}](${restaurant.placeUrl})`
      : "-";
    markdownLines.push(
      `| ${escapeTableCell(restaurant.name)} | ${escapeTableCell(restaurant.address)} | ${escapeTableCell(restaurant.reason)} | ${matchedPlace} |`
    );
  }
  markdownLines.push("");
}

while (markdownLines.at(-1) === "") markdownLines.pop();
fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(reportMarkdownPath, `${markdownLines.join("\n")}\n`);
console.log(`Generated ${reportJsonPath}`);
console.log(`Generated ${reportMarkdownPath}`);
console.log(JSON.stringify(report.totals, null, 2));
