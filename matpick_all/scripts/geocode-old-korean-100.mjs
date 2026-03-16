import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const sourceDir = path.resolve(projectRoot, "..", "source-data", "old-korean-100");
const generatedPath = path.join(
  projectRoot,
  "client",
  "src",
  "data",
  "generated",
  "old-korean-100.generated.json"
);
const coordinatesPath = path.join(sourceDir, "coordinates.json");
const geocodeEndpoint = "https://maps.apigw.ntruss.com/map-geocode/v2/geocode";

function normalize(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function makeLookupKey(name, address) {
  return `${normalize(name).toLowerCase()}|${normalize(address).toLowerCase()}`;
}

async function readJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch (error) {
    if (fallback !== undefined) {
      return fallback;
    }

    throw error;
  }
}

async function geocodeAddress(address, clientId, clientSecret) {
  const url = new URL(geocodeEndpoint);
  url.searchParams.set("query", address);

  const response = await fetch(url, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": clientId,
      "X-NCP-APIGW-API-KEY": clientSecret,
    },
  });

  if (!response.ok) {
    throw new Error(`Geocode request failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const first = payload?.addresses?.[0];
  if (!first) {
    return null;
  }

  const lat = Number(first.y);
  const lng = Number(first.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const clientId = process.env.NAVER_MAP_CLIENT_ID?.trim() || process.env.VITE_NAVER_MAP_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET?.trim() || "";

  if (!clientId || !clientSecret) {
    throw new Error(
      "NAVER_MAP_CLIENT_ID and NAVER_MAP_CLIENT_SECRET must be set to geocode coordinates."
    );
  }

  const generated = await readJson(generatedPath);
  const existingCoordinates = await readJson(coordinatesPath, []);
  const coordinateMap = new Map(
    existingCoordinates.map((entry) => [makeLookupKey(entry.name, entry.address), entry])
  );

  let resolvedCount = 0;

  for (const restaurant of generated.restaurants ?? []) {
    const key = makeLookupKey(restaurant.name, restaurant.address);
    const existing = coordinateMap.get(key);
    if (existing?.lat && existing?.lng) {
      restaurant.lat = existing.lat;
      restaurant.lng = existing.lng;
      continue;
    }

    if (!restaurant.address) {
      continue;
    }

    const coords = await geocodeAddress(restaurant.address, clientId, clientSecret);
    if (!coords) {
      continue;
    }

    const nextEntry = {
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
      lat: coords.lat,
      lng: coords.lng,
    };

    coordinateMap.set(key, nextEntry);
    restaurant.lat = coords.lat;
    restaurant.lng = coords.lng;
    resolvedCount += 1;

    await delay(120);
  }

  const nextCoordinates = Array.from(coordinateMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "ko-KR")
  );

  await writeFile(coordinatesPath, `${JSON.stringify(nextCoordinates, null, 2)}\n`, "utf8");
  await writeFile(generatedPath, `${JSON.stringify(generated, null, 2)}\n`, "utf8");

  console.log(`Saved ${nextCoordinates.length} coordinate entries.`);
  console.log(`Resolved ${resolvedCount} new restaurants.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
