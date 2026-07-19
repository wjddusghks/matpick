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
const datasetInputs = {
  "sikgaek-baekban-trip": [
    path.join(projectRoot, "client", "src", "data", "generated", "sikgaek-baekban-trip.generated.json"),
  ],
  "wednesday-gourmet": [
    path.join(projectRoot, "client", "src", "data", "generated", "wednesday-gourmet.generated.json"),
  ],
  ttoganjip: [path.join(topicEnrichmentRoot, "ttoganjip.enriched.json")],
  "baekjong-wok": [path.join(topicEnrichmentRoot, "baekjong-wok.enriched.json")],
  "old-korean-100": [path.join(topicEnrichmentRoot, "old-korean-100.enriched.json")],
  "popular-restaurants": [
    path.join(topicEnrichmentRoot, "popular-restaurants.enriched.json"),
  ],
  "michelin-3-stars": [path.join(topicEnrichmentRoot, "michelin-3-stars.enriched.json")],
  "michelin-2-stars": [path.join(topicEnrichmentRoot, "michelin-2-stars.enriched.json")],
  "michelin-1-star": [path.join(topicEnrichmentRoot, "michelin-1-star.enriched.json")],
  "michelin-bib-gourmand": [
    path.join(topicEnrichmentRoot, "michelin-bib-gourmand.enriched.json"),
  ],
  "michelin-selected": [path.join(topicEnrichmentRoot, "michelin-selected.enriched.json")],
};
const supportedDatasetIds = new Set(Object.keys(datasetInputs));
const datasetArgumentIndex = process.argv.indexOf("--dataset");
const datasetId =
  datasetArgumentIndex >= 0 ? process.argv[datasetArgumentIndex + 1] : "sikgaek-baekban-trip";
if (!supportedDatasetIds.has(datasetId)) {
  throw new Error(`Unsupported dataset: ${datasetId}`);
}
const outputPath = path.join(
  workspaceRoot,
  "source-data",
  datasetId,
  "menu-prices.json"
);
const generatedDataRoot = path.join(
  projectRoot,
  "client",
  "src",
  "data",
  "generated"
);
const appDataPath = path.join(
  projectRoot,
  "client",
  "src",
  "data",
  "matpick-data.json"
);
const localFallbackDatasets = [
  ["sikgaek-baekban-trip", path.join(generatedDataRoot, "sikgaek-baekban-trip.generated.json")],
  ["wednesday-gourmet", path.join(generatedDataRoot, "wednesday-gourmet.generated.json")],
  ["baekjong-wok", path.join(generatedDataRoot, "baekjong-wok.generated.json")],
  ["old-korean-100", path.join(generatedDataRoot, "old-korean-100.generated.json")],
  ["seoul-taste-100", path.join(generatedDataRoot, "seoul-taste-100.generated.json")],
  ["matpick", appDataPath],
  ["ttoganjip", path.join(topicEnrichmentRoot, "ttoganjip.enriched.json")],
  ["baekjong-wok", path.join(topicEnrichmentRoot, "baekjong-wok.enriched.json")],
  ["old-korean-100", path.join(topicEnrichmentRoot, "old-korean-100.enriched.json")],
  ["popular-restaurants", path.join(topicEnrichmentRoot, "popular-restaurants.enriched.json")],
  ["michelin-3-stars", path.join(topicEnrichmentRoot, "michelin-3-stars.enriched.json")],
  ["michelin-2-stars", path.join(topicEnrichmentRoot, "michelin-2-stars.enriched.json")],
  ["michelin-1-star", path.join(topicEnrichmentRoot, "michelin-1-star.enriched.json")],
  ["michelin-bib-gourmand", path.join(topicEnrichmentRoot, "michelin-bib-gourmand.enriched.json")],
  ["michelin-selected", path.join(topicEnrichmentRoot, "michelin-selected.enriched.json")],
];

const SEARCH_ENDPOINT = "https://search.map.kakao.com/mapsearch/map.daum";
const PANEL_ENDPOINT = "https://place-api.map.kakao.com/places/panel3";
const DEFAULT_CONCURRENCY = 6;
const REQUEST_TIMEOUT_MS = 20_000;
const MATCH_THRESHOLD = 210;
const STRONG_MATCH_THRESHOLD = 300;

