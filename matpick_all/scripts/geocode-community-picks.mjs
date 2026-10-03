import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  chooseCoordinate,
  cleanAddress,
  lookup as lookupKakao,
  sameGeocodeAddress,
  sleep,
} from "../../scripts/coordinate-audit.mjs";
import {
  nameKeys,
  normalizeName,
} from "../../scripts/topic-publication/identity.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const workspaceRoot = path.resolve(projectRoot, "..");
const sourceDataRoot = path.join(workspaceRoot, "source-data");
const sourceDir = path.join(sourceDataRoot, "community-picks");
const inputPaths = [
  path.join(sourceDir, "workbook-normalized.json"),
  path.join(sourceDir, "naver-normalized.json"),
];
const reportPath = path.join(projectRoot, "reports", "community-picks-import.json");
const coordinatesPath = path.join(sourceDir, "coordinates.json");
const cachePath = path.join(sourceDir, "geocode-cache.ndjson");
const lookupReportPath = path.join(sourceDir, "geocode-report.json");

const readJson = async (filename, fallback) => {
  try {
    return JSON.parse(await readFile(filename, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT" && fallback !== undefined) return fallback;
    throw error;
  }
};

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();

function namesCompatible(left, right, address) {
  const leftKeys = nameKeys(left, address);
  const rightKeys = nameKeys(right, address);
  if (leftKeys.some((key) => rightKeys.includes(key))) return true;
  return leftKeys.some((leftKey) =>
    rightKeys.some((rightKey) => {
      const shorter = Math.min(leftKey.length, rightKey.length);
      const longer = Math.max(leftKey.length, rightKey.length);
      return (
        shorter >= 3 &&
        shorter / longer >= 0.65 &&
        (leftKey.includes(rightKey) || rightKey.includes(leftKey))
      );
    }),
  );
}

async function fetchNaverPlace(placeId) {
  const response = await fetch(
    `https://map.naver.com/p/api/place/summary/${encodeURIComponent(placeId)}`,
    {
      headers: {
        Accept: "application/json",
        Referer: "https://map.naver.com/",
        "User-Agent": "Mozilla/5.0",
      },
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const place = (await response.json())?.data?.placeDetail;
  if (!place?.id || !place?.name) throw new Error("empty place summary");
  return {
    placeId: String(place.id),
    name: normalizeText(place.name),
    address: normalizeText(
      place.address?.roadAddress || place.address?.address || "",
    ),
    parcelAddress: normalizeText(place.address?.address),
    lat: Number(place.coordinate?.latitude) || 0,
    lng: Number(place.coordinate?.longitude) || 0,
    sourceUrl: `https://map.naver.com/p/entry/place/${place.id}`,
  };
}

async function loadExistingKakaoCaches() {
  const byQuery = new Map();
  const directories = await readdir(sourceDataRoot, {
    recursive: true,
    withFileTypes: true,
  });
  const cacheFiles = directories
    .filter(
      (entry) =>
        entry.isFile() &&
        /(?:geocode|coordinate).*(?:cache).*\.ndjson$/i.test(entry.name),
    )
    .map((entry) => path.join(entry.parentPath || entry.path, entry.name));
  cacheFiles.push(cachePath);
  for (const filename of new Set(cacheFiles)) {
    try {
      const lines = (await readFile(filename, "utf8")).split("\n").filter(Boolean);
      for (const line of lines) {
        const value = JSON.parse(line);
        if (value.query && !value.error) byQuery.set(value.query, value);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return byQuery;
}

function coordinateEntry(row, result, method) {
  return {
    sourceEntryId: row.sourceEntryId,
    name: row.name,
    address: row.address,
    naverPlaceId: row.naverPlaceId || null,
    lat: result.lat,
    lng: result.lng,
    method,
    matchedName: result.name || row.name,
    matchedAddress: result.address || result.roadAddress || row.address,
    sourceUrl: result.sourceUrl || result.url,
    checkedAt: "2026-10-03",
  };
}

const [inputs, report, existingCoordinates] = await Promise.all([
  Promise.all(inputPaths.map((filename) => readJson(filename))),
  readJson(reportPath),
  readJson(coordinatesPath, []),
]);
const rows = inputs.flatMap((input) => input.restaurants || input.entries || input);
const rowByEntryId = new Map(rows.map((row) => [row.sourceEntryId, row]));
const pendingEntryIds = new Set(
  (report.pending || []).flatMap((item) => item.sourceEntryIds),
);
const targets = [...pendingEntryIds]
  .map((entryId) => rowByEntryId.get(entryId))
  .filter(
    (row) =>
      row &&
      !row.blockNewReason &&
      row.address &&
      !(Number(row.lat) && Number(row.lng)),
  );
const coordinateMap = new Map(
  existingCoordinates.map((entry) => [entry.sourceEntryId, entry]),
);
const naverCache = new Map();
const errors = [];

let next = 0;
async function naverWorker() {
  while (next < targets.length) {
    const row = targets[next++];
    if (coordinateMap.has(row.sourceEntryId) || !row.naverPlaceId) continue;
    let place = naverCache.get(row.naverPlaceId);
    if (!place) {
      try {
        place = await fetchNaverPlace(row.naverPlaceId);
        naverCache.set(row.naverPlaceId, place);
      } catch (error) {
        errors.push({
          sourceEntryId: row.sourceEntryId,
          stage: "naver_place_summary",
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
      await sleep(60);
    }
    if (
      place.lat &&
      place.lng &&
      namesCompatible(row.name, place.name, row.address) &&
      [place.address, place.parcelAddress].some((address) =>
        sameGeocodeAddress(row.address, address),
      )
    ) {
      coordinateMap.set(
        row.sourceEntryId,
        coordinateEntry(row, place, "naver_place_summary_same_name_address"),
      );
    }
  }
}
await Promise.all(Array.from({ length: 6 }, () => naverWorker()));

const kakaoCache = await loadExistingKakaoCaches();
const unresolved = targets.filter((row) => !coordinateMap.has(row.sourceEntryId));
next = 0;
async function kakaoWorker() {
  while (next < unresolved.length) {
    const row = unresolved[next++];
    const query = cleanAddress(row.address);
    let result = kakaoCache.get(query);
    if (!result) {
      try {
        result = await lookupKakao(query);
        kakaoCache.set(query, result);
        await appendFile(cachePath, `${JSON.stringify(result)}\n`);
      } catch (error) {
        errors.push({
          sourceEntryId: row.sourceEntryId,
          stage: "kakao_address_search",
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
      await sleep(300);
    }
    const selected = chooseCoordinate(row, result);
    if (selected.candidate) {
      const candidate = selected.candidate;
      coordinateMap.set(
        row.sourceEntryId,
        coordinateEntry(
          row,
          {
            ...candidate,
            address:
              candidate.roadAddress || candidate.address || candidate.parcelAddress,
            sourceUrl: candidate.url || result.url,
          },
          selected.basis || "exact_address_geocode",
        ),
      );
    } else {
      errors.push({
        sourceEntryId: row.sourceEntryId,
        stage: "kakao_address_selection",
        status: selected.status,
      });
    }
  }
}
await mkdir(sourceDir, { recursive: true });
await Promise.all(Array.from({ length: 4 }, () => kakaoWorker()));

const coordinates = [...coordinateMap.values()].sort((left, right) =>
  left.sourceEntryId.localeCompare(right.sourceEntryId, "ko"),
);
const resolvedTargetIds = new Set(coordinates.map((entry) => entry.sourceEntryId));
const resultReport = {
  asOf: "2026-10-03",
  pendingTargets: targets.length,
  resolved: targets.filter((row) => resolvedTargetIds.has(row.sourceEntryId)).length,
  reusedCoordinates: existingCoordinates.length,
  naverPlaceSummaryResolved: coordinates.filter((entry) =>
    String(entry.method).startsWith("naver_place_summary"),
  ).length,
  kakaoResolved: coordinates.filter((entry) =>
    ["same_name_and_address_place", "exact_address_geocode"].includes(
      entry.method,
    ),
  ).length,
  unresolved: targets
    .filter((row) => !resolvedTargetIds.has(row.sourceEntryId))
    .map(({ sourceEntryId, name, address, naverPlaceId }) => ({
      sourceEntryId,
      name,
      address,
      naverPlaceId,
    })),
  errors,
};
await writeFile(coordinatesPath, `${JSON.stringify(coordinates, null, 2)}\n`);
await writeFile(lookupReportPath, `${JSON.stringify(resultReport, null, 2)}\n`);
console.log(JSON.stringify({ ...resultReport, errors: errors.length }, null, 2));
