import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const inputPath = path.join(root, "source-data", "culinary-class-wars", "restaurants.json");
const outputPath = path.join(root, "source-data", "culinary-class-wars", "naver-place-details.json");
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function extractPlaceId(value = "") {
  return String(value).match(/(?:entry\/place|restaurant|place)\/(\d{5,})/i)?.[1] ?? null;
}

async function fetchSummary(placeId) {
  const response = await fetch(`https://map.naver.com/p/api/place/summary/${placeId}`, {
    headers: { Accept: "application/json", Referer: "https://map.naver.com/", "User-Agent": "Mozilla/5.0" },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const place = (await response.json())?.data?.placeDetail;
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
    placeUrl: `https://map.naver.com/p/entry/place/${place.id}`,
  };
}

async function main() {
  const records = JSON.parse(await readFile(inputPath, "utf8"));
  const targets = records.filter((record) => {
    const placeId = extractPlaceId(record.listingUrl);
    return placeId && (!record.kakaoPlaceId || !(record.menus?.length));
  });
  const details = new Map();
  const errors = [];
  for (const [index, record] of targets.entries()) {
    const placeId = extractPlaceId(record.listingUrl);
    if (!details.has(placeId)) {
      try {
        details.set(placeId, await fetchSummary(placeId));
      } catch (error) {
        errors.push({ id: record.id, placeId, error: error instanceof Error ? error.message : String(error) });
      }
      await sleep(45);
    }
    console.log(`${index + 1}/${targets.length} ${record.restaurantName} -> ${details.get(placeId)?.name ?? "error"}`);
  }

  const updated = records.map((record) => {
    const placeId = extractPlaceId(record.listingUrl);
    const detail = placeId ? details.get(placeId) : null;
    if (!detail) return record;
    const aliases = Array.from(new Set([...(record.aliases ?? []), detail.name].filter((name) => name && name !== record.restaurantName)));
    return {
      ...record,
      aliases,
      naverPlaceId: detail.naverPlaceId,
      naverPlaceName: detail.name,
      naverPlaceUrl: detail.placeUrl,
      address: detail.address || record.address,
      region: detail.region || record.region,
      lat: detail.lat,
      lng: detail.lng,
      notes: [record.notes, `네이버 장소 ID ${detail.naverPlaceId}의 상호·주소·좌표 확인`].filter(Boolean).join(" / "),
    };
  });
  await writeFile(inputPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  await writeFile(outputPath, `${JSON.stringify({
    source: "Naver Map public place summary",
    collectedAt: new Date().toISOString(),
    resolvedPlaceCount: details.size,
    errors,
    places: [...details.values()],
  }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ targetCount: targets.length, resolvedPlaceCount: details.size, errorCount: errors.length }, null, 2));
}

await main();
