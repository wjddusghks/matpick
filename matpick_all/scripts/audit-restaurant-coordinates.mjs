import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(projectRoot, "..");
const reportDir = path.join(repositoryRoot, "deliverables", "coordinate-audit-2026-07-20");
const cachePath = path.join(reportDir, "kakao-search-cache.json");
const reportPath = path.join(reportDir, "coordinate-audit.json");
const postApplyReportPath = path.join(reportDir, "coordinate-audit-post-apply.json");
const SEARCH_ENDPOINT = "https://search.map.kakao.com/mapsearch/map.daum";
const DISTANCE_THRESHOLD_METERS = 150;
const CONCURRENCY = 6;
const APPLY = process.argv.includes("--apply");
const APPLY_REPORT = process.argv.includes("--apply-report");
const VERIFY = process.argv.includes("--verify");
const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
const LIMIT = limitArgument ? Number(limitArgument.split("=")[1]) : Number.POSITIVE_INFINITY;

const MANUAL_PLACE_OVERRIDES = new Map(
  [
    {
      id: "mogeultende_f20fe148a8bb",
      name: "만우장",
      newAddress: "부산 수영구 수영로594번길 28-2",
      parcelAddress: "부산 수영구 광안동 146-17",
      lat: 35.1585033916172,
      lng: 129.114821217172,
      verificationSource: "https://mzc.purpleo.kr/article/16236",
    },
    {
      id: "culinary-class-wars_restaurant_ab41109dcf16",
      name: "최씨네피자",
      newAddress: "대구 수성구 달구벌대로467길 22-24",
      lat: 35.8604,
      lng: 128.619,
      verificationSource:
        "https://www.eathub.co.kr/ko/restaurant/%EB%8C%80%EA%B5%AC-%EC%B5%9C%EC%94%A8%EB%84%A4%ED%94%BC%EC%9E%90-36f85ddd-4a37-41ab-a65b-5f813d65b78b",
    },
    {
      id: "culinary-class-wars_restaurant_e38fba4239ab",
      name: "언니네 시골집",
      newAddress: "제주 제주시 한경면 용수3길 38",
      lat: 33.3246894,
      lng: 126.165824,
      verificationSource:
        "https://map.naver.com/p/entry/place/1945152511?lng=126.165824&lat=33.3246894&placePath=%2Fhome",
    },
    {
      id: "jeonhyunmoo-plan_restaurant_8da0662981ab",
      kakaoPlaceId: "9167450",
      name: "성안정꽃게전문",
      newAddress: "인천 강화군 내가면 중앙로1296번길 2-7",
      parcelAddress: "인천 강화군 내가면 외포리 627-1",
      lat: 37.7025729,
      lng: 126.38067582,
      correctedAddress: "인천 강화군 내가면 중앙로1296번길 2-7",
      verificationSource:
        "https://www.ganghwa.go.kr/open_content/main/locinfo/food.do?act=detail&loc_seq=1707",
    },
    {
      id: "jeonhyunmoo-plan_restaurant_a046ae64f036",
      kakaoPlaceId: "10349051",
      name: "만복정",
      newAddress: "인천 강화군 강화읍 중앙로 17-9",
      parcelAddress: "인천 강화군 강화읍 갑곳리 849 강화풍물시장 2층 2032호",
      lat: 37.74152286,
      lng: 126.49300397,
      correctedAddress: "인천 강화군 강화읍 중앙로 17-9 강화풍물시장 2층 2032호",
      verificationSource: "https://nopo.haedory.com/2025/09/2.html",
    },
    {
      id: "jeonhyunmoo-plan_restaurant_2c2d950d80f1",
      kakaoPlaceId: "8275895",
      name: "동락식당",
      newAddress: "전남 영광군 영광읍 현암길 55-8",
      parcelAddress: "전남 영광군 영광읍 백학리 25-2",
      lat: 35.27623372,
      lng: 126.51089843,
      correctedAddress: "전남 영광군 영광읍 현암길 55-8",
      verificationSource: "https://opengo.kr/5601fb830e887edf2cf65463",
    },
    {
      id: "jeonhyunmoo-plan_restaurant_cde2b8021916",
      kakaoPlaceId: "9575143",
      name: "할매묵집",
      newAddress: "대구 달서구 수밭길 22",
      parcelAddress: "대구 달서구 도원동 1076",
      lat: 35.79722264,
      lng: 128.54805256,
      correctedAddress: "대구 달서구 수밭길 22",
      verificationSource: "https://www.daegufood.go.kr/kor/food/food_tmi.asp?idx=679",
    },
    {
      id: "seoul-taste-100-2025-663",
      kakaoPlaceId: "10842704",
      name: "까사델비노",
      newAddress: "서울 강남구 선릉로162길 43",
      parcelAddress: "서울 강남구 청담동 80-5",
      lat: 37.52635405,
      lng: 127.04404806,
      verificationSource: "https://place.map.kakao.com/10842704",
    },
    {
      id: "old-korean-100_restaurant_017",
      kakaoPlaceId: "8531849",
      name: "잼배옥",
      newAddress: "서울 중구 세종대로9길 68-9",
      parcelAddress: "서울 중구 서소문동 64-4",
      lat: 37.56254798,
      lng: 126.97371639,
      correctedAddress: "서울 중구 세종대로9길 68-9 (서소문동 64-4)",
      verificationSource: "https://www.emmaru.com/matzip/matzip.do?code=M150607205227592420G&f=1&s=1&t=0",
    },
  ].map((place) => [place.id, place])
);

