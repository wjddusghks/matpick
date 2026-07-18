import fs from "node:fs";
import path from "node:path";
import {
  generatedDataRoot,
  sourceDataRoot,
} from "./source-dataset-paths.mjs";

const datasetId = "wednesday-gourmet";
const baseDatasetPath = path.join(
  generatedDataRoot,
  `${datasetId}.generated.json`
);
const researchRoot = path.join(sourceDataRoot, datasetId, "menu-research");
const outputPath = path.join(
  generatedDataRoot,
  `${datasetId}.menu-research.generated.json`
);
const allowedStatuses = new Set([
  "verified",
  "needs-review",
  "closed",
  "not-found",
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function readBaseDataset() {
  return readJson(baseDatasetPath);
}

function readResearchRecords() {
  if (!fs.existsSync(researchRoot)) return [];

  return fs
    .readdirSync(researchRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((left, right) => left.name.localeCompare(right.name, "ko"))
    .map((entry) => ({
      fileName: entry.name,
      record: readJson(path.join(researchRoot, entry.name)),
    }));
}

function validateRecords(baseDataset, entries) {
  const baseById = new Map(
    baseDataset.restaurants.map((restaurant) => [restaurant.id, restaurant])
  );
  const seenIds = new Set();
  const errors = [];

  for (const { fileName, record } of entries) {
    const prefix = `${fileName}:`;
    const baseRestaurant = baseById.get(record.restaurantId);

    if (record.schemaVersion !== 1) {
      errors.push(`${prefix} schemaVersion은 1이어야 합니다.`);
    }
    if (!baseRestaurant) {
      errors.push(`${prefix} 원본 555개 목록에 없는 restaurantId입니다.`);
      continue;
    }
    if (seenIds.has(record.restaurantId)) {
      errors.push(`${prefix} restaurantId가 중복되었습니다.`);
    }
    seenIds.add(record.restaurantId);

    if (record.restaurantName !== baseRestaurant.name) {
      errors.push(`${prefix} restaurantName이 원본 이름과 다릅니다.`);
    }
    if (record.address !== baseRestaurant.address) {
      errors.push(`${prefix} address가 원본 주소와 다릅니다.`);
    }
    if (!allowedStatuses.has(record.status)) {
      errors.push(`${prefix} 알 수 없는 status입니다.`);
    }

    if (record.status !== "verified") continue;

    if (!record.representativeMenu?.trim()) {
      errors.push(`${prefix} verified 항목에는 대표 메뉴가 필요합니다.`);
    }
    if (!Array.isArray(record.menus) || record.menus.length === 0) {
      errors.push(`${prefix} verified 항목에는 메뉴가 1개 이상 필요합니다.`);
      continue;
    }
    if (!Array.isArray(record.sources) || record.sources.length < 2) {
      errors.push(`${prefix} verified 항목에는 독립 출처가 2개 이상 필요합니다.`);
      continue;
    }

    const sourceIds = new Set(record.sources.map((source) => source.id));
    for (const [index, menu] of record.menus.entries()) {
      const menuPrefix = `${prefix} menus[${index}]`;
      if (!menu.name?.trim() || !menu.price?.trim()) {
        errors.push(`${menuPrefix}에 메뉴명과 가격이 모두 필요합니다.`);
      }
      if (
        !Number.isFinite(menu.confidence) ||
        menu.confidence < 0 ||
        menu.confidence > 100
      ) {
        errors.push(`${menuPrefix}의 confidence는 0~100이어야 합니다.`);
      }
      if (
        !Array.isArray(menu.evidenceSourceIds) ||
        menu.evidenceSourceIds.length === 0 ||
        menu.evidenceSourceIds.some((sourceId) => !sourceIds.has(sourceId))
      ) {
        errors.push(`${menuPrefix}의 출처 연결이 올바르지 않습니다.`);
      }
    }
  }

  return errors;
}

function printErrors(errors) {
  if (errors.length === 0) return;
  console.error("수집 데이터 검증에 실패했습니다:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
}

function isPublishableMenu(menu) {
  return (
    menu.confidence >= 65 &&
    /^\d{1,3}(?:,\d{3})*원$/.test(menu.price?.trim() ?? "") &&
    Array.isArray(menu.evidenceSourceIds) &&
    menu.evidenceSourceIds.length >= 1
  );
}

function getPublishableMenus(record) {
  if (!Array.isArray(record.menus)) return [];
  if (record.status === "verified") return record.menus;
  if (record.status !== "needs-review") return [];
  return record.menus.filter((menu) => isPublishableMenu(menu));
}

function isPublishableRecord(record) {
  return getPublishableMenus(record).length > 0;
}

function runStatus() {
  const baseDataset = readBaseDataset();
  const entries = readResearchRecords();
  const errors = validateRecords(baseDataset, entries);
  const counts = Object.fromEntries(
    [...allowedStatuses].map((status) => [status, 0])
  );

  let menuCount = 0;
  let publishableCount = 0;
  let publishableMenuCount = 0;
  for (const { record } of entries) {
    if (counts[record.status] !== undefined) counts[record.status] += 1;
    if (record.status === "verified") menuCount += record.menus?.length ?? 0;
    if (isPublishableRecord(record)) {
      publishableCount += 1;
      publishableMenuCount += getPublishableMenus(record).length;
    }
  }

  console.log(`원본 식당: ${baseDataset.restaurants.length}곳`);
  console.log(`조사 시작: ${entries.length}곳`);
  console.log(`검증 완료: ${counts.verified}곳 / 메뉴 ${menuCount}개`);
  console.log(`재검토: ${counts["needs-review"]}곳`);
  console.log(`폐업 확인: ${counts.closed}곳`);
  console.log(`정보 없음: ${counts["not-found"]}곳`);
  console.log(`미조사: ${baseDataset.restaurants.length - entries.length}곳`);
  console.log(
    `앱 반영 가능: ${publishableCount}곳 / 메뉴 ${publishableMenuCount}개 (교차검증 + 충돌 없는 단일 출처)`
  );

  printErrors(errors);
}

function readLimit() {
  const limitIndex = process.argv.indexOf("--limit");
  if (limitIndex === -1) return 20;
  const limit = Number.parseInt(process.argv[limitIndex + 1], 10);
  return Number.isFinite(limit) && limit > 0 ? limit : 20;
}

function runNext() {
  const baseDataset = readBaseDataset();
  const researchedIds = new Set(
    readResearchRecords().map(({ record }) => record.restaurantId)
  );
  const pending = baseDataset.restaurants
    .filter((restaurant) => !researchedIds.has(restaurant.id))
    .slice(0, readLimit());

  if (pending.length === 0) {
    console.log("미조사 식당이 없습니다.");
    return;
  }

  for (const restaurant of pending) {
    console.log(
      `${restaurant.id}\t${restaurant.name}\t${restaurant.address}\t${restaurant.category}`
    );
  }
}

function runApply() {
  const baseDataset = readBaseDataset();
  const entries = readResearchRecords();
  const errors = validateRecords(baseDataset, entries);
  if (errors.length > 0) {
    printErrors(errors);
    return;
  }

  const baseById = new Map(
    baseDataset.restaurants.map((restaurant) => [restaurant.id, restaurant])
  );
  const restaurants = entries
    .filter(({ record }) => isPublishableRecord(record))
    .map(({ record }) => {
      const baseRestaurant = baseById.get(record.restaurantId);
      const publishableMenus = getPublishableMenus(record);
      const representativeMenu =
        publishableMenus.find(
          (menu) => menu.name.trim() === record.representativeMenu?.trim()
        )?.name ??
        publishableMenus.find((menu) => menu.isSignature)?.name ??
        publishableMenus[0].name;
      return {
        ...baseRestaurant,
        representativeMenu: representativeMenu.trim(),
        menus: publishableMenus.map((menu, index) => ({
          id: `${record.restaurantId}_researched_menu_${String(index + 1).padStart(2, "0")}`,
          name: menu.name.trim(),
          price: menu.price.trim(),
          isSignature: Boolean(menu.isSignature),
        })),
      };
    });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    `${JSON.stringify({ restaurants, sources: [], sourceLinks: [] }, null, 2)}\n`,
    "utf8"
  );
  console.log(`앱 반영 파일 생성: ${restaurants.length}곳 -> ${outputPath}`);
}

const command = process.argv[2] ?? "status";
if (command === "status") runStatus();
else if (command === "next") runNext();
else if (command === "apply") runApply();
else {
  console.error(
    "사용법: node scripts/wednesday-menu-research.mjs <status|next|apply> [--limit N]"
  );
  process.exitCode = 1;
}
