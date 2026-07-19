import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(projectRoot, "..");
const reportDate = new Date(Date.now() + 9 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);
const researchDatasetIds = [
  "sikgaek-baekban-trip",
  "wednesday-gourmet",
  "ttoganjip",
  "baekjong-wok",
  "old-korean-100",
  "popular-restaurants",
  "michelin-3-stars",
  "michelin-2-stars",
  "michelin-1-star",
  "michelin-bib-gourmand",
  "michelin-selected",
];

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function escapeCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse((await fs.readFile(filePath, "utf8")).replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function loadResearchRecords() {
  const records = [];
  for (const datasetId of researchDatasetIds) {
    const payload = await readOptionalJson(
      path.join(workspaceRoot, "source-data", datasetId, "menu-prices.json")
    );
    for (const [restaurantId, record] of Object.entries(payload?.restaurants ?? {})) {
      records.push({ datasetId, restaurantId, ...record });
    }
  }
  return records;
}

function findResearchRecord(restaurant, records) {
  const exact = records.find((record) => record.restaurantId === restaurant.id);
  if (exact) return exact;

  const name = normalize(restaurant.name);
  const address = normalize(restaurant.address);
  return (
    records.find((record) => {
      const recordName = normalize(record.name);
      const recordAddress = normalize(record.address);
      const nameMatches =
        name === recordName ||
        (Math.min(name.length, recordName.length) >= 4 &&
          (name.includes(recordName) || recordName.includes(name)));
      const addressMatches =
        !address ||
        !recordAddress ||
        address === recordAddress ||
        address.includes(recordAddress) ||
        recordAddress.includes(address);
      return nameMatches && addressMatches;
    }) ?? null
  );
}

function getGapType(menus) {
  if (menus.length === 0) return "메뉴 없음";
  const missingPriceCount = menus.filter((menu) => !String(menu.price ?? "").trim()).length;
  if (missingPriceCount === menus.length) return "가격 전부 없음";
  return `가격 일부 없음 (${missingPriceCount}/${menus.length})`;
}

function getResearchLabel(record) {
  if (!record) return "수집 기록 없음";
  const labels = {
    unmatched: "식당 일치 결과 없음",
    panel_mismatch: "장소 상세 불일치",
    matched_no_priced_menu: "공개 가격 메뉴 없음",
    closed: "폐업 확인",
    error: "조회 오류",
  };
  return labels[record.status] ?? record.status ?? "미확인";
}

async function main() {
  const researchRecords = await loadResearchRecords();
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });

  try {
    const data = await server.ssrLoadModule("/src/data/index.ts");
    const gaps = data.restaurants
      .map((restaurant) => {
        const menus = Array.isArray(restaurant.menus) ? restaurant.menus : [];
        const missingPriceCount = menus.filter(
          (menu) => !String(menu.price ?? "").trim()
        ).length;
        if (menus.length > 0 && missingPriceCount === 0) return null;

        const sources = data.getSourcesByRestaurant(restaurant.id);
        const record = findResearchRecord(restaurant, researchRecords);
        return {
          id: restaurant.id,
          name: restaurant.name,
          address: restaurant.address,
          sources: sources.map((source) => ({ id: source.id, name: data.getSourceDisplayName(source) })),
          imageUrl: restaurant.imageUrl || "",
          menuCount: menus.length,
          missingPriceCount,
          gapType: getGapType(menus),
          researchStatus: getResearchLabel(record),
          researchDatasetId: record?.datasetId ?? "",
          placeUrl: record?.placeUrl ?? "",
          candidates: (record?.candidates ?? []).slice(0, 3),
        };
      })
      .filter(Boolean)
      .sort(
        (left, right) =>
          (left.sources[0]?.name ?? "").localeCompare(right.sources[0]?.name ?? "", "ko-KR") ||
          left.name.localeCompare(right.name, "ko-KR")
      );

    const bySource = new Map();
    for (const gap of gaps) {
      for (const source of gap.sources) {
        const current = bySource.get(source.id) ?? {
          sourceId: source.id,
          sourceName: source.name,
          incompleteRestaurantCount: 0,
          noMenuCount: 0,
          allPricesMissingCount: 0,
          partialPriceCount: 0,
        };
        current.incompleteRestaurantCount += 1;
        if (gap.menuCount === 0) current.noMenuCount += 1;
        else if (gap.missingPriceCount === gap.menuCount) current.allPricesMissingCount += 1;
        else current.partialPriceCount += 1;
        bySource.set(source.id, current);
      }
    }

    const summary = {
      generatedAt: new Date().toISOString(),
      totalPublicRestaurantCount: data.restaurants.length,
      incompleteRestaurantCount: gaps.length,
      noMenuCount: gaps.filter((gap) => gap.menuCount === 0).length,
      allPricesMissingCount: gaps.filter(
        (gap) => gap.menuCount > 0 && gap.missingPriceCount === gap.menuCount
      ).length,
      partialPriceCount: gaps.filter(
        (gap) => gap.menuCount > 0 && gap.missingPriceCount < gap.menuCount
      ).length,
      bySource: Array.from(bySource.values()).sort(
        (left, right) => right.incompleteRestaurantCount - left.incompleteRestaurantCount
      ),
    };

    const jsonOutput = { summary, restaurants: gaps };
    const jsonPath = path.join(
      workspaceRoot,
      "source-data",
      "menu-enrichment",
      `public-menu-gap-report-${reportDate}.json`
    );
    await fs.mkdir(path.dirname(jsonPath), { recursive: true });
    await fs.writeFile(jsonPath, `${JSON.stringify(jsonOutput, null, 2)}\n`, "utf8");

    const summaryRows = summary.bySource
      .map(
        (row) =>
          `| ${escapeCell(row.sourceName)} | ${row.incompleteRestaurantCount} | ${row.noMenuCount} | ${row.allPricesMissingCount} | ${row.partialPriceCount} |`
      )
      .join("\n");
    const detailRows = gaps
      .map((gap) => {
        const sourceNames = gap.sources.map((source) => source.name).join(", ");
        const research = gap.placeUrl
          ? `[${gap.researchStatus}](${gap.placeUrl})`
          : gap.researchStatus;
        return `| ${escapeCell(sourceNames)} | ${escapeCell(gap.name)} | ${escapeCell(gap.address)} | ${escapeCell(gap.gapType)} | ${research} |`;
      })
      .join("\n");
    const markdown = `# 공개 식당 메뉴·가격 누락 감사 (${reportDate})

- 공개 식당 카드: ${summary.totalPublicRestaurantCount}곳
- 메뉴·가격 완전 등록: ${summary.totalPublicRestaurantCount - summary.incompleteRestaurantCount}곳
- 보완 필요: ${summary.incompleteRestaurantCount}곳
  - 메뉴 없음: ${summary.noMenuCount}곳
  - 등록 메뉴의 가격 전부 없음: ${summary.allPricesMissingCount}곳
  - 일부 메뉴 가격 없음: ${summary.partialPriceCount}곳

장소명·주소·좌표가 일치하고 공개 가격 메뉴가 확인된 경우에만 자동 반영했다. 일치 결과가 없거나 공개 메뉴에 가격이 없는 식당은 추정 가격을 넣지 않고 아래 목록에 남겼다.

## 주제별 현황

| 주제 | 보완 필요 | 메뉴 없음 | 가격 전부 없음 | 가격 일부 없음 |
| --- | ---: | ---: | ---: | ---: |
${summaryRows}

## 식당별 미확인 목록

| 주제 | 식당 | 주소 | 누락 유형 | 조사 결과 |
| --- | --- | --- | --- | --- |
${detailRows}
`;
    const markdownPath = path.join(
      workspaceRoot,
      "docs",
      `public-menu-gap-audit-${reportDate}.md`
    );
    await fs.writeFile(markdownPath, markdown, "utf8");

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
