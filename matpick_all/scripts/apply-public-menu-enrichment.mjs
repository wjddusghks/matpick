import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(projectRoot, "..");
const topicEnrichmentRoot = path.join(
  projectRoot,
  "client",
  "src",
  "data",
  "generated",
  "topic-enrichments"
);

const datasetFiles = {
  ttoganjip: ["ttoganjip.enriched.json"],
  "baekjong-wok": ["baekjong-wok.enriched.json"],
  "old-korean-100": ["old-korean-100.enriched.json"],
  "popular-restaurants": ["popular-restaurants.enriched.json"],
  "michelin-3-stars": ["michelin-3-stars.enriched.json"],
  "michelin-2-stars": ["michelin-2-stars.enriched.json"],
  "michelin-1-star": ["michelin-1-star.enriched.json"],
  "michelin-bib-gourmand": ["michelin-bib-gourmand.enriched.json"],
  "michelin-selected": ["michelin-selected.enriched.json"],
};

function getDatasetId() {
  const index = process.argv.indexOf("--dataset");
  const datasetId = index >= 0 ? process.argv[index + 1] : "";
  if (!datasetFiles[datasetId]) {
    throw new Error(`Use --dataset with one of: ${Object.keys(datasetFiles).join(", ")}`);
  }
  return datasetId;
}

function normalizeMenus(restaurantId, menus) {
  return (Array.isArray(menus) ? menus : [])
    .map((menu) => ({
      name: String(menu?.name ?? "").trim(),
      price: String(menu?.price ?? "").trim(),
      description: String(menu?.description ?? "").trim(),
      isSignature: Boolean(menu?.isSignature),
      sourceOrdinal: Number(menu?.sourceOrdinal) || undefined,
    }))
    .filter((menu) => menu.name && menu.price)
    .map((menu, index) => ({
      id: `${restaurantId}_menu_${String(index + 1).padStart(3, "0")}`,
      name: menu.name,
      price: menu.price,
      ...(menu.description ? { description: menu.description } : {}),
      isSignature: menu.isSignature || index === 0,
      sourceOrdinal: menu.sourceOrdinal || index + 1,
    }));
}

function normalizeSources(record, placeUrl) {
  const sources = (Array.isArray(record?.sources) ? record.sources : [])
    .map((source) => ({
      url: String(source?.url ?? "").trim(),
      label: String(source?.label ?? "").trim(),
    }))
    .filter((source) => source.url && source.label);

  if (sources.length > 0) return sources;
  if (!placeUrl) return [];
  return [
    {
      url: placeUrl,
      label: String(record?.sourceLabel ?? "공개 메뉴").trim(),
    },
  ];
}

function getRegion(address) {
  return String(address ?? "").trim().split(/\s+/).slice(0, 2).join(" ");
}

async function readJson(filePath) {
  return JSON.parse((await fs.readFile(filePath, "utf8")).replace(/^\uFEFF/, ""));
}

async function readOptionalJson(filePath, fallback) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function main() {
  const datasetId = getDatasetId();
  const researchPath = path.join(
    workspaceRoot,
    "source-data",
    datasetId,
    "menu-prices.json"
  );
  const research = await readJson(researchPath);
  const overridePayload = await readOptionalJson(
    path.join(
      workspaceRoot,
      "source-data",
      "menu-enrichment",
      "public-menu-overrides.json"
    ),
    { restaurants: {} }
  );
  const applicableOverrides = Object.fromEntries(
    Object.entries(overridePayload.restaurants ?? {}).filter(
      ([, record]) => record.datasetId === datasetId
    )
  );
  const records = {
    ...(research.restaurants ?? {}),
    ...applicableOverrides,
  };
  let updatedRestaurantCount = 0;
  let updatedMenuCount = 0;

  for (const fileName of datasetFiles[datasetId]) {
    const filePath = path.join(topicEnrichmentRoot, fileName);
    const payload = await readJson(filePath);
    let fileChanged = false;

    payload.restaurants = (payload.restaurants ?? []).map((restaurant) => {
      const record = records[restaurant.id];
      const menus = normalizeMenus(restaurant.id, record?.menus);
      const status = String(record?.status ?? "").trim();
      const resolvedWithoutMenus = new Set([
        "closed_confirmed",
        "closed_likely",
        "operation_unverified",
        "not_single_restaurant",
      ]).has(status);
      if (menus.length === 0 && !resolvedWithoutMenus) return restaurant;

      fileChanged = true;
      updatedRestaurantCount += 1;
      updatedMenuCount += menus.length;
      const placeUrl = String(record.placeUrl ?? "").trim();
      const verifiedAt = String(record.verifiedAt ?? research.collectedAt ?? "").trim();
      const menuPriceSources = normalizeSources(record, placeUrl);

      return {
        ...restaurant,
        name: String(record.name ?? restaurant.name).trim() || restaurant.name,
        region: record.address ? getRegion(record.address) : restaurant.region,
        address: String(record.address ?? restaurant.address).trim() || restaurant.address,
        lat: Number.isFinite(record.currentLat) ? record.currentLat : restaurant.lat,
        lng: Number.isFinite(record.currentLng) ? record.currentLng : restaurant.lng,
        representativeMenu:
          String(record.representativeMenu ?? "").trim() ||
          menus[0]?.name ||
          restaurant.representativeMenu,
        menus,
        kakaoPlaceId: record.kakaoPlaceId
          ? String(record.kakaoPlaceId)
          : record.sourceLabel
            ? undefined
            : restaurant.kakaoPlaceId,
        ...(placeUrl ? { placeUrl } : {}),
        phone: record.phone
          ? String(record.phone)
          : record.sourceLabel
            ? undefined
            : restaurant.phone,
        operationStatus: record.operationStatus
          ? String(record.operationStatus)
          : record.sourceLabel
            ? undefined
            : restaurant.operationStatus,
        ...(record.operationSummary
          ? { operationSummary: String(record.operationSummary) }
          : {}),
        menuPriceStatus: status || "matched_with_priced_menu",
        ...(verifiedAt ? { menuPriceVerifiedAt: verifiedAt } : {}),
        ...(record.note ? { menuPriceNote: String(record.note) } : {}),
        ...(menuPriceSources.length ? { menuPriceSources } : {}),
      };
    });

    if (fileChanged) {
      payload.generatedAt = new Date().toISOString();
      await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    }
  }

  console.log(
    `${datasetId}: updated ${updatedRestaurantCount} restaurants with ${updatedMenuCount} priced menus.`
  );
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
