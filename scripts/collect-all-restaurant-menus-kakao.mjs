import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "source-data", "menu-enrichment");
const candidatePath = path.join(outputDir, "kakao-menu-candidates.json");
const detailPath = path.join(outputDir, "kakao-full-menu-details.json");
const searchEndpoint = "https://search.map.kakao.com/mapsearch/map.daum";
const verifiedAt = "2026-07-18";
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const sourceFiles = [
  { topic: "culinary-class-wars", season: null, path: path.join(root, "source-data", "culinary-class-wars", "restaurants.json") },
  ...[1, 2, 3, 4].map((season) => ({
    topic: "jeonhyunmoo-plan",
    season,
    path: path.join(root, "source-data", "jeonhyunmoo-plan", `season-${season}`, "restaurants.json"),
  })),
];

const overseasPattern = /USA|Louisville|WASHINGTON|Hong Kong|Italy|Japan|Australia|Thailand|China|Singapore|UK|France|홍콩|중국|일본|도쿠시마/i;
const rejectedPlaceIds = new Map([
  ["culinary-class-wars-s1-81-4", new Set(["2045006957"])], // 버거보이가 아니라 복합상가 성수낙낙
  ["jhmp-s1-e12-bangchon", new Set(["18525119"])], // 식당이 아니라 방촌시장 전체 장소
]);

function extractKakaoPlaceId(url = "") {
  return String(url).match(/place\.map\.kakao\.com\/(\d+)/)?.[1] ?? null;
}

function recordName(record) {
  return String(record.restaurantName ?? record.name ?? "").trim();
}

function normalize(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/^\(폐업\)\s*/u, "")
    .replace(/(?:본점|직영점|지점)$/u, "")
    .replace(/[()\[\]{}]/g, " ")
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

function distanceMeters(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
  const radius = 6371000;
  const toRadians = (value) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function roadAddress(candidate) {
  const road = String(candidate.new_address ?? "").trim();
  const display = String(candidate.new_address_disp ?? "").split("|").map((part) => part.trim());
  const detail = display.slice(5).filter(Boolean).join(" ");
  if (!road) return String(candidate.address ?? "").trim();
  if (!detail || road.includes(detail)) return road;
  return `${road} ${detail}`.replace(/\s+/g, " ").trim();
}

function scoreCandidate(record, candidate) {
  const expected = normalize(recordName(record));
  const aliases = (record.aliases ?? []).map(normalize).filter(Boolean);
  const candidateName = normalize(candidate.name);
  const names = [expected, ...aliases].filter(Boolean);
  let nameScore = 0;
  for (const name of names) {
    if (name === candidateName) nameScore = Math.max(nameScore, 250);
    else if (name.includes(candidateName) || candidateName.includes(name)) {
      const ratio = Math.min(name.length, candidateName.length) / Math.max(name.length, candidateName.length);
      nameScore = Math.max(nameScore, 150 + Math.round(ratio * 70));
    } else {
      nameScore = Math.max(nameScore, Math.round(bigramDice(name, candidateName) * 170));
    }
  }

  const candidateAddress = normalize(`${candidate.new_address ?? ""} ${candidate.address ?? ""}`);
  const expectedAddress = normalize(record.address);
  let addressScore = 0;
  if (expectedAddress && candidateAddress) {
    if (candidateAddress.includes(expectedAddress) || expectedAddress.includes(candidateAddress)) addressScore = 150;
    else addressScore = Math.round(bigramDice(expectedAddress, candidateAddress) * 100);
  }

  const lat = Number(candidate.lat);
  const lng = Number(candidate.lon);
  const recordLat = record.lat == null || record.lat === "" ? null : Number(record.lat);
  const recordLng = record.lng == null || record.lng === "" ? null : Number(record.lng);
  const distance = distanceMeters(recordLat, recordLng, lat, lng);
  let distanceScore = 0;
  if (distance != null) {
    if (distance <= 80) distanceScore = 220;
    else if (distance <= 250) distanceScore = 150;
    else if (distance <= 1000) distanceScore = 60;
    else if (distance >= 5000) distanceScore = -180;
  }
  const categoryScore = candidate.cate_name_depth1 === "음식점" ? 35 : 0;
  return { total: nameScore + addressScore + distanceScore + categoryScore, nameScore, addressScore, distanceScore, distanceMeters: distance };
}

function compactCandidate(candidate, query, score) {
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
    query,
    ...score,
  };
}

async function search(query) {
  const url = new URL(searchEndpoint);
  url.searchParams.set("q", query);
  url.searchParams.set("msFlag", "A");
  url.searchParams.set("sort", "0");
  const response = await fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      Referer: "https://map.kakao.com/",
      "User-Agent": "Mozilla/5.0",
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const payload = await response.json();
  return Array.isArray(payload.place) ? payload.place : [];
}