const searchHeaders = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko,en-US;q=0.9,en;q=0.8",
  Referer: "https://map.kakao.com/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/146 Safari/537.36",
};

const panelHeaders = {
  ...searchHeaders,
  appVersion: "6.6.0",
  Origin: "https://place.map.kakao.com",
  pf: "PC",
  Referer: "https://place.map.kakao.com/",
};

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function parseArgs(argv) {
  const options = {
    concurrency: DEFAULT_CONCURRENCY,
    limit: Number.POSITIVE_INFINITY,
    refresh: false,
    retryUnmatched: false,
    reuseLocal: false,
    missingOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--refresh") options.refresh = true;
    if (argument === "--retry-unmatched") options.retryUnmatched = true;
    if (argument === "--reuse-local") options.reuseLocal = true;
    if (argument === "--missing-only") options.missingOnly = true;
    if (argument === "--dataset") index += 1;
    if (argument === "--concurrency") {
      options.concurrency = Math.max(1, Number(argv[index + 1]) || 1);
      index += 1;
    }
    if (argument === "--limit") {
      options.limit = Math.max(1, Number(argv[index + 1]) || 1);
      index += 1;
    }
  }

  return options;
}

function normalize(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, "앤드")
    .replace(/셰프/g, "쉐프")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function isKnownClosedRestaurant(restaurant) {
  return /(?:폐업|영업\s*종료)/.test(String(restaurant?.name ?? ""));
}

function toClosedRecord(restaurant) {
  return {
    name: restaurant.name,
    address: restaurant.address,
    status: "closed",
    operationStatus: "폐업",
    verifiedAt: new Date().toISOString(),
    note: "원본 식당명에 폐업으로 명시되어 맛픽 공개 목록에서 제외함.",
    menus: [],
  };
}

function tokenizeAddress(value = "") {
  return Array.from(
    new Set(
      String(value)
        .normalize("NFKC")
        .toLowerCase()
        .replace(/\([^)]*\)/g, " ")
        .replace(/[(),]/g, " ")
        .match(/[\p{L}\p{N}-]+/gu) ?? []
    )
  );
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

function getProvince(address = "") {
  const first = tokenizeAddress(address)[0] ?? "";
  const aliases = {
    서울특별시: "서울",
    부산광역시: "부산",
    대구광역시: "대구",
    인천광역시: "인천",
    광주광역시: "광주",
    대전광역시: "대전",
    울산광역시: "울산",
    세종특별자치시: "세종",
    경기도: "경기",
    강원특별자치도: "강원",
    강원도: "강원",
    충청북도: "충북",
    충청남도: "충남",
    전북특별자치도: "전북",
    전라북도: "전북",
    전라남도: "전남",
    경상북도: "경북",
    경상남도: "경남",
    제주특별자치도: "제주",
    전남광주통합특별시: "전남광주",
  };
  return aliases[first] ?? first;
}

function provincesMatch(left, right) {
  if (!left || !right || left === right) return true;
  if (left === "전남광주" && ["전남", "광주"].includes(right)) return true;
  if (right === "전남광주" && ["전남", "광주"].includes(left)) return true;
  return false;
}

function getAdministrativeToken(address = "", suffix) {
  return (
    tokenizeAddress(address)
      .slice(1)
      .find((token) => token.endsWith(suffix)) ?? ""
  );
}

function getNameVariants(restaurant) {
  const addressTokens = new Set(tokenizeAddress(restaurant.address));
  const rawVariants = [
    restaurant.name,
    restaurant.name.replace(/\([^)]*\)/g, " ").trim(),
  ];
  const nameTokens = restaurant.name.split(/\s+/).filter(Boolean);

  const leadingToken = normalize(nameTokens[0] ?? "");
  const leadingTokenIsLocality = Array.from(addressTokens).some((token) => {
    const normalizedToken = normalize(token);
    return (
      leadingToken &&
      (normalizedToken === leadingToken ||
        normalizedToken.startsWith(leadingToken) ||
        leadingToken.startsWith(normalizedToken))
    );
  });

  if (nameTokens.length > 1 && leadingTokenIsLocality) {
    rawVariants.push(nameTokens.slice(1).join(" "));
  }

  return Array.from(new Set(rawVariants.map(normalize).filter(Boolean)));
}