const DATA_FILES = [
  "client/src/data/matpick-data.json",
  "client/src/data/generated/old-korean-100.generated.json",
  "client/src/data/generated/sikgaek-baekban-trip.generated.json",
  "client/src/data/generated/culinary-class-wars.generated.json",
  "client/src/data/generated/jeonhyunmoo-plan.generated.json",
  "client/src/data/generated/seoul-taste-100.generated.json",
  "client/src/data/generated/wednesday-gourmet.generated.json",
  "client/src/data/generated/topic-enrichments/baekban-trip.enriched.json",
  "client/src/data/generated/topic-enrichments/baekjong-wok.enriched.json",
  "client/src/data/generated/topic-enrichments/delicious-guys.enriched.json",
  "client/src/data/generated/topic-enrichments/michelin-1-star.enriched.json",
  "client/src/data/generated/topic-enrichments/michelin-2-stars.enriched.json",
  "client/src/data/generated/topic-enrichments/michelin-3-stars.enriched.json",
  "client/src/data/generated/topic-enrichments/michelin-bib-gourmand.enriched.json",
  "client/src/data/generated/topic-enrichments/michelin-selected.enriched.json",
  "client/src/data/generated/topic-enrichments/old-korean-100.enriched.json",
  "client/src/data/generated/topic-enrichments/popular-restaurants.enriched.json",
  "client/src/data/generated/topic-enrichments/ttoganjip.enriched.json",
  "client/src/data/generated/topic-enrichments/wednesday-gourmet.enriched.json",
].map((relativePath) => path.join(projectRoot, relativePath));

const SOURCE_COORDINATE_FILES = [
  "source-data/old-korean-100/coordinates.json",
  "source-data/sikgaek-baekban-trip/coordinates.json",
  "source-data/wednesday-gourmet/coordinates.json",
  "source-data/mogeultende/restaurants.json",
  "source-data/culinary-class-wars/restaurants.json",
  "source-data/seoul-taste-100/restaurants.json",
  "source-data/jeonhyunmoo-plan/season-1/restaurants.json",
  "source-data/jeonhyunmoo-plan/season-2/restaurants.json",
  "source-data/jeonhyunmoo-plan/season-3/restaurants.json",
  "source-data/jeonhyunmoo-plan/season-4/restaurants.json",
].map((relativePath) => path.join(repositoryRoot, relativePath));

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function normalize(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function tokenize(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[(),]/g, " ")
    .match(/[\p{L}\p{N}-]+/gu) ?? [];
}

