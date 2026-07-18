import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const sourceRoot = path.join(root, "source-data", "jeonhyunmoo-plan");
const snapshotPath = path.join(sourceRoot, "naver-place-details.json");
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function extractPlaceId(value = "") {
  return String(value).match(/(?:entry\/place|restaurant|place)\/(\d{5,})/i)?.[1] ?? null;
}

async function resolveSourceUrl(value) {
  const original = String(value ?? "").trim();
  if (!original) return original;
  if (extractPlaceId(original)) return original;
  if (!/naver\.me|m\.site\.naver\.com/i.test(original)) return original;
  try {
    const response = await fetch(original, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const location = response.headers.get("location");
    return location ? new URL(location, original).toString() : original;
  } catch {
    return original;
  }
}

async function fetchSummary(placeId) {
  const url = `https://map.naver.com/p/api/place/summary/${placeId}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Referer: "https://map.naver.com/",
      "User-Agent": "Mozilla/5.0",
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const payload = await response.json();
  const place = payload?.data?.placeDetail;
  if (!place?.id || !place?.name) throw new Error("Naver place summary is empty");
  return {
    naverPlaceId: String(place.id),
    name: place.name,
    category: place.category?.category ?? "",
    address: place.address?.roadAddress || place.address?.address || "",
    parcelAddress: place.address?.address ?? "",
    region: place.address?.formattedAddress ?? "",
    lat: Number(place.coordinate?.latitude) || null,
    lng: Number(place.coordinate?.longitude) || null,
    representativePrice: place.reprPrice ?? null,
    bookingMenus: Array.isArray(place.naverBookingMenu) ? place.naverBookingMenu : [],
    placeUrl: `https://map.naver.com/p/entry/place/${place.id}`,
  };
}

function normalizeBookingMenus(items = []) {
  return items
    .map((item) => ({
      name: String(item?.name ?? item?.title ?? "").trim(),
      price: String(item?.price ?? "").trim() || null,
      isSignature: Boolean(item?.isRepresentative),
      sourceId: "naver-place-summary",
      observedAt: "2026-07-18",
      confidence: 0.9,
    }))
    .filter((item) => item.name);
}

async function main() {
  const detailById = new Map();
  const errors = [];
  const files = [1, 2, 3, 4].map((season) => ({
    season,
    path: path.join(sourceRoot, `season-${season}`, "restaurants.json"),
  }));
  const datasets = [];

  for (const file of files) {
    datasets.push({ ...file, records: JSON.parse(await readFile(file.path, "utf8")) });
  }

  const targets = datasets.flatMap(({ season, records }) =>
    records
      .filter((record) => season === 2 && record.sourceUrl)
      .map((record) => ({ season, record }))
  );

  for (const [index, { record }] of targets.entries()) {
    const resolvedUrl = await resolveSourceUrl(record.sourceUrl);
    const placeId = extractPlaceId(resolvedUrl);
    if (!placeId) continue;
    if (!detailById.has(placeId)) {
      try {
        detailById.set(placeId, await fetchSummary(placeId));
      } catch (error) {
        errors.push({ id: record.id, placeId, error: error instanceof Error ? error.message : String(error) });
      }
      await sleep(45);
    }
    const detail = detailById.get(placeId);
    if (detail) console.log(`${index + 1}/${targets.length} ${record.name} -> ${detail.name}`);
  }

  for (const dataset of datasets) {
    const updated = [];
    for (const record of dataset.records) {
      const resolvedUrl = await resolveSourceUrl(record.sourceUrl);
      const placeId = extractPlaceId(resolvedUrl);
      const detail = placeId ? detailById.get(placeId) : null;
      if (!detail) {
        updated.push(record);
        continue;
      }
      const oldName = String(record.name ?? "").trim();
      const aliases = Array.from(new Set([...(record.aliases ?? []), oldName].filter((name) => name && name !== detail.name)));
      const bookingMenus = normalizeBookingMenus(detail.bookingMenus);
      updated.push({
        ...record,
        name: detail.name,
        aliases,
        region: detail.region || record.region,
        address: detail.address || record.address,
        category: record.category || detail.category,
        lat: detail.lat,
        lng: detail.lng,
        naverPlaceId: detail.naverPlaceId,
        placeUrl: detail.placeUrl,
        menus: bookingMenus.length ? bookingMenus : record.menus,
        representativeMenu: bookingMenus[0]?.name || record.representativeMenu,
        confidence: Math.max(Number(record.confidence) || 0, 0.93),
        reviewStatus: "naver-place-resolved",
        notes: [record.notes, oldName !== detail.name ? `기존 설명형 상호 '${oldName}'를 네이버 장소 상호 '${detail.name}'로 교정` : ""]
          .filter(Boolean)
          .join(" / "),
      });
    }
    await writeFile(dataset.path, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  }

  const snapshot = {
    source: "Naver Map public place summary",
    collectedAt: new Date().toISOString(),
    resolvedPlaceCount: detailById.size,
    errors,
    places: [...detailById.values()],
  };
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ resolvedPlaceCount: detailById.size, errorCount: errors.length }, null, 2));
}

await main();