function haversineMeters(leftLat, leftLng, rightLat, rightLng) {
  const coordinates = [leftLat, leftLng, rightLat, rightLng].map(Number);
  if (coordinates.some((value) => !Number.isFinite(value) || value === 0)) {
    return null;
  }

  const [lat1, lng1, lat2, lng2] = coordinates;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function scoreCandidate(restaurant, candidate) {
  const candidateName = normalize(candidate.name);
  const variants = getNameVariants(restaurant);
  let nameScore = 0;

  for (const variant of variants) {
    if (variant === candidateName) {
      nameScore = Math.max(nameScore, 180);
      continue;
    }

    if (variant.includes(candidateName) || candidateName.includes(variant)) {
      const ratio =
        Math.min(variant.length, candidateName.length) /
        Math.max(variant.length, candidateName.length);
      nameScore = Math.max(nameScore, Math.round(90 + ratio * 80));
    }

    nameScore = Math.max(
      nameScore,
      Math.round(bigramDice(variant, candidateName) * 125)
    );
  }

  const candidateAddress = [candidate.new_address, candidate.address]
    .filter(Boolean)
    .join(" ");
  const seedTokens = new Set(tokenizeAddress(restaurant.address));
  const candidateTokens = new Set(tokenizeAddress(candidateAddress));
  let addressScore = 0;

  for (const token of seedTokens) {
    if (!candidateTokens.has(token)) continue;
    if (/^\d+(?:-\d+)?$/.test(token)) addressScore += 45;
    else if (/\d/.test(token)) addressScore += 28;
    else if (/(로|길)$/.test(token)) addressScore += 32;
    else if (/(동|가|읍|면|리)$/.test(token)) addressScore += 18;
    else if (/(구|시|군)$/.test(token)) addressScore += 15;
    else addressScore += 4;
  }
  addressScore = Math.min(addressScore, 145);

  const distanceMeters = haversineMeters(
    restaurant.lat,
    restaurant.lng,
    candidate.lat,
    candidate.lon ?? candidate.lng
  );
  let distanceScore = 0;
  if (distanceMeters != null) {
    if (distanceMeters <= 100) distanceScore = 140;
    else if (distanceMeters <= 300) distanceScore = 105;
    else if (distanceMeters <= 800) distanceScore = 70;
    else if (distanceMeters <= 2_000) distanceScore = 30;
    else if (distanceMeters > 10_000) distanceScore = -220;
    else if (distanceMeters > 3_000) distanceScore = -90;
  }

  const seedProvince = getProvince(restaurant.address);
  const candidateProvince = getProvince(candidateAddress);
  const seedDistrict = getAdministrativeToken(restaurant.address, "구");
  const candidateDistrict = getAdministrativeToken(candidateAddress, "구");
  const seedCity = getAdministrativeToken(restaurant.address, "시");
  const candidateCity = getAdministrativeToken(candidateAddress, "시");
  let localityPenalty = 0;

  if (!provincesMatch(seedProvince, candidateProvince)) localityPenalty -= 160;
  if (seedDistrict && candidateDistrict && seedDistrict !== candidateDistrict) {
    localityPenalty -= 80;
  }
  if (seedCity && candidateCity && seedCity !== candidateCity) {
    localityPenalty -= 60;
  }

  return {
    total: nameScore + addressScore + distanceScore + localityPenalty,
    nameScore,
    addressScore,
    distanceScore,
    localityPenalty,
    distanceMeters:
      distanceMeters == null ? null : Math.round(distanceMeters),
  };
}

function hasPlausibleNameMatch(leftName, rightName) {
  const left = normalize(leftName);
  const right = normalize(rightName);
  if (!left || !right) return false;
  if (left === right) return true;
  if (Math.min(left.length, right.length) >= 3 && (left.includes(right) || right.includes(left))) {
    return true;
  }

  const removeGenericParts = (value) =>
    value.replace(/(?:본점|직영점|분점|지점|서울|부산|대구|인천|광주|대전|울산|식당|레스토랑|호텔)/g, "");
  const leftCore = removeGenericParts(left);
  const rightCore = removeGenericParts(right);
  if (!leftCore || !rightCore) return false;
  if (
    Math.min(leftCore.length, rightCore.length) >= 3 &&
    (leftCore.includes(rightCore) || rightCore.includes(leftCore))
  ) {
    return true;
  }

  return bigramDice(leftCore, rightCore) >= 0.48;
}

function isAcceptableMatch(restaurant, candidate, score) {
  if (!hasPlausibleNameMatch(restaurant.name, candidate?.name)) {
    return false;
  }
  const hasCoordinates = Boolean(restaurant.lat && restaurant.lng);
  if (
    hasCoordinates &&
    score.distanceMeters != null &&
    score.distanceMeters > 300 &&
    score.addressScore < 80
  ) {
    return false;
  }
  const locationConfirmed = hasCoordinates
    ? score.distanceMeters != null && score.distanceMeters <= 1_200
    : score.addressScore >= 50;
  const standardNameMatch =
    score.total >= MATCH_THRESHOLD &&
    score.nameScore >= 80 &&
    (locationConfirmed || score.addressScore >= 60);
  const sameAddressNameVariant =
    score.total >= 260 &&
    score.nameScore >= 40 &&
    score.addressScore >= 90 &&
    score.distanceMeters != null &&
    score.distanceMeters <= 100;
  return standardNameMatch || sameAddressNameVariant;
}

async function fetchWithRetry(url, headers, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`HTTP ${response.status}`);
      }
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.nonRetryable = response.status === 404;
        throw error;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (error.nonRetryable || attempt === attempts) break;
      await sleep(350 * attempt);
    }
  }
  throw lastError;
}