function cleanAddressForSearch(address = "") {
  return String(address)
    .normalize("NFKC")
    .replace(/전남광주/g, "광주")
    .replace(/서울특별시/g, "서울")
    .replace(/부산광역시/g, "부산")
    .replace(/대구광역시/g, "대구")
    .replace(/인천광역시/g, "인천")
    .replace(/광주광역시/g, "광주")
    .replace(/대전광역시/g, "대전")
    .replace(/울산광역시/g, "울산")
    .replace(/세종특별자치시/g, "세종")
    .replace(/경기도/g, "경기")
    .replace(/강원특별자치도|강원도/g, "강원")
    .replace(/충청북도/g, "충북")
    .replace(/충청남도/g, "충남")
    .replace(/전북특별자치도|전라북도/g, "전북")
    .replace(/전라남도/g, "전남")
    .replace(/경상북도/g, "경북")
    .replace(/경상남도/g, "경남")
    .replace(/제주특별자치도|제주도/g, "제주")
    .split(",")[0]
    .replace(/\s*\([^)]*\)\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalProvince(address = "") {
  const value = cleanAddressForSearch(address);
  const aliases = [
    [/(?:^|\s)서울(?:\s|$)/, "서울"],
    [/(?:^|\s)부산(?:\s|$)/, "부산"],
    [/(?:^|\s)대구(?:\s|$)/, "대구"],
    [/(?:^|\s)인천(?:\s|$)/, "인천"],
    [/(?:^|\s)광주(?:\s|$)/, "광주"],
    [/(?:^|\s)대전(?:\s|$)/, "대전"],
    [/(?:^|\s)울산(?:\s|$)/, "울산"],
    [/(?:^|\s)세종(?:\s|$)/, "세종"],
    [/(?:^|\s)경기(?:\s|$)/, "경기"],
    [/(?:^|\s)강원(?:\s|$)/, "강원"],
    [/(?:^|\s)충북(?:\s|$)/, "충북"],
    [/(?:^|\s)충남(?:\s|$)/, "충남"],
    [/(?:^|\s)전북(?:\s|$)/, "전북"],
    [/(?:^|\s)전남(?:\s|$)/, "전남"],
    [/(?:^|\s)경북(?:\s|$)/, "경북"],
    [/(?:^|\s)경남(?:\s|$)/, "경남"],
    [/(?:^|\s)제주(?:\s|$)/, "제주"],
  ];
  return aliases.find(([pattern]) => pattern.test(value))?.[1] ?? "";
}

function districtToken(address = "") {
  return tokenize(cleanAddressForSearch(address)).find((token) => /(?:구|군)$/.test(token)) ?? "";
}

function cityToken(address = "") {
  return (
    tokenize(cleanAddressForSearch(address)).find(
      (token) => /시$/.test(token) && !/특별시|광역시|자치시$/.test(token)
    ) ?? ""
  );
}

function locality(address = "") {
  const province = canonicalProvince(address);
  const district = districtToken(address) || cityToken(address);
  return [province, district].filter(Boolean).join(" ");
}

function signature(address = "", kind) {
  const tokens = tokenize(address);
  const suffixPattern = kind === "road" ? /(?:대로|로|길)$/ : /(?:동|가|읍|면|리)$/;
  for (let index = 0; index < tokens.length; index += 1) {
    if (!suffixPattern.test(tokens[index])) continue;
    const number = tokens.slice(index + 1).find((token) => /^\d+(?:-\d+)?$/.test(token));
    if (number) return `${normalize(tokens[index])}|${number}`;
  }
  return "";
}

function districtsCompatible(expectedAddress, candidateAddress, expectedDistrict, candidateDistrict) {
  if (!expectedDistrict || !candidateDistrict || expectedDistrict === candidateDistrict) return true;
  if (canonicalProvince(expectedAddress) !== "인천" || canonicalProvince(candidateAddress) !== "인천") {
    return false;
  }
  const currentDistrictAliases = new Map([
    ["제물포구", new Set(["중구", "동구"])],
    ["영종구", new Set(["중구"])],
    ["검단구", new Set(["서구"])],
  ]);
  return (
    currentDistrictAliases.get(candidateDistrict)?.has(expectedDistrict) === true ||
    currentDistrictAliases.get(expectedDistrict)?.has(candidateDistrict) === true
  );
}

function adminMismatch(expectedAddress, candidateAddress) {
  const expectedProvince = canonicalProvince(expectedAddress);
  const candidateProvince = canonicalProvince(candidateAddress);
  if (expectedProvince && candidateProvince && expectedProvince !== candidateProvince) return true;

  const expectedDistrict = districtToken(expectedAddress);
  const candidateDistrict = districtToken(candidateAddress);
  if (!districtsCompatible(expectedAddress, candidateAddress, expectedDistrict, candidateDistrict)) return true;

  const expectedCity = cityToken(expectedAddress);
  const candidateCity = cityToken(candidateAddress);
  return Boolean(expectedCity && candidateCity && expectedCity !== candidateCity);
}

function bigramDice(left, right) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;
  const counts = new Map();
  for (let index = 0; index < left.length - 1; index += 1) {
    const bigram = left.slice(index, index + 2);
    counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
  }
  let overlap = 0;
  for (let index = 0; index < right.length - 1; index += 1) {
    const bigram = right.slice(index, index + 2);
    const count = counts.get(bigram) ?? 0;
    if (count > 0) {
      overlap += 1;
      counts.set(bigram, count - 1);
    }
  }
  return (2 * overlap) / (left.length + right.length - 2);
}