function searchQueries(record) {
  const name = recordName(record);
  const address = String(record.address ?? "").replace(/^\(폐업\)\s*/u, "").trim();
  const region = String(record.region ?? "").trim();
  const addressHint = address.split(/\s+/).slice(0, 4).join(" ");
  return Array.from(new Set([
    `${name} ${addressHint}`.trim(),
    `${name} ${region}`.trim(),
    name,
  ].filter(Boolean)));
}

async function findCandidate(record) {
  const rejected = rejectedPlaceIds.get(String(record.id)) ?? new Set();
  const existingPlaceId = String(record.kakaoPlaceId || extractKakaoPlaceId(record.listingUrl) || "");
  if (existingPlaceId && !rejected.has(existingPlaceId)) {
    return {
      selected: {
        kakaoPlaceId: existingPlaceId,
        name: record.matchedPlaceName || recordName(record),
        address: record.address,
        lat: record.lat,
        lng: record.lng,
        phone: record.phone ?? "",
        placeUrl: `https://place.map.kakao.com/${existingPlaceId}`,
        total: 999,
        existing: true,
      },
      candidates: [],
      errors: [],
    };
  }
  if (!String(record.address ?? "").trim() || overseasPattern.test(`${record.address} ${record.region}`)) {
    return { selected: null, candidates: [], errors: [] };
  }
  const candidates = new Map();
  const errors = [];
  for (const query of searchQueries(record)) {
    try {
      for (const candidate of await search(query)) {
        if (!candidate?.confirmid || !candidate?.name) continue;
        const score = scoreCandidate(record, candidate);
        const current = candidates.get(String(candidate.confirmid));
        if (!current || score.total > current.score.total) candidates.set(String(candidate.confirmid), { candidate, query, score });
      }
    } catch (error) {
      errors.push(`${query}: ${error instanceof Error ? error.message : String(error)}`);
    }
    await sleep(35);
  }
  const ranked = [...candidates.values()]
    .sort((left, right) => right.score.total - left.score.total)
    .map(({ candidate, query, score }) => compactCandidate(candidate, query, score))
    .filter((candidate) => !rejected.has(candidate.kakaoPlaceId));
  const best = ranked[0] ?? null;
  const next = ranked[1] ?? null;
  const selected = best && (
    best.total >= 300 && (!next || best.total - next.total >= 15) ||
    best.distanceMeters != null && best.distanceMeters <= 100 && best.nameScore >= 80 ||
    best.nameScore >= 220 && best.addressScore >= 20 ||
    best.nameScore >= 175 && best.addressScore >= 90
  ) ? best : null;
  return { selected, candidates: ranked.slice(0, 5), errors };
}

