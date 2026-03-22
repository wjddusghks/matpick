import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { generatedDataRoot, workspaceRoot } from "./source-dataset-paths.mjs";

const standardizedMenuResultsRoot = path.join(
  workspaceRoot,
  "Menu-Automation",
  "workspace",
  "standardized-results"
);
const standardizedGoogleResultsPath = path.join(
  workspaceRoot,
  "Menu-Automation",
  "workspace",
  "google-places",
  "places-full-results-20260321.json"
);
const michelinMenuResultsRoot = path.join(
  workspaceRoot,
  "Menu-Automation",
  "workspace",
  "michelin-results"
);
const michelinRawResultsRoot = path.join(
  workspaceRoot,
  "Menu-Automation",
  "workspace",
  "michelin"
);
const michelinGoogleResultsRoot = path.join(
  workspaceRoot,
  "Menu-Automation",
  "workspace",
  "google-places",
  "michelin"
);
const topicEnrichmentRoot = path.join(generatedDataRoot, "topic-enrichments");

const patchOnlyDatasetIds = new Set([
  "baekban-trip",
  "wednesday-gourmet",
  "old-korean-100",
]);

const menuResultFiles = {
  ttoganjip: path.join(standardizedMenuResultsRoot, "ttoganjip.results.json"),
  "delicious-guys": path.join(standardizedMenuResultsRoot, "delicious-guys.results.json"),
  "baekban-trip": path.join(standardizedMenuResultsRoot, "baekban-trip.results.json"),
  "baekjong-wok": path.join(standardizedMenuResultsRoot, "baekjong-wok.results.json"),
  "wednesday-gourmet": path.join(
    standardizedMenuResultsRoot,
    "wednesday-gourmet.results.json"
  ),
  "old-korean-100": path.join(
    standardizedMenuResultsRoot,
    "old-korean-100.parallel.b3.results.json"
  ),
  "michelin-3-stars": path.join(michelinMenuResultsRoot, "michelin-3-stars.results.json"),
  "michelin-2-stars": path.join(michelinMenuResultsRoot, "michelin-2-stars.results.json"),
  "michelin-1-star": path.join(michelinMenuResultsRoot, "michelin-1-star.results.json"),
  "michelin-bib-gourmand": path.join(
    michelinMenuResultsRoot,
    "michelin-bib-gourmand.results.json"
  ),
  "michelin-selected": path.join(michelinMenuResultsRoot, "michelin-selected.results.json"),
};

const michelinGoogleResultFiles = {
  "michelin-3-stars": path.join(michelinGoogleResultsRoot, "michelin-3-stars.places.json"),
  "michelin-2-stars": path.join(michelinGoogleResultsRoot, "michelin-2-stars.places.json"),
  "michelin-1-star": path.join(michelinGoogleResultsRoot, "michelin-1-star.places.json"),
  "michelin-bib-gourmand": path.join(
    michelinGoogleResultsRoot,
    "michelin-bib-gourmand.places.json"
  ),
  "michelin-selected": path.join(michelinGoogleResultsRoot, "michelin-selected.places.json"),
};

const michelinRawDatasetFiles = {
  "michelin-3-stars": path.join(michelinRawResultsRoot, "michelin-3-stars.json"),
  "michelin-2-stars": path.join(michelinRawResultsRoot, "michelin-2-stars.json"),
  "michelin-1-star": path.join(michelinRawResultsRoot, "michelin-1-star.json"),
  "michelin-bib-gourmand": path.join(michelinRawResultsRoot, "michelin-bib-gourmand.json"),
  "michelin-selected": path.join(michelinRawResultsRoot, "michelin-selected.json"),
};

const workbookDatasetMatchers = [
  { datasetId: "ttoganjip", keyword: "또간집" },
  { datasetId: "delicious-guys", keyword: "맛있는녀석들" },
  { datasetId: "baekban-trip", keyword: "백반기행" },
  { datasetId: "baekjong-wok", keyword: "3대천왕" },
  { datasetId: "wednesday-gourmet", keyword: "수요미식회" },
  { datasetId: "old-korean-100", keyword: "100선" },
];

