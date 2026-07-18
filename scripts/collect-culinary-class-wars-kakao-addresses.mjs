import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "source-data", "culinary-class-wars");
const inputPath = path.join(sourceDir, "restaurants.json");
const outputPath = path.join(sourceDir, "kakao-address-candidates.json");
const endpoint = "https://search.map.kakao.com/mapsearch/map.daum";

const aliases = {
  SOIGNE: ["스와니예"],
  "BISTROT de YOUNTVILLE": ["비스트로 드 욘트빌", "비스트로드욘트빌"],
  "IMOK Smoke Dining": ["이목 스모크 다이닝", "이목 스모크다이닝"],
  "Original Numbers 청담": ["오리지널 넘버스 청담", "오리지널넘버스"],
  "소울 SOUL": ["소울 해방촌"],
  "코자차 kojacha": ["코자차 청담"],
  "호시우보 여의도본점(TP타워)": ["호시우보 여의도본점", "호시우보 TP타워"],
  "더이탈리안 클럽 판교 테크원점": ["더이탈리안클럽 판교테크원점"],
  "반찬가게 도시곳간": ["도시곳간 본점", "도시곳간"],
};

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function normalize(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, "앤드")
    .replace(/[()\[\]{}]/g, " ")
    .replace(/(?:본점|지점|점)$/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function bigramDice(left, right) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;
  const counts = new Map();
  for (let index = 0; index < left.length - 1; index += 1) {
    const gram = left.slice(index, index + 2);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  let overlap = 0;
  for (let index = 0; index < right.length - 1; index += 1) {
    const gram = right.slice(index, index + 2);
    const count = counts.get(gram) ?? 0;
    if (count > 0) {
      overlap += 1;
      counts.set(gram, count - 1);
    }
  }
  return (2 * overlap) / (left.length + right.length - 2);
}

function scoreCandidate(record, candidate, searchName) {
  const expectedNames = [record.restaurantName, searchName, ...(aliases[record.restaurantName] ?? [])]
    .map(normalize)
    .filter(Boolean);
  const candidateName = normalize(candidate.name);
  let nameScore = 0;
  for (const expected of expectedNames) {
    if (expected === candidateName) nameScore = Math.max(nameScore, 220);
    else if (expected.includes(candidateName) || candidateName.includes(expected)) {
      const ratio = Math.min(expected.length, candidateName.length) /
        Math.max(expected.length, candidateName.length);
      nameScore = Math.max(nameScore, 125 + Math.round(ratio * 65));
    } else {
      nameScore = Math.max(nameScore, Math.round(bigramDice(expected, candidateName) * 140));
    }
  }

  const addressText = normalize(
    `${candidate.new_address ?? ""} ${candidate.address ?? ""} ${candidate.name ?? ""}`
  );
  const region = normalize(record.region);
  const regionScore = region && addressText.includes(region) ? 35 : 0;
  const categoryScore = candidate.cate_name_depth1 === "음식점" ? 45 : -100;
  const total = nameScore + regionScore + categoryScore;
  return { total, nameScore, regionScore, categoryScore };
}

function roadAddress(candidate) {
  const road = String(candidate.new_address ?? "").trim();
  const displayParts = String(candidate.new_address_disp ?? "")
    .split("|")
    .map((part) => part.trim());
  // Kakao returns province|district|neighborhood|road|number|detail. Keep empty
  // slots so the detail index does not shift for addresses without a province.
  const detail = displayParts.slice(5).filter(Boolean).join(" ");
  if (!road) return String(candidate.address ?? "").trim();
  if (!detail || road.includes(detail)) return road;
  return `${road} ${detail}`.replace(/\s+/g, " ").trim();
}

function toCandidate(candidate, query, score) {
  return {
    kakaoPlaceId: String(candidate.confirmid),
    name: candidate.name,
    address: roadAddress(candidate),
    parcelAddress: candidate.address ?? "",
    lat: Number(candidate.lat) || null,
    lng: Number(candidate.lon) || null,
    phone: candidate.tel ?? "",
    category: candidate.last_cate_name ?? candidate.cate_name_depth2 ?? "",
    placeUrl: `https://place.map.kakao.com/${candidate.confirmid}`,
    matchedQuery: query,
    ...score,
  };
}

async function search(query) {
  const url = new URL(endpoint);
  url.searchParams.set("q", query);
  url.searchParams.set("msFlag", "A");
  url.searchParams.set("sort", "0");
  const response = await fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      Referer: "https://map.kakao.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36",
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${query}`);
  const payload = await response.json();
  return Array.isArray(payload.place) ? payload.place : [];
}

async function collectRecord(record) {
  const searchNames = [record.restaurantName, ...(aliases[record.restaurantName] ?? [])];
  const queries = Array.from(
    new Set(
      searchNames.flatMap((name) => [
        `${name} ${record.region}`.trim(),
        name,
      ])
    )
  );
  const candidates = new Map();
  const errors = [];

  for (const query of queries) {
    try {
      const results = await search(query);
      const searchName = searchNames.find((name) => query.startsWith(name)) ?? record.restaurantName;
      for (const candidate of results) {
        if (!candidate?.confirmid || !candidate?.name) continue;
        const score = scoreCandidate(record, candidate, searchName);
        const current = candidates.get(String(candidate.confirmid));
        if (!current || score.total > current.score.total) {
          candidates.set(String(candidate.confirmid), { candidate, query, score });
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
    await sleep(45);
  }

  const ranked = Array.from(candidates.values())
    .sort((left, right) => right.score.total - left.score.total)
    .map(({ candidate, query, score }) => toCandidate(candidate, query, score));
  const best = ranked[0] ?? null;
  const runnerUp = ranked[1] ?? null;
  const autoSelected =
    best &&
    best.total >= 190 &&
    (!runnerUp || best.total - runnerUp.total >= 15)
      ? best
      : null;

  return {
    id: record.id,
    restaurantName: record.restaurantName,
    region: record.region,
    listingUrl: record.listingUrl,
    selected: autoSelected,
    candidates: ranked.slice(0, 5),
    errors,
  };
}

async function main() {
  const records = JSON.parse(await readFile(inputPath, "utf8"));
  const targets = records.filter((record) => !String(record.address ?? "").trim());
  const results = [];
  for (const [index, record] of targets.entries()) {
    results.push(await collectRecord(record));
    console.log(
      `${index + 1}/${targets.length} ${record.restaurantName}: ${results.at(-1).selected?.address ?? "review"}`
    );
  }

  const output = {
    source: "Kakao Maps public place search",
    sourceUrl: "https://map.kakao.com/",
    collectedAt: new Date().toISOString(),
    targetCount: targets.length,
    selectedCount: results.filter((result) => result.selected).length,
    reviewCount: results.filter((result) => !result.selected).length,
    results,
  };
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outputPath}`);
}

await main();
