import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  chooseCoordinate,
  cleanAddress,
  lookup as lookupKakao,
  sleep,
} from "../../scripts/coordinate-audit.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const sourceDir = path.resolve(projectRoot, "..", "source-data", "community-picks");
const inputPath = path.join(sourceDir, "naver-normalized.json");
const cachePath = path.join(sourceDir, "geocode-cache.ndjson");
const reportPath = path.join(sourceDir, "naver-coordinate-audit.json");
const MAX_DISTANCE_METERS = 200;

const input = JSON.parse(await readFile(inputPath, "utf8"));
const rows = (input.restaurants || input.entries || input).filter((row) =>
  row.address && Number(row.lat) && Number(row.lng) && !row.blockNewReason,
);
const cache = new Map();
try {
  for (const line of (await readFile(cachePath, "utf8")).split("\n").filter(Boolean)) {
    const value = JSON.parse(line);
    if (value.query && !value.error) cache.set(value.query, value);
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const radians = (value) => (value * Math.PI) / 180;
function distanceMeters(left, right) {
  const deltaLat = radians(right.lat - left.lat);
  const deltaLng = radians(right.lng - left.lng);
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(left.lat)) * Math.cos(radians(right.lat)) *
      Math.sin(deltaLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const results = [];
let next = 0;
async function worker() {
  while (next < rows.length) {
    const row = rows[next++];
    const query = cleanAddress(row.address);
    let response = cache.get(query);
    let cacheHit = true;
    if (!response) {
      cacheHit = false;
      try {
        response = await lookupKakao(query);
        cache.set(query, response);
        await appendFile(cachePath, `${JSON.stringify(response)}\n`);
        await sleep(200);
      } catch (error) {
        results.push({
          sourceEntryId: row.sourceEntryId,
          name: row.name,
          address: row.address,
          status: "lookup_error",
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }
    const selected = chooseCoordinate(row, response);
    if (!selected.candidate) {
      results.push({
        sourceEntryId: row.sourceEntryId,
        name: row.name,
        address: row.address,
        status: "unresolved_address",
        selectionStatus: selected.status,
        cacheHit,
      });
      continue;
    }
    const candidate = selected.candidate;
    const distance = distanceMeters(
      { lat: Number(row.lat), lng: Number(row.lng) },
      { lat: Number(candidate.lat), lng: Number(candidate.lng) },
    );
    results.push({
      sourceEntryId: row.sourceEntryId,
      name: row.name,
      address: row.address,
      status: distance > MAX_DISTANCE_METERS ? "coordinate_drift" : "aligned",
      distanceMeters: Math.round(distance),
      provided: { lat: Number(row.lat), lng: Number(row.lng) },
      geocoded: {
        lat: Number(candidate.lat),
        lng: Number(candidate.lng),
        address: candidate.roadAddress || candidate.address || candidate.parcelAddress,
      },
      basis: selected.basis,
      cacheHit,
    });
  }
}

await Promise.all(Array.from({ length: 4 }, () => worker()));
results.sort((left, right) =>
  left.sourceEntryId.localeCompare(right.sourceEntryId, "ko"),
);
const report = {
  asOf: "2026-10-03",
  thresholdMeters: MAX_DISTANCE_METERS,
  checked: rows.length,
  aligned: results.filter((row) => row.status === "aligned").length,
  coordinateDrift: results.filter((row) => row.status === "coordinate_drift").length,
  unresolved: results.filter((row) =>
    ["lookup_error", "unresolved_address"].includes(row.status),
  ).length,
  results,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