function nameVariants(name = "") {
  const raw = normalize(name);
  const stripped = normalize(
    String(name)
      .replace(/^(?:서울|부산|대구|인천|광주|대전|울산|세종|제주)\s*/u, "")
      .replace(/(?:본점|직영점|별관|\d+호점|지점)$/u, "")
  );
  return Array.from(new Set([raw, stripped].filter(Boolean)));
}

function nameSimilarity(expectedName, candidateName) {
  let best = 0;
  for (const left of nameVariants(expectedName)) {
    for (const right of nameVariants(candidateName)) {
      if (left === right) return 1;
      const containment = left.includes(right) || right.includes(left)
        ? Math.min(left.length, right.length) / Math.max(left.length, right.length)
        : 0;
      best = Math.max(best, containment, bigramDice(left, right));
    }
  }
  return best;
}

function candidateAddress(candidate) {
  return [candidate.newAddress, candidate.parcelAddress].filter(Boolean).join(" ");
}

function scoreCandidate(restaurant, candidate) {
  const expectedAddress = restaurant.address || restaurant.officialDescriptionAddress;
  const actualAddress = candidateAddress(candidate);
  const exactRoad = Boolean(
    signature(expectedAddress, "road") &&
      signature(expectedAddress, "road") === signature(actualAddress, "road")
  );
  const exactParcel = Boolean(
    signature(expectedAddress, "parcel") &&
      signature(expectedAddress, "parcel") === signature(actualAddress, "parcel")
  );
  const mismatch = adminMismatch(expectedAddress, actualAddress);
  const expectedNormalized = normalize(cleanAddressForSearch(expectedAddress));
  const newAddressNormalized = normalize(cleanAddressForSearch(candidate.newAddress));
  const normalizedMatch = Boolean(
    expectedNormalized &&
      newAddressNormalized &&
      (expectedNormalized.includes(newAddressNormalized) || newAddressNormalized.includes(expectedNormalized))
  );
  const roadNameMatch = Boolean(
    tokenize(expectedAddress).find((token) => /(?:대로|로|길)$/.test(token)) &&
      tokenize(expectedAddress).find((token) => /(?:대로|로|길)$/.test(token)) ===
        tokenize(actualAddress).find((token) => /(?:대로|로|길)$/.test(token))
  );
  const addressStrength = mismatch
    ? 0
    : exactRoad || exactParcel || normalizedMatch
      ? 3
      : roadNameMatch
        ? 1
        : 0;
  const similarity = nameSimilarity(restaurant.name, candidate.name);
  const foodCategory = !/(?:주거시설|아파트|빌딩|학교|주차장|교통시설|제조업|부동산|금융|공공기관)/.test(
    `${candidate.category} ${candidate.categoryDetail} ${candidate.name}`
  );
  return {
    total: addressStrength * 100 + Math.round(similarity * 60) + (foodCategory ? 10 : 0),
    addressStrength,
    nameSimilarity: Number(similarity.toFixed(3)),
    adminMismatch: mismatch,
    exactRoad,
    exactParcel,
    normalizedMatch,
    foodCategory,
  };
}