function normalizeMenus(items = []) {
  const seen = new Set();
  return items
    .map((item) => ({
      name: String(item?.name ?? "").replace(/\s+/g, " ").trim(),
      price: Number(item?.price) > 0 ? `${Number(item.price).toLocaleString("ko-KR")}원` : null,
      isSignature: Boolean(item?.is_recommend),
      sourceId: "kakao-place-menu",
      observedAt: verifiedAt,
      confidence: 0.94,
    }))
    .filter((item) => item.name)
    .filter((item) => {
      const key = `${item.name.toLocaleLowerCase("ko-KR")}|${item.price ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function fetchPanel(placeId) {
  const response = await fetch(`https://place-api.map.kakao.com/places/panel3/${placeId}`, {
    headers: {
      Accept: "application/json",
      appVersion: "6.6.0",
      pf: "PC",
      Origin: "https://place.map.kakao.com",
      Referer: `https://place.map.kakao.com/${placeId}`,
      "User-Agent": "Mozilla/5.0",
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const payload = await response.json();
  const summary = payload.summary ?? {};
  const menu = payload.menu?.menus ?? {};
  return {
    kakaoPlaceId: String(placeId),
    name: summary.name ?? "",
    address: summary.address?.road ?? summary.address?.disp ?? "",
    parcelAddress: summary.address?.jibun ?? "",
    lat: Number(summary.point?.lat) || null,
    lng: Number(summary.point?.lon) || null,
    phone: summary.phone_numbers?.[0]?.tel ?? "",
    placeUrl: `https://place.map.kakao.com/${placeId}`,
    menus: normalizeMenus(menu.items ?? []),
    menuUpdatedAt: menu.items_updated_at ?? "",
    placeUpdatedAt: summary.meta?.updated_at ?? "",
  };
}

function applyDetail(record, selection, detail) {
  if (!selection || !detail) return record;
  const preserveManual = String(record.kakaoPlaceId) === "1952752710";
  const menus = !preserveManual && detail.menus.length ? detail.menus : (record.menus ?? []);
  const pricedCount = menus.filter((menu) => menu.price).length;
  const sourceUrl = preserveManual
    ? record.menuPriceSources?.[0]?.url
    : detail.menus.length
      ? detail.placeUrl
      : record.menuPriceSources?.[0]?.url;
  const notes = [
    record.notes,
    detail.menus.length ? `카카오 공개 메뉴판 ${detail.menus.length}개 항목 수집` : "카카오 공개 메뉴판 없음",
  ].filter(Boolean).join(" / ");
  return {
    ...record,
    address: record.address || detail.address,
    lat: detail.lat ?? record.lat,
    lng: detail.lng ?? record.lng,
    phone: record.phone || detail.phone,
    kakaoPlaceId: detail.kakaoPlaceId,
    placeUrl: preserveManual ? record.placeUrl : detail.placeUrl,
    matchedPlaceName: detail.name,
    menus,
    representativeMenu: menus.length
      ? menus.slice(0, 4).map((menu) => `${menu.name}${menu.price ? ` ${menu.price}` : ""}`).join(", ")
      : record.representativeMenu,
    menuPriceStatus: menus.length
      ? pricedCount === menus.length
        ? "current-public-full-menu"
        : pricedCount
          ? "current-public-menu-partial-prices"
          : "public-menu-without-prices"
      : "public-menu-unavailable",
    menuPriceVerifiedAt: verifiedAt,
    menuPriceSources: sourceUrl ? [{ label: preserveManual ? "메뉴·가격 확인" : "카카오맵 전체 메뉴판", url: sourceUrl }] : [],
    reviewStatus: "menu-address-reviewed",
    confidence: Math.max(Number(record.confidence) || 0, 0.9),
    notes,
  };
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const datasets = [];
  const work = [];
  for (const source of sourceFiles) {
    const records = JSON.parse(await readFile(source.path, "utf8"));
    datasets.push({ ...source, records });
    for (const record of records) work.push({ source, record, key: `${source.topic}:${record.id}` });
  }

  const candidateResults = [];
  for (const [index, item] of work.entries()) {
    const result = await findCandidate(item.record);
    candidateResults.push({
      key: item.key,
      topic: item.source.topic,
      season: item.source.season ?? item.record.season,
      id: item.record.id,
      name: recordName(item.record),
      address: item.record.address ?? "",
      ...result,
    });
    console.log(`${index + 1}/${work.length} ${recordName(item.record)} -> ${result.selected?.name ?? "review"}`);
  }

  const selectedByKey = new Map(candidateResults.map((result) => [result.key, result.selected]));
  const placeIds = Array.from(new Set(candidateResults.map((result) => result.selected?.kakaoPlaceId).filter(Boolean)));
  const detailById = new Map();
  const detailErrors = [];
  for (const [index, placeId] of placeIds.entries()) {
    try {
      detailById.set(placeId, await fetchPanel(placeId));
    } catch (error) {
      detailErrors.push({ placeId, error: error instanceof Error ? error.message : String(error) });
    }
    if ((index + 1) % 25 === 0) console.log(`details ${index + 1}/${placeIds.length}`);
    await sleep(45);
  }

  for (const dataset of datasets) {
    const records = dataset.records.map((record) => {
      const key = `${dataset.topic}:${record.id}`;
      const selected = selectedByKey.get(key);
      const detail = selected ? detailById.get(selected.kakaoPlaceId) : null;
      return applyDetail(record, selected, detail);
    });
    await writeFile(dataset.path, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  }

  await writeFile(candidatePath, `${JSON.stringify({
    source: "Kakao Maps public place search",
    collectedAt: new Date().toISOString(),
    recordCount: work.length,
    selectedCount: candidateResults.filter((result) => result.selected).length,
    reviewCount: candidateResults.filter((result) => !result.selected).length,
    results: candidateResults,
  }, null, 2)}\n`, "utf8");
  await writeFile(detailPath, `${JSON.stringify({
    source: "Kakao Maps public full menu panels",
    collectedAt: new Date().toISOString(),
    placeCount: detailById.size,
    errors: detailErrors,
    places: [...detailById.values()],
  }, null, 2)}\n`, "utf8");

  const details = [...detailById.values()];
  console.log(JSON.stringify({
    recordCount: work.length,
    selectedCount: candidateResults.filter((result) => result.selected).length,
    reviewCount: candidateResults.filter((result) => !result.selected).length,
    uniquePlaceCount: details.length,
    placesWithMenus: details.filter((detail) => detail.menus.length).length,
    fullMenuItems: details.reduce((total, detail) => total + detail.menus.length, 0),
    pricedMenuItems: details.reduce((total, detail) => total + detail.menus.filter((menu) => menu.price).length, 0),
    detailErrorCount: detailErrors.length,
  }, null, 2));
}

await main();