const sourceMetadataByDatasetId = {
  ttoganjip: {
    id: "ttoganjip",
    name: "또간집",
    type: "creator",
    provider: "YouTube",
    creatorId: "UCrDMtdCSMTGVmUKvuhcahRw",
    description: "또간집에 소개된 맛집을 한 번에 모아봤어요.",
  },
  "delicious-guys": {
    id: "delicious-guys",
    name: "맛있는 녀석들",
    type: "tv_show",
    provider: "IHQ",
    creatorId: "UCT-eNSaIVbeFnMhOLPDBGhg",
    description: "맛있는 녀석들에 소개된 맛집을 한 번에 모아봤어요.",
  },
  "baekban-trip": {
    id: "sikgaek-baekban-trip",
    name: "식객 허영만의 백반기행",
    type: "tv_show",
    provider: "TV CHOSUN",
    description: "허영만의 백반기행에 소개된 맛집을 한 번에 모아봤어요.",
    imageUrl: "/source-covers/sikgaek-baekban-trip.jpg",
  },
  "wednesday-gourmet": {
    id: "wednesday-gourmet",
    name: "수요미식회",
    type: "tv_show",
    provider: "tvN",
    description: "수요미식회에 소개된 맛집을 한 번에 둘러볼 수 있어요.",
    imageUrl: "/source-covers/wednesday-gourmet.jpg",
  },
  "old-korean-100": {
    id: "old-korean-100",
    name: "한국인이 사랑하는 오래된 한식당 100선",
    type: "institution",
    provider: "한식진흥원",
    description: "한국인이 사랑하는 오래된 한식당 100선을 지역별로 둘러보세요.",
    imageUrl: "/source-covers/old-korean-100.jpg",
  },
  "baekjong-wok": {
    id: "baekjong-wok",
    name: "백종원의 3대천왕",
    type: "tv_show",
    provider: "SBS",
    description: "백종원의 3대천왕에 소개된 맛집을 한 번에 모아봤어요.",
  },
  "michelin-3-stars": {
    id: "michelin-3-stars",
    name: "미쉐린 3스타",
    type: "michelin",
    provider: "MICHELIN Guide",
    description: "미쉐린 3스타로 선정된 레스토랑을 모아봤어요.",
  },
  "michelin-2-stars": {
    id: "michelin-2-stars",
    name: "미쉐린 2스타",
    type: "michelin",
    provider: "MICHELIN Guide",
    description: "미쉐린 2스타로 선정된 레스토랑을 모아봤어요.",
  },
  "michelin-1-star": {
    id: "michelin-1-star",
    name: "미쉐린 1스타",
    type: "michelin",
    provider: "MICHELIN Guide",
    description: "미쉐린 1스타로 선정된 레스토랑을 모아봤어요.",
  },
  "michelin-bib-gourmand": {
    id: "michelin-bib-gourmand",
    name: "빕 구르망",
    type: "michelin",
    provider: "MICHELIN Guide",
    description: "빕 구르망으로 선정된 가성비 좋은 레스토랑을 모아봤어요.",
  },
  "michelin-selected": {
    id: "michelin-selected",
    name: "선정 레스토랑",
    type: "michelin",
    provider: "MICHELIN Guide",
    description: "미쉐린 선정 레스토랑을 한 번에 둘러볼 수 있어요.",
  },
};

const generatedDatasetFileByDatasetId = {
  "baekban-trip": path.join(generatedDataRoot, "sikgaek-baekban-trip.generated.json"),
  "wednesday-gourmet": path.join(generatedDataRoot, "wednesday-gourmet.generated.json"),
  "old-korean-100": path.join(generatedDataRoot, "old-korean-100.generated.json"),
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
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

function normalizeAddressForLookup(address) {
  return normalizeLookupValue(String(address ?? "").replace(/\([^)]*\)/g, " "));
}

function buildLookupNameCandidates(name, region = "", address = "") {
  const normalizedName = normalizeLookupValue(name);
  const candidates = new Set([normalizedName]);
  const addressTokens = normalizeLookupValue(`${region} ${address}`)
    .split(" ")
    .filter(Boolean);
  const removablePrefixes = new Set();

  if (addressTokens[0]) {
    removablePrefixes.add(addressTokens[0]);
  }
  if (addressTokens[1]) {
    removablePrefixes.add(`${addressTokens[0]} ${addressTokens[1]}`);
  }

  removablePrefixes.forEach((prefix) => {
    if (normalizedName.startsWith(`${prefix} `)) {
      const stripped = normalizedName.slice(prefix.length).trim();
      if (stripped) {
        candidates.add(stripped);
      }
    }
  });

  return Array.from(candidates);
}

function buildLookupKeys(name, address, region = "") {
  const normalizedAddress = normalizeAddressForLookup(address);
  return buildLookupNameCandidates(name, region, address).map(
    (candidate) => `${candidate}|${normalizedAddress}`
  );
}