async function searchKakao(query) {
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("msFlag", "A");
  url.searchParams.set("sort", "0");
  const response = await fetchWithRetry(url, searchHeaders);
  const data = await response.json();
  return Array.isArray(data.place) ? data.place : [];
}

async function fetchPanel(confirmId) {
  const response = await fetchWithRetry(
    `${PANEL_ENDPOINT}/${confirmId}`,
    panelHeaders
  );
  return response.json();
}

function buildQueries(restaurant) {
  const variants = getNameVariants(restaurant);
  const region = restaurant.region || tokenizeAddress(restaurant.address).slice(0, 2).join(" ");
  return Array.from(
    new Set(
      [restaurant.name, ...variants]
        .map((name) => `${name} ${region}`.trim())
        .filter(Boolean)
    )
  );
}

async function matchRestaurant(restaurant) {
  const candidatesById = new Map();

  for (const query of buildQueries(restaurant)) {
    const candidates = await searchKakao(query);
    for (const candidate of candidates) {
      if (!candidate?.confirmid || !candidate?.name) continue;
      const score = scoreCandidate(restaurant, candidate);
      const current = candidatesById.get(String(candidate.confirmid));
      if (!current || score.total > current.score.total) {
        candidatesById.set(String(candidate.confirmid), {
          candidate,
          query,
          score,
        });
      }
    }

    const best = Array.from(candidatesById.values()).sort(
      (left, right) => right.score.total - left.score.total
    )[0];
    if (best?.score.total >= STRONG_MATCH_THRESHOLD) break;
  }

  const ranked = Array.from(candidatesById.values()).sort(
    (left, right) => right.score.total - left.score.total
  );
  const selected = ranked.find(({ candidate, score }) =>
    isAcceptableMatch(restaurant, candidate, score)
  );
  return { selected, ranked };
}

function toPanelCandidate(panel) {
  return {
    name: panel?.summary?.name ?? "",
    new_address: panel?.summary?.address?.road ?? "",
    address: panel?.summary?.address?.disp ?? "",
    lat: panel?.summary?.point?.lat ?? 0,
    lon: panel?.summary?.point?.lon ?? 0,
  };
}

