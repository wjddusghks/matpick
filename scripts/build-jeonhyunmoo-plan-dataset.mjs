import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const matpickRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(matpickRoot, "source-data", "jeonhyunmoo-plan");
const outputPath = path.join(
  matpickRoot,
  "matpick_all",
  "client",
  "src",
  "data",
  "generated",
  "jeonhyunmoo-plan.generated.json"
);

function normalize(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hash(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

async function readJson(filePath) {
  return JSON.parse((await readFile(filePath, "utf8")).replace(/^\uFEFF/, ""));
}

function restaurantKey(record) {
  return `${normalize(record.name).toLowerCase()}|${normalize(record.address).toLowerCase()}`;
}

function mergeMenus(records, restaurantId) {
  const result = [];
  const seen = new Set();

  for (const record of records) {
    for (const menu of record.menus ?? []) {
      const name = normalize(menu.name);
      const price = menu.price == null ? null : normalize(menu.price);
      const key = `${name.toLowerCase()}|${price ?? ""}`;
      if (!name || seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push({
        id: `${restaurantId}_menu_${result.length + 1}`,
        name,
        price,
        isSignature: Boolean(menu.isSignature),
      });
    }
  }

  return result;
}

function firstValue(records, key) {
  return records.map((record) => record[key]).find((value) => normalize(value));
}

function collectMenuSources(records) {
  const sources = new Map();
  for (const source of records.flatMap((record) => record.menuPriceSources ?? [])) {
    const url = normalize(source.url);
    if (url && !sources.has(url)) sources.set(url, source);
  }
  return [...sources.values()];
}

async function main() {
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  const seasonFolders = entries
    .filter((entry) => entry.isDirectory() && /^season-\d+$/.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  const occurrences = [];
  for (const folder of seasonFolders) {
    const records = await readJson(path.join(sourceRoot, folder.name, "restaurants.json"));
    occurrences.push(...records);
  }

  occurrences.sort(
    (a, b) =>
      a.season - b.season ||
      a.episode - b.episode ||
      a.restaurantRecordNo - b.restaurantRecordNo
  );

  const grouped = new Map();
  for (const occurrence of occurrences) {
    const key = restaurantKey(occurrence);
    const group = grouped.get(key) ?? [];
    group.push(occurrence);
    grouped.set(key, group);
  }

  const restaurants = [];
  const sourceLinks = [];

  let ordinal = 0;
  for (const [key, records] of grouped) {
    ordinal += 1;
    const first = records[0];
    const restaurantId = `jeonhyunmoo-plan_restaurant_${hash(key)}`;
    const labels = records.map((record) => `시즌 ${record.season} EP.${record.episode}`);
    const recordNumbers = records.map((record) => record.restaurantRecordNo);

    restaurants.push({
      id: restaurantId,
      name: normalize(first.name),
      region: normalize(first.region),
      address: normalize(first.address),
      category: normalize(first.category),
      representativeMenu: normalize(first.representativeMenu),
      lat: Number.isFinite(first.lat) ? first.lat : null,
      lng: Number.isFinite(first.lng) ? first.lng : null,
      imageUrl: "",
      foundingYear: null,
      menus: mergeMenus(records, restaurantId),
      thumbnailFileName: null,
      isOverseas: records.some((record) => Boolean(record.isOverseas)) ||
        /Hong Kong|Japan|Tokushima|香港|日本/i.test(normalize(first.address)),
      phone: normalize(firstValue(records, "phone")),
      kakaoPlaceId: normalize(firstValue(records, "kakaoPlaceId")) || null,
      placeUrl: normalize(firstValue(records, "placeUrl")),
      matchedPlaceName: normalize(firstValue(records, "matchedPlaceName")),
      menuPriceStatus: normalize(firstValue(records, "menuPriceStatus")),
      menuPriceVerifiedAt: normalize(firstValue(records, "menuPriceVerifiedAt")),
      menuPriceSources: collectMenuSources(records),
      evidence: records.map((record) => ({
        season: record.season,
        episode: record.episode,
        restaurantRecordNo: record.restaurantRecordNo,
        broadcastDate: record.broadcastDate,
        sourceUrl: record.sourceUrl,
        menuPriceSources: record.menuPriceSources,
        confidence: record.confidence,
        reviewStatus: record.reviewStatus,
      })),
    });

    sourceLinks.push({
      id: `jeonhyunmoo-plan_link_${hash(key)}`,
      restaurantId,
      sourceId: "jeonhyunmoo-plan",
      ordinal,
      label: labels.join(" · "),
      note: `MBN 맛집기록 No.${recordNumbers.join(", No.")}`,
      labels,
      occurrences: records.map((record) => ({
        season: record.season,
        episode: record.episode,
        restaurantRecordNo: record.restaurantRecordNo,
        broadcastDate: record.broadcastDate,
        sourceUrl: record.sourceUrl,
      })),
    });
  }

  const output = {
    restaurants,
    sources: [
      {
        id: "jeonhyunmoo-plan",
        name: "전현무계획",
        type: "tv_show",
        provider: "MBN",
        description: "전현무계획 시즌 1~4에 소개된 맛집을 모아봤어요.",
      },
    ],
    sourceLinks,
    occurrences,
    meta: {
      generatedAt: new Date().toISOString(),
      seasonFolders: seasonFolders.map((folder) => folder.name),
      appearanceCount: occurrences.length,
      uniqueRestaurantCount: restaurants.length,
    },
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Generated ${occurrences.length} appearances.`);
  console.log(`Generated ${restaurants.length} unique restaurants.`);
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
