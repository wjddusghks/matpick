import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { generatedDataRoot, workspaceRoot } from "./source-dataset-paths.mjs";

const menuResultsRoot = path.join(
  workspaceRoot,
  "Menu-Automation",
  "workspace",
  "standardized-results"
);
const googleResultsPath = path.join(
  workspaceRoot,
  "Menu-Automation",
  "workspace",
  "google-places",
  "places-full-results-20260321.json"
);
const topicEnrichmentRoot = path.join(generatedDataRoot, "topic-enrichments");

const menuResultFiles = {
  ttoganjip: "ttoganjip.results.json",
  "delicious-guys": "delicious-guys.results.json",
  "baekban-trip": "baekban-trip.results.json",
  "baekjong-wok": "baekjong-wok.results.json",
  "wednesday-gourmet": "wednesday-gourmet.results.json",
  "old-korean-100": "old-korean-100.parallel.b3.results.json",
};

const workbookDatasetMatchers = [
  { datasetId: "ttoganjip", keyword: "또간집" },
  { datasetId: "delicious-guys", keyword: "맛있는녀석들" },
  { datasetId: "baekban-trip", keyword: "백반기행" },
  { datasetId: "baekjong-wok", keyword: "3대천왕" },
  { datasetId: "wednesday-gourmet", keyword: "수요미식회" },
  { datasetId: "old-korean-100", keyword: "100선" },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeLookupValue(value) {
  return normalizeText(value).toLowerCase();
}

function buildLookupKey(name, address) {
  return `${normalizeLookupValue(name)}|${normalizeLookupValue(address)}`;
}

function buildRestaurantId(datasetId, name, address) {
  const digest = crypto
    .createHash("sha1")
    .update(`${datasetId}|${normalizeLookupValue(name)}|${normalizeLookupValue(address)}`)
    .digest("hex")
    .slice(0, 12);
  return `topic_enrichment_${datasetId}_${digest}`;
}

function getRegionFromAddress(address) {
  const tokens = normalizeText(address).split(" ").filter(Boolean);
  if (tokens.length >= 2) {
    return `${tokens[0]} ${tokens[1]}`;
  }
  return tokens[0] ?? "";
}

function isValidCoord(value) {
  return Number.isFinite(value) && value !== 0;
}

function createBaseRestaurant(datasetId, name, address) {
  return {
    id: buildRestaurantId(datasetId, name, address),
    name: normalizeText(name),
    region: getRegionFromAddress(address),
    address: normalizeText(address),
    category: "",
    representativeMenu: "",
    lat: 0,
    lng: 0,
    imageUrl: "",
    foundingYear: null,
    menus: [],
    thumbnailFileName: null,
    googlePlaceId: null,
    isOverseas: false,
  };
}

function mergeMenus(currentMenus = [], nextMenus = []) {
  const mergedMenus = new Map();

  [...currentMenus, ...nextMenus].forEach((menu, index) => {
    const name = normalizeText(menu?.name);
    const price = normalizeText(menu?.price);
    if (!name) return;

    const key = `${name.toLowerCase()}|${price}`;
    const existing = mergedMenus.get(key);
    if (!existing) {
      mergedMenus.set(key, {
        id: menu?.id || `menu_${index + 1}`,
        name,
        price: price || undefined,
        isSignature: Boolean(menu?.isSignature),
      });
      return;
    }

    mergedMenus.set(key, {
      ...existing,
      isSignature: existing.isSignature || Boolean(menu?.isSignature),
      price: existing.price || price || undefined,
    });
  });

  return Array.from(mergedMenus.values());
}

function mergeRestaurant(current, next) {
  return {
    ...current,
    ...next,
    name: normalizeText(next.name) || current.name,
    region: normalizeText(next.region) || current.region,
    address: normalizeText(next.address) || current.address,
    category: normalizeText(next.category) || current.category,
    representativeMenu:
      normalizeText(next.representativeMenu) || current.representativeMenu,
    lat: isValidCoord(next.lat) ? next.lat : current.lat,
    lng: isValidCoord(next.lng) ? next.lng : current.lng,
    imageUrl: current.imageUrl || next.imageUrl || "",
    menus: mergeMenus(current.menus, next.menus),
    thumbnailFileName: current.thumbnailFileName ?? next.thumbnailFileName ?? null,
    googlePlaceId: current.googlePlaceId ?? next.googlePlaceId ?? null,
    isOverseas: current.isOverseas ?? next.isOverseas ?? false,
    foundingYear: current.foundingYear ?? next.foundingYear ?? null,
  };
}

function detectDatasetIdFromWorkbook(sourceWorkbook) {
  const fileName = path.basename(sourceWorkbook);
  return (
    workbookDatasetMatchers.find((item) => fileName.includes(item.keyword))?.datasetId ?? null
  );
}

function isReliableGoogleMatch(match) {
  if (!match?.candidatePlaceId) return false;

  const overall = Number(match.overallScore ?? 0);
  const nameScore = Number(match.nameScore ?? 0);
  const addressScore = Number(match.addressScore ?? 0);

  return (
    overall >= 0.75 ||
    (addressScore >= 0.9 && nameScore >= 0.25) ||
    (nameScore >= 0.9 && addressScore >= 0.4)
  );
}

function buildRestaurantFromMenuItem(datasetId, item) {
  const restaurant = createBaseRestaurant(datasetId, item.restaurantName, item.address);
  return mergeRestaurant(restaurant, {
    ...restaurant,
    category:
      normalizeText(item.candidateCategory) ||
      normalizeText(item.originalCategory) ||
      restaurant.category,
    representativeMenu:
      normalizeText(item.representativeMenu) ||
      normalizeText(item.featuredMenu) ||
      restaurant.representativeMenu,
    menus: (item.menus || []).map((menu, index) => ({
      id: `${restaurant.id}_menu_${index + 1}`,
      name: normalizeText(menu.name),
      price: normalizeText(menu.priceText || menu.price),
      isSignature: index === 0,
    })),
    googlePlaceId: normalizeText(item.googlePlaceId) || null,
  });
}

function buildRestaurantPatchFromGoogle(datasetId, result) {
  const restaurant = createBaseRestaurant(datasetId, result.restaurantName, result.address);
  const bestMatch = result.bestMatch || {};
  const location = bestMatch.location || {};

  return mergeRestaurant(restaurant, {
    ...restaurant,
    lat: Number(location.latitude || 0),
    lng: Number(location.longitude || 0),
    googlePlaceId: normalizeText(bestMatch.candidatePlaceId) || null,
  });
}

function loadMenuEnrichments() {
  const datasetMap = new Map();

  for (const [datasetId, fileName] of Object.entries(menuResultFiles)) {
    const filePath = path.join(menuResultsRoot, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const payload = readJson(filePath);
    const restaurants = new Map();
    for (const item of payload.items || []) {
      const key = buildLookupKey(item.restaurantName, item.address);
      const nextRestaurant = buildRestaurantFromMenuItem(datasetId, item);
      const currentRestaurant = restaurants.get(key);
      restaurants.set(
        key,
        currentRestaurant ? mergeRestaurant(currentRestaurant, nextRestaurant) : nextRestaurant
      );
    }

    datasetMap.set(datasetId, restaurants);
  }

  return datasetMap;
}

function mergeGoogleEnrichments(datasetMap) {
  const payload = readJson(googleResultsPath);

  for (const result of payload.results || []) {
    const datasetId = detectDatasetIdFromWorkbook(result.sourceWorkbook);
    if (!datasetId) continue;
    if (!isReliableGoogleMatch(result.bestMatch)) continue;

    const key = buildLookupKey(result.restaurantName, result.address);
    const restaurants = datasetMap.get(datasetId) ?? new Map();
    const nextRestaurant = buildRestaurantPatchFromGoogle(datasetId, result);
    const currentRestaurant = restaurants.get(key);
    restaurants.set(
      key,
      currentRestaurant ? mergeRestaurant(currentRestaurant, nextRestaurant) : nextRestaurant
    );
    datasetMap.set(datasetId, restaurants);
  }

  return datasetMap;
}

function writeTopicOutputs(datasetMap) {
  for (const [datasetId, restaurants] of datasetMap.entries()) {
    const outputPath = path.join(topicEnrichmentRoot, `${datasetId}.enriched.json`);
    writeJson(outputPath, {
      datasetId,
      generatedAt: new Date().toISOString(),
      restaurants: Array.from(restaurants.values()).sort((left, right) =>
        left.name.localeCompare(right.name, "ko")
      ),
    });
  }
}

function main() {
  const datasetMap = loadMenuEnrichments();
  mergeGoogleEnrichments(datasetMap);
  writeTopicOutputs(datasetMap);

  const summary = Array.from(datasetMap.entries()).map(([datasetId, restaurants]) => ({
    datasetId,
    restaurants: restaurants.size,
  }));

  console.log(JSON.stringify({ outputDir: topicEnrichmentRoot, datasets: summary }, null, 2));
}

main();