function formatPrice(value) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0
    ? `${price.toLocaleString("ko-KR")}원`
    : "";
}

function normalizeMenus(restaurant, panel) {
  const items = panel?.menu?.menus?.items;
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      name: String(item?.name ?? "").trim(),
      price: formatPrice(item?.price),
      description: String(item?.ai_mate_desc ?? "").trim() || undefined,
      isSignature: Boolean(item?.is_recommend),
      sourceUpdatedAt: String(item?.mod_at ?? "").trim(),
    }))
    .filter((menu) => menu.name && menu.price)
    .map((menu, index) => ({
      id: `${restaurant.id}_menu_${String(index + 1).padStart(3, "0")}`,
      ...menu,
      isSignature: menu.isSignature || index === 0,
      sourceOrdinal: index + 1,
    }));
}

function normalizeLocalMenus(restaurant, sourceMenus) {
  return sourceMenus
    .map((menu) => ({
      name: String(menu?.name ?? "").trim(),
      price: String(menu?.price ?? "").trim(),
      description: String(menu?.description ?? "").trim() || undefined,
      isSignature: Boolean(menu?.isSignature),
    }))
    .filter((menu) => menu.name && menu.price)
    .map((menu, index) => ({
      id: `${restaurant.id}_menu_${String(index + 1).padStart(3, "0")}`,
      ...menu,
      isSignature: menu.isSignature || index === 0,
      sourceOrdinal: index + 1,
    }));
}

async function loadLocalFallbackCandidates() {
  const candidates = [];
  for (const [datasetId, filePath] of localFallbackDatasets) {
    const data = JSON.parse(
      (await fs.readFile(filePath, "utf8")).replace(/^\uFEFF/, "")
    );
    for (const restaurant of data.restaurants ?? []) {
      if (!(restaurant.menus ?? []).some((menu) => menu?.price)) continue;
      candidates.push({ datasetId, restaurant });
    }
  }
  return candidates;
}

function findLocalFallback(restaurant, candidates) {
  return candidates
    .filter((candidate) =>
      hasPlausibleNameMatch(restaurant.name, candidate.restaurant.name)
    )
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate(restaurant, {
        name: candidate.restaurant.name,
        new_address: candidate.restaurant.address,
        address: candidate.restaurant.officialDescriptionAddress ?? "",
        lat: candidate.restaurant.lat,
        lon: candidate.restaurant.lng,
      }),
    }))
    .filter(({ score }) => {
      const locationConfirmed =
        (score.distanceMeters != null && score.distanceMeters <= 180) ||
        score.addressScore >= 80;
      return score.total >= 260 && score.nameScore >= 100 && locationConfirmed;
    })
    .sort((left, right) => right.score.total - left.score.total)[0];
}

function toLocalFallbackRecord(restaurant, fallback) {
  const sourceRestaurant = fallback.restaurant;
  const menus = normalizeLocalMenus(restaurant, sourceRestaurant.menus ?? []);
  return {
    name: restaurant.name,
    address: restaurant.address,
    status: "matched_with_priced_menu_cross_dataset",
    verifiedAt: new Date().toISOString(),
    representativeMenu: menus
      .slice(0, 3)
      .map((menu) => menu.name)
      .join(" / "),
    note: `식당명·주소·좌표가 일치하는 맛픽 ${fallback.datasetId} 데이터의 검증 메뉴·가격을 재사용함.`,
    sourceDatasetId: fallback.datasetId,
    sourceRestaurantId: sourceRestaurant.id,
    sourceUrl: sourceRestaurant.sourceUrls?.[0] ?? sourceRestaurant.placeUrl ?? "",
    placeUrl: sourceRestaurant.placeUrl ?? "",
    kakaoPlaceId: sourceRestaurant.kakaoPlaceId ?? "",
    pageName: sourceRestaurant.name,
    pageAddress: sourceRestaurant.address,
    phone: sourceRestaurant.phone ?? "",
    operationStatus: sourceRestaurant.operationStatus ?? "",
    menuUpdatedAt:
      sourceRestaurant.menuPriceVerifiedAt ??
      sourceRestaurant.detailCollectedAt ??
      "",
    match: fallback.score,
    menus,
  };
}