function haversineMeters(leftLat, leftLng, rightLat, rightLng) {
  const radius = 6_371_000;
  const toRadians = (value) => (value * Math.PI) / 180;
  const deltaLat = toRadians(rightLat - leftLat);
  const deltaLng = toRadians(rightLng - leftLng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(leftLat)) * Math.cos(toRadians(rightLat)) * Math.sin(deltaLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hasValidCoordinates(restaurant) {
  return (
    Number.isFinite(restaurant.lat) &&
    Number.isFinite(restaurant.lng) &&
    restaurant.lat >= 32 &&
    restaurant.lat <= 39.5 &&
    restaurant.lng >= 124 &&
    restaurant.lng <= 132
  );
}

function isDomesticRestaurant(restaurant) {
  if (restaurant.isOverseas === true) return false;
  const address = restaurant.address || restaurant.officialDescriptionAddress || "";
  return /[\u3131-\uD79D]/u.test(address) && Boolean(canonicalProvince(address) || districtToken(address) || cityToken(address));
}

function compactCandidate(candidate) {
  return {
    kakaoPlaceId: String(candidate.confirmid || ""),
    name: candidate.name || "",
    newAddress: candidate.new_address || "",
    parcelAddress: candidate.address || "",
    lat: Number(candidate.lat) || 0,
    lng: Number(candidate.lon) || 0,
    category: candidate.cate_name_depth2 || "",
    categoryDetail: candidate.last_cate_name || candidate.cate_name_depth3 || "",
  };
}

async function readJsonIfExists(filePath, fallback) {
  try {
    const source = await fs.readFile(filePath, "utf8");
    return JSON.parse(source.replace(/^\uFEFF/u, ""));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function searchKakao(query, cache) {
  if (cache[query]) return cache[query];
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("msFlag", "A");
  url.searchParams.set("sort", "0");

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer: "https://map.kakao.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36",
      },
    });
    if (response.ok) {
      const data = await response.json();
      const candidates = (Array.isArray(data.place) ? data.place : []).map(compactCandidate);
      cache[query] = candidates;
      return candidates;
    }
    if (attempt === 4 || ![429, 500, 502, 503, 504].includes(response.status)) {
      throw new Error(`Kakao search failed (${response.status}) for ${query}`);
    }
    await sleep(attempt * 500);
  }
  return [];
}

function selectBestCandidate(restaurant, candidates) {
  const seen = new Map();
  for (const candidate of candidates) {
    if (!candidate.kakaoPlaceId || !candidate.lat || !candidate.lng) continue;
    const scored = { ...candidate, score: scoreCandidate(restaurant, candidate) };
    const current = seen.get(candidate.kakaoPlaceId);
    if (!current || scored.score.total > current.score.total) seen.set(candidate.kakaoPlaceId, scored);
  }
  return Array.from(seen.values()).sort((left, right) => right.score.total - left.score.total)[0] ?? null;
}

async function auditRestaurant(restaurant, cache) {
  const manualPlace = MANUAL_PLACE_OVERRIDES.get(restaurant.id);
  if (manualPlace) {
    const currentValid = hasValidCoordinates(restaurant);
    const distanceMeters = currentValid
      ? haversineMeters(restaurant.lat, restaurant.lng, manualPlace.lat, manualPlace.lng)
      : null;
    return {
      status: !currentValid
        ? "filled"
        : distanceMeters > DISTANCE_THRESHOLD_METERS
          ? "corrected"
          : "verified",
      distanceMeters: distanceMeters == null ? null : Math.round(distanceMeters),
      selected: {
        kakaoPlaceId: manualPlace.kakaoPlaceId || "",
        name: manualPlace.name,
        newAddress: manualPlace.newAddress,
        parcelAddress: manualPlace.parcelAddress || "",
        lat: manualPlace.lat,
        lng: manualPlace.lng,
        category: "",
        categoryDetail: "",
        correctedAddress: manualPlace.correctedAddress || null,
        verificationSource: manualPlace.verificationSource,
        score: {
          total: 500,
          addressStrength: 4,
          nameSimilarity: 1,
          adminMismatch: false,
          exactRoad: true,
          exactParcel: Boolean(manualPlace.parcelAddress),
          normalizedMatch: true,
          foodCategory: true,
          manuallyVerified: true,
        },
      },
    };
  }
  const expectedAddress = restaurant.address || restaurant.officialDescriptionAddress || "";
  const addressQuery = cleanAddressForSearch(expectedAddress);
  const addressCandidates = addressQuery ? await searchKakao(addressQuery, cache) : [];
  let best = selectBestCandidate(restaurant, addressCandidates);
  const currentValid = hasValidCoordinates(restaurant);
  const initialDistance = currentValid && best
    ? haversineMeters(restaurant.lat, restaurant.lng, best.lat, best.lng)
    : Number.POSITIVE_INFINITY;

  if (!best || !currentValid || initialDistance > DISTANCE_THRESHOLD_METERS) {
    const placeQuery = `${restaurant.name} ${locality(expectedAddress)}`.trim();
    const placeCandidates = placeQuery && placeQuery !== addressQuery
      ? await searchKakao(placeQuery, cache)
      : [];
    best = selectBestCandidate(restaurant, [...addressCandidates, ...placeCandidates]);
  }

  if (!best) {
    return { status: currentValid ? "unverified" : "unresolved-missing", reason: "no-candidate" };
  }

  const strongMatch =
    best.score.addressStrength >= 3 ||
    (best.score.addressStrength >= 1 && best.score.nameSimilarity >= 0.72);
  const distanceMeters = currentValid
    ? haversineMeters(restaurant.lat, restaurant.lng, best.lat, best.lng)
    : null;
  const detail = {
    selected: best,
    distanceMeters: distanceMeters == null ? null : Math.round(distanceMeters),
  };

  if (!strongMatch) {
    if (
      currentValid &&
      distanceMeters <= 100 &&
      best.score.nameSimilarity >= 0.8 &&
      !best.score.adminMismatch &&
      Boolean(best.newAddress)
    ) {
      return { status: "address-corrected", ...detail };
    }
    return {
      status: currentValid ? "review-needed" : "unresolved-missing",
      reason: "low-confidence-candidate",
      ...detail,
    };
  }
  if (!currentValid) return { status: "filled", ...detail };
  if (distanceMeters > DISTANCE_THRESHOLD_METERS) return { status: "corrected", ...detail };
  return { status: "verified", ...detail };
}