function buildLookupKey(name, address, region = "") {
  return buildLookupKeys(name, address, region)[0];
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
    id: current.id,
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

function buildRestaurantFromMichelinItem(datasetId, item) {
  const restaurant = createBaseRestaurant(datasetId, item.restaurantName, item.address);
  return mergeRestaurant(restaurant, {
    ...restaurant,
    category: normalizeText(item.cuisine) || restaurant.category,
  });
}

function mergeMichelinBaseEnrichments(datasetMap) {
  for (const [datasetId, filePath] of Object.entries(michelinRawDatasetFiles)) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const payload = readJson(filePath);
    const restaurants = datasetMap.get(datasetId) ?? new Map();

    for (const item of payload.restaurants || []) {
      const key = buildLookupKey(item.restaurantName, item.address);
      const nextRestaurant = buildRestaurantFromMichelinItem(datasetId, item);
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

function mergeMenuEnrichments(datasetMap) {

  for (const [datasetId, filePath] of Object.entries(menuResultFiles)) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const payload = readJson(filePath);
    const restaurants = datasetMap.get(datasetId) ?? new Map();

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
  const payload = readJson(standardizedGoogleResultsPath);

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

function mergeMichelinGoogleEnrichments(datasetMap) {
  for (const [datasetId, filePath] of Object.entries(michelinGoogleResultFiles)) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const payload = readJson(filePath);

    for (const result of payload.results || []) {
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
  }

  return datasetMap;
}

function buildCanonicalPatchOutput(datasetId, restaurants) {
  const generatedPath = generatedDatasetFileByDatasetId[datasetId];
  if (!generatedPath || !fs.existsSync(generatedPath)) {
    return null;
  }

  const generatedPayload = readJson(generatedPath);
  const baseRestaurants = generatedPayload.restaurants || [];
  const patchRestaurants = Array.from(restaurants.values());
  const patchRestaurantByLookupKey = new Map();

  patchRestaurants.forEach((restaurant) => {
    buildLookupKeys(restaurant.name, restaurant.address, restaurant.region).forEach((lookupKey) => {
      patchRestaurantByLookupKey.set(lookupKey, restaurant);
    });
  });

  const mergedRestaurants = baseRestaurants.map((restaurant) => {
    const patch = buildLookupKeys(restaurant.name, restaurant.address, restaurant.region)
      .map((lookupKey) => patchRestaurantByLookupKey.get(lookupKey))
      .find(Boolean);

    if (!patch) {
      return restaurant;
    }

    return mergeRestaurant(restaurant, patch);
  });

  return {
    datasetId,
    generatedAt: new Date().toISOString(),
    restaurants: mergedRestaurants,
    sources: generatedPayload.sources ?? [],
    sourceLinks: generatedPayload.sourceLinks ?? [],
  };
}

function writeTopicOutputs(datasetMap) {
  for (const [datasetId, restaurants] of datasetMap.entries()) {
    const outputPath = path.join(topicEnrichmentRoot, `${datasetId}.enriched.json`);

    if (patchOnlyDatasetIds.has(datasetId)) {
      const canonicalPayload = buildCanonicalPatchOutput(datasetId, restaurants);
      if (canonicalPayload) {
        writeJson(outputPath, canonicalPayload);
        continue;
      }
    }

    const sourceMetadata = sourceMetadataByDatasetId[datasetId];
    const orderedRestaurants = Array.from(restaurants.values()).sort((left, right) =>
      left.name.localeCompare(right.name, "ko")
    );
    const sourceLinks = sourceMetadata
      ? orderedRestaurants.map((restaurant, index) => ({
          id: `${sourceMetadata.id}_${restaurant.id}`,
          restaurantId: restaurant.id,
          sourceId: sourceMetadata.id,
          ordinal: index + 1,
        }))
      : [];

    writeJson(outputPath, {
      datasetId,
      generatedAt: new Date().toISOString(),
      restaurants: orderedRestaurants,
      sources: sourceMetadata ? [sourceMetadata] : [],
      sourceLinks,
    });
  }
}

function main() {
  const datasetMap = new Map();
  mergeMichelinBaseEnrichments(datasetMap);
  mergeMenuEnrichments(datasetMap);
  mergeGoogleEnrichments(datasetMap);
  mergeMichelinGoogleEnrichments(datasetMap);
  writeTopicOutputs(datasetMap);

  const summary = Array.from(datasetMap.entries()).map(([datasetId, restaurants]) => ({
    datasetId,
    restaurants: restaurants.size,
  }));

  console.log(JSON.stringify({ outputDir: topicEnrichmentRoot, datasets: summary }, null, 2));
}

main();