async function enrichRestaurant(restaurant) {
  try {
    const { selected, ranked } = await matchRestaurant(restaurant);
    if (!selected) {
      return {
        name: restaurant.name,
        address: restaurant.address,
        status: "unmatched",
        verifiedAt: new Date().toISOString(),
        menus: [],
        candidates: ranked.slice(0, 3).map(({ candidate, query, score }) => ({
          kakaoPlaceId: String(candidate.confirmid),
          name: candidate.name,
          address: candidate.new_address || candidate.address || "",
          query,
          ...score,
        })),
      };
    }

    const { candidate, query, score } = selected;
    const panel = await fetchPanel(candidate.confirmid);
    const panelScore = scoreCandidate(restaurant, toPanelCandidate(panel));
    if (!isAcceptableMatch(restaurant, toPanelCandidate(panel), panelScore)) {
      return {
        name: restaurant.name,
        address: restaurant.address,
        status: "panel_mismatch",
        verifiedAt: new Date().toISOString(),
        menus: [],
        selectedCandidate: {
          kakaoPlaceId: String(candidate.confirmid),
          name: candidate.name,
          address: candidate.new_address || candidate.address || "",
          query,
          ...score,
        },
        panelCandidate: {
          name: panel?.summary?.name ?? "",
          address: panel?.summary?.address?.disp ?? "",
          ...panelScore,
        },
      };
    }

    const menus = normalizeMenus(restaurant, panel);
    const panelStatus = panel?.summary?.status ?? "";
    return {
      name: restaurant.name,
      address: restaurant.address,
      status:
        menus.length > 0 ? "matched_with_priced_menu" : "matched_no_priced_menu",
      verifiedAt: new Date().toISOString(),
      representativeMenu: menus
        .slice(0, 3)
        .map((menu) => menu.name)
        .join(" / "),
      note:
        menus.length > 0
          ? "카카오맵 공개 장소 패널의 메뉴·가격을 식당명과 주소로 검증함."
          : "장소는 확인됐으나 가격이 있는 공개 메뉴가 없음.",
      sourceUrl: `${PANEL_ENDPOINT}/${candidate.confirmid}`,
      placeUrl: `https://place.map.kakao.com/${candidate.confirmid}`,
      kakaoPlaceId: String(candidate.confirmid),
      pageName: panel?.summary?.name ?? candidate.name,
      pageAddress:
        panel?.summary?.address?.disp ??
        candidate.new_address ??
        candidate.address ??
        "",
      phone: panel?.summary?.phone_numbers?.[0]?.tel ?? candidate.tel ?? "",
      operationStatus: panelStatus === "Y" ? "영업" : panelStatus,
      menuUpdatedAt: panel?.menu?.menus?.items_updated_at ?? "",
      match: { query, ...panelScore },
      menus,
    };
  } catch (error) {
    return {
      name: restaurant.name,
      address: restaurant.address,
      status: "error",
      verifiedAt: new Date().toISOString(),
      menus: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readOptionalJson(filePath, fallback) {
  try {
    return JSON.parse((await fs.readFile(filePath, "utf8")).replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function needsMenuResearch(restaurant) {
  const menus = Array.isArray(restaurant?.menus) ? restaurant.menus : [];
  return menus.length === 0 || menus.some((menu) => !String(menu?.price ?? "").trim());
}

async function loadDataset() {
  const restaurants = [];
  const seenIds = new Set();

  for (const inputPath of datasetInputs[datasetId]) {
    const payload = JSON.parse(
      (await fs.readFile(inputPath, "utf8")).replace(/^\uFEFF/, "")
    );

    for (const restaurant of payload.restaurants ?? []) {
      if (!restaurant?.id || seenIds.has(restaurant.id)) continue;
      seenIds.add(restaurant.id);
      restaurants.push(restaurant);
    }
  }

  return { datasetId, restaurants };
}

function buildOutput(restaurants, records, runStatus) {
  const values = Object.values(records);
  return {
    source: "Kakao Maps public place search and place panel",
    collectedAt: new Date().toISOString(),
    runStatus,
    matchingMethod: "restaurant name + address + coordinate distance",
    totalRestaurantCount: values.length,
    processedCount: values.length,
    matchedCount: values.filter((record) =>
      record.status.startsWith("matched_")
    ).length,
    pricedRestaurantCount: values.filter(
      (record) => (record.menus?.length ?? 0) > 0
    ).length,
    pricedMenuCount: values.reduce(
      (count, record) => count + (record.menus?.length ?? 0),
      0
    ),
    unmatchedCount: values.filter((record) => record.status === "unmatched")
      .length,
    closedCount: values.filter((record) => record.status === "closed").length,
    errorCount: values.filter((record) => record.status === "error").length,
    restaurants: records,
  };
}

async function writeCheckpoint(restaurants, records, runStatus) {
  const output = buildOutput(restaurants, records, runStatus);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dataset = await loadDataset();
  const targetRestaurants = options.missingOnly
    ? dataset.restaurants.filter(needsMenuResearch)
    : dataset.restaurants;
  const targetIds = new Set(targetRestaurants.map((restaurant) => restaurant.id));
  const previous = await readOptionalJson(outputPath, { restaurants: {} });
  const records = options.refresh
    ? {}
    : Object.fromEntries(
        Object.entries(previous.restaurants ?? {}).filter(([id]) => targetIds.has(id))
      );
  for (const restaurant of targetRestaurants) {
    if (isKnownClosedRestaurant(restaurant)) {
      records[restaurant.id] = toClosedRecord(restaurant);
    }
  }
  if (options.reuseLocal) {
    const fallbackCandidates = await loadLocalFallbackCandidates();
    let reusedCount = 0;
    for (const restaurant of targetRestaurants) {
      const current = records[restaurant.id];
      if (
        current &&
        !["unmatched", "panel_mismatch", "error", "matched_no_priced_menu"].includes(
          current.status
        )
      ) {
        continue;
      }
      const fallback = findLocalFallback(restaurant, fallbackCandidates);
      if (!fallback) continue;
      records[restaurant.id] = toLocalFallbackRecord(restaurant, fallback);
      reusedCount += 1;
    }
    await writeCheckpoint(targetRestaurants, records, "partial");
    console.log(`Reused local priced menus for ${reusedCount} restaurants.`);
    return;
  }
  const pending = targetRestaurants
    .filter(
      (restaurant) =>
        !isKnownClosedRestaurant(restaurant) &&
        (options.refresh ||
          !records[restaurant.id] ||
          (options.retryUnmatched &&
            ["unmatched", "panel_mismatch", "error"].includes(
              records[restaurant.id]?.status
            )))
    )
    .slice(0, options.limit);

  console.log(
    `Restaurants: ${dataset.restaurants.length}, targets: ${targetRestaurants.length}, cached: ${Object.keys(records).length}, pending: ${pending.length}`
  );

  for (let index = 0; index < pending.length; index += options.concurrency) {
    const batch = pending.slice(index, index + options.concurrency);
    const enriched = await Promise.all(
      batch.map(async (restaurant) => ({
        id: restaurant.id,
        record: await enrichRestaurant(restaurant),
      }))
    );

    for (const { id, record } of enriched) records[id] = record;
    await writeCheckpoint(targetRestaurants, records, "in_progress");

    const processed = Math.min(index + batch.length, pending.length);
    const values = Object.values(records);
    console.log(
      `Processed ${processed}/${pending.length} this run (${values.length}/${targetRestaurants.length} total): ` +
        `${values.filter((record) => (record.menus?.length ?? 0) > 0).length} with prices, ` +
        `${values.filter((record) => record.status === "matched_no_priced_menu").length} matched without prices, ` +
        `${values.filter((record) => record.status === "unmatched").length} unmatched, ` +
        `${values.filter((record) => record.status === "error").length} errors`
    );
    await sleep(120);
  }

  const isComplete = Object.keys(records).length >= targetRestaurants.length;
  await writeCheckpoint(
    targetRestaurants,
    records,
    isComplete ? "complete" : "partial"
  );
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