function normalizeLookupValue(value = "") {
  return String(value).replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeAddressForLookup(address = "") {
  return normalizeLookupValue(String(address).replace(/\([^)]*\)/g, " "));
}

function buildLookupKeys(restaurant) {
  const normalizedName = normalizeLookupValue(restaurant.name || "");
  const normalizedAddress = normalizeAddressForLookup(restaurant.address || "");
  const names = new Set([normalizedName]);
  const addressTokens = normalizeLookupValue(`${restaurant.region || ""} ${restaurant.address || ""}`)
    .split(" ")
    .filter(Boolean);
  for (const prefix of [addressTokens[0], `${addressTokens[0] || ""} ${addressTokens[1] || ""}`.trim()]) {
    if (prefix && normalizedName.startsWith(`${prefix} `)) names.add(normalizedName.slice(prefix.length).trim());
  }
  return Array.from(names).filter(Boolean).map((name) => `${name}|${normalizedAddress}`);
}

function getRestaurantArrays(document) {
  const arrays = [];
  if (Array.isArray(document)) arrays.push(document);
  if (document && Array.isArray(document.restaurants)) arrays.push(document.restaurants);
  return arrays;
}

async function applyCorrections(corrections) {
  const byId = new Map(corrections.map((item) => [item.id, item]));
  const byLookupKey = new Map();
  for (const correction of corrections) {
    for (const key of buildLookupKeys(correction)) byLookupKey.set(key, correction);
  }

  const changedFiles = [];
  for (const filePath of [...DATA_FILES, ...SOURCE_COORDINATE_FILES]) {
    const document = await readJsonIfExists(filePath, null);
    if (document == null) continue;
    let changed = 0;
    for (const rows of getRestaurantArrays(document)) {
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const direct = byId.get(row.id);
        const lookup = buildLookupKeys(row).map((key) => byLookupKey.get(key)).find(Boolean);
        const correction = direct || lookup;
        if (!correction) continue;
        if (row.lat === correction.newLat && row.lng === correction.newLng) continue;
        row.lat = correction.newLat;
        row.lng = correction.newLng;
        if (correction.correctedAddress) {
          row.address = correction.correctedAddress;
          if ("officialDescriptionAddress" in row) {
            row.officialDescriptionAddress = correction.correctedAddress;
          }
        }
        changed += 1;
      }
    }
    if (changed > 0) {
      await fs.writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
      changedFiles.push({ file: path.relative(repositoryRoot, filePath).replaceAll("\\", "/"), records: changed });
    }
  }
  return changedFiles;
}

async function loadVisibleRestaurants() {
  const server = await createServer({
    configFile: path.join(projectRoot, "vite.config.ts"),
    logLevel: "error",
    server: { middlewareMode: true },
    appType: "custom",
  });
  try {
    const module = await server.ssrLoadModule("/src/data/index.ts");
    return module.restaurants;
  } finally {
    await server.close();
  }
}

async function main() {
  await fs.mkdir(reportDir, { recursive: true });
  const cache = await readJsonIfExists(cachePath, {});
  const visibleRestaurants = await loadVisibleRestaurants();
  const domesticRestaurants = visibleRestaurants.filter(isDomesticRestaurant).slice(0, LIMIT);
  const results = [];

  for (let offset = 0; offset < domesticRestaurants.length; offset += CONCURRENCY) {
    const batch = domesticRestaurants.slice(offset, offset + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (restaurant) => {
        try {
          return { restaurant, audit: await auditRestaurant(restaurant, cache) };
        } catch (error) {
          return {
            restaurant,
            audit: { status: "error", reason: error instanceof Error ? error.message : String(error) },
          };
        }
      })
    );
    results.push(...batchResults);
    const processed = Math.min(offset + batch.length, domesticRestaurants.length);
    if (processed % 60 === 0 || processed === domesticRestaurants.length) {
      const actionable = results.filter(({ audit }) =>
        ["corrected", "filled", "address-corrected"].includes(audit.status)
      ).length;
      console.log(`Processed ${processed}/${domesticRestaurants.length}; ${actionable} corrections/fills found`);
      await fs.writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
    }
    await sleep(25);
  }

  const corrections = results
    .filter(({ audit }) => ["corrected", "filled", "address-corrected"].includes(audit.status))
    .map(({ restaurant, audit }) => ({
      id: restaurant.id,
      name: restaurant.name,
      region: restaurant.region,
      address: restaurant.address,
      oldLat: Number.isFinite(restaurant.lat) ? restaurant.lat : null,
      oldLng: Number.isFinite(restaurant.lng) ? restaurant.lng : null,
      newLat: audit.selected.lat,
      newLng: audit.selected.lng,
      distanceMeters: audit.distanceMeters,
      kakaoPlaceId: audit.selected.kakaoPlaceId,
      kakaoPlaceUrl: audit.selected.kakaoPlaceId
        ? `https://place.map.kakao.com/${audit.selected.kakaoPlaceId}`
        : "",
      kakaoName: audit.selected.name,
      kakaoAddress: audit.selected.newAddress || audit.selected.parcelAddress,
      verificationSource: audit.selected.verificationSource || "",
      correctedAddress:
        audit.selected.correctedAddress ||
        (audit.status === "address-corrected" ||
        (audit.selected.score.addressStrength < 3 && audit.selected.score.nameSimilarity >= 0.8)
          ? audit.selected.newAddress || audit.selected.parcelAddress
          : null),
      confidence: audit.selected.score,
    }));
  const reviewNeeded = results
    .filter(({ audit }) => ["review-needed", "unresolved-missing", "error", "unverified"].includes(audit.status))
    .map(({ restaurant, audit }) => ({
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
      lat: restaurant.lat,
      lng: restaurant.lng,
      ...audit,
    }));
  const statusCounts = Object.fromEntries(
    Array.from(new Set(results.map(({ audit }) => audit.status))).map((status) => [
      status,
      results.filter(({ audit }) => audit.status === status).length,
    ])
  );
  const changedFiles = APPLY ? await applyCorrections(corrections) : [];
  const report = {
    source: "Kakao Maps public place search",
    generatedAt: new Date().toISOString(),
    applied: APPLY,
    distanceThresholdMeters: DISTANCE_THRESHOLD_METERS,
    visibleRestaurantCount: visibleRestaurants.length,
    domesticRestaurantCount: domesticRestaurants.length,
    statusCounts,
    correctionCount: corrections.length,
    reviewNeededCount: reviewNeeded.length,
    changedFiles,
    corrections,
    reviewNeeded,
  };
  const outputReportPath = VERIFY ? postApplyReportPath : reportPath;
  await fs.writeFile(outputReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ reportPath: outputReportPath, ...report, corrections: undefined, reviewNeeded: undefined }, null, 2));
}

async function applyExistingReport() {
  const report = await readJsonIfExists(reportPath, null);
  if (!report?.corrections?.length) {
    throw new Error(`No correction report found at ${reportPath}`);
  }
  const changedFiles = await applyCorrections(report.corrections);
  const appliedReport = {
    ...report,
    applied: true,
    appliedAt: new Date().toISOString(),
    changedFiles,
  };
  await fs.writeFile(reportPath, `${JSON.stringify(appliedReport, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ reportPath, correctionCount: report.corrections.length, changedFiles }, null, 2));
}

if (APPLY_REPORT) {
  await applyExistingReport();
} else {
  await main();
}
