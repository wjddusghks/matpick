import fs from "node:fs";
import path from "node:path";
import { generatedDataRoot, sourceDataRoot } from "./source-dataset-paths.mjs";

const datasetId = "wednesday-gourmet";
const baseDatasetPath = path.join(generatedDataRoot, `${datasetId}.generated.json`);
const researchRoot = path.join(sourceDataRoot, datasetId, "menu-research");
const capturedAt = new Date().toISOString().slice(0, 10);
const regionPrefixes = new Set([
  "서울",
  "인천",
  "부산",
  "대구",
  "대전",
  "광주",
  "울산",
  "경기",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
  "세종",
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function readOption(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = Number.parseInt(process.argv[index + 1], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .trim();
}

function cleanRestaurantName(value) {
  let text = String(value ?? "").normalize("NFKC").trim();
  const [first, ...rest] = text.split(/\s+/);
  if (regionPrefixes.has(first) && rest.length > 0) text = rest.join(" ");
  text = text.replace(/\([^)]*(?:구|군|시|점|호점)[^)]*\)/g, "");
  return text.toLowerCase().replace(/[^가-힣a-z0-9]/g, "");
}

function cleanMenuName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/大/g, "대")
    .replace(/中/g, "중")
    .replace(/小/g, "소")
    .replace(/[^가-힣a-z0-9]/g, "");
}

function cleanPrice(value) {
  const digits = String(value ?? "").replace(/[^0-9]/g, "");
  return digits ? Number.parseInt(digits, 10) : null;
}

function formatPrice(value) {
  return `${Number(value).toLocaleString("ko-KR")}원`;
}

function levenshtein(left, right) {
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function nameSimilarity(left, right) {
  const a = cleanRestaurantName(left);
  const b = cleanRestaurantName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  }
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

function distanceKm(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const radius = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(value));
}

async function fetchText(url, options = {}, attempt = 0) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36",
        accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        ...(options.headers ?? {}),
      },
    });
    if (!response.ok) {
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await sleep(1500 * (attempt + 1));
        return fetchText(url, options, attempt + 1);
      }
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function findDiningCodeRestaurant(restaurant) {
  const endpoint = "https://im.diningcode.com/API/isearch/";
  const body = new URLSearchParams({
    mode: "poi",
    query: restaurant.name,
    from: "0",
    size: "10",
    token: "",
    lat: String(restaurant.lat ?? ""),
    lng: String(restaurant.lng ?? ""),
    rect: "",
  });
  const text = await fetchText(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body,
  });
  const response = JSON.parse(text);
  const candidates = response?.result_data?.poi_section?.list ?? [];

  return (
    candidates
      .map((candidate) => {
        const similarity = Math.max(
          nameSimilarity(restaurant.name, candidate.nm),
          nameSimilarity(
            restaurant.name,
            [candidate.nm, candidate.branch].filter(Boolean).join(" ")
          )
        );
        const distance = distanceKm(
          Number(restaurant.lat),
          Number(restaurant.lng),
          Number(candidate.lat),
          Number(candidate.lng)
        );
        return { ...candidate, similarity, distance };
      })
      .filter((candidate) => candidate.similarity >= 0.55 && candidate.distance <= 5)
      .sort(
        (left, right) =>
          right.similarity - left.similarity || left.distance - right.distance
      )[0] ?? null
  );
}

async function fetchDiningCodeMenus(candidate) {
  if (!candidate) return [];
  const url = `https://www.diningcode.com/profile.php?rid=${encodeURIComponent(candidate.v_rid)}`;
  const html = await fetchText(url);
  const scriptPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    try {
      const data = JSON.parse(match[1]);
      const items = data?.hasMenu?.hasMenuItem;
      if (!Array.isArray(items)) continue;
      return items
        .map((item, index) => ({
          name: String(item?.name ?? "").trim(),
          price: String(item?.offers?.price ?? "").trim(),
          isSignature: index === 0,
        }))
        .filter((item) => item.name && cleanPrice(item.price) !== null);
    } catch {
      // 일부 페이지에 여러 JSON-LD 블록이 있으므로 다음 블록을 시도합니다.
    }
  }
  return [];
}

function parseNaverMenus(html, restaurant) {
  const pattern = /<a href="https:\/\/map\.naver\.com\/p\/entry\/place\/(\d+)\?([^"<>]*placePath=%2Fmenu%2F[^"<>]*)"[^>]*>([\s\S]*?)<\/a>([\s\S]{0,2500}?)<div class="mkBm3"><em>([\s\S]*?)<\/em>원<\/div>/gi;
  const groups = new Map();

  for (const match of html.matchAll(pattern)) {
    const [, placeId, rawQuery, rawName, gap, rawPrice] = match;
    const query = decodeHtml(rawQuery);
    const params = new URLSearchParams(query);
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    const price = decodeHtml(rawPrice);
    if (cleanPrice(price) === null) continue;

    const group = groups.get(placeId) ?? { placeId, lat, lng, menus: [] };
    group.menus.push({
      name: decodeHtml(rawName),
      price: `${price.replace(/\s+/g, "")}원`,
      isSignature: gap.includes("place_blind\">대표"),
    });
    groups.set(placeId, group);
  }

  return (
    [...groups.values()]
      .map((group) => ({
        ...group,
        distance: distanceKm(
          Number(restaurant.lat),
          Number(restaurant.lng),
          group.lat,
          group.lng
        ),
      }))
      .filter((group) => group.distance <= 5)
      .sort(
        (left, right) =>
          left.distance - right.distance || right.menus.length - left.menus.length
      )[0] ?? null
  );
}

async function fetchNaverMenus(restaurant) {
  const query = `${restaurant.name} 메뉴 가격`;
  const searchUrl = `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(query)}`;
  const html = await fetchText(searchUrl, {
    headers: { "accept-language": "ko-KR,ko;q=0.9" },
  });
  return { searchUrl, group: parseNaverMenus(html, restaurant) };
}

function matchMenus(diningMenus, naverMenus) {
  const diningByName = new Map();
  for (const menu of diningMenus) {
    const key = cleanMenuName(menu.name);
    if (key && !diningByName.has(key)) diningByName.set(key, menu);
  }
  const verified = [];
  const conflicts = [];

  for (const naverMenu of naverMenus) {
    const diningMenu = diningByName.get(cleanMenuName(naverMenu.name));
    if (!diningMenu) continue;
    const diningPrice = cleanPrice(diningMenu.price);
    const naverPrice = cleanPrice(naverMenu.price);
    if (diningPrice === naverPrice) {
      verified.push({
        name: naverMenu.name,
        price: formatPrice(naverPrice),
        isSignature: naverMenu.isSignature || diningMenu.isSignature,
      });
    } else {
      conflicts.push({
        name: naverMenu.name,
        price: `${formatPrice(naverPrice)} / ${formatPrice(diningPrice)}`,
        isSignature: naverMenu.isSignature || diningMenu.isSignature,
      });
    }
  }

  return { verified, conflicts };
}

function uniqueMenus(menus) {
  const seen = new Set();
  return menus.filter((menu) => {
    const key = `${cleanMenuName(menu.name)}:${menu.price}`;
    if (!cleanMenuName(menu.name) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourceRecord(id, url, title, publisher, evidence) {
  return { id, url, title, publisher, capturedAt, evidence };
}

function buildResearchRecord(restaurant, diningCandidate, diningMenus, naverResult) {
  const naverMenus = naverResult.group?.menus ?? [];
  const { verified, conflicts } = matchMenus(diningMenus, naverMenus);
  const diningUrl = diningCandidate
    ? `https://www.diningcode.com/profile.php?rid=${encodeURIComponent(diningCandidate.v_rid)}`
    : `https://www.diningcode.com/list.dc?query=${encodeURIComponent(restaurant.name)}`;
  const naverUrl = naverResult.group
    ? `https://map.naver.com/p/entry/place/${naverResult.group.placeId}?placePath=/menu`
    : naverResult.searchUrl;
  const sources = [
    sourceRecord(
      "diningcode",
      diningUrl,
      `${restaurant.name} 메뉴 및 가격`,
      "다이닝코드",
      diningMenus.length > 0
        ? `가격이 있는 메뉴 ${diningMenus.length}개 확인`
        : "일치하는 식당의 가격 메뉴를 찾지 못함"
    ),
    sourceRecord(
      "naver",
      naverUrl,
      `${restaurant.name} 네이버 플레이스 메뉴`,
      "네이버 플레이스",
      naverMenus.length > 0
        ? `가격이 있는 메뉴 ${naverMenus.length}개 확인`
        : "검색 결과에서 가격 메뉴를 찾지 못함"
    ),
  ];

  let status = "not-found";
  let representativeMenu = "";
  let menus = [];
  let notes = "두 조사 출처에서 가격이 표시된 메뉴를 찾지 못함.";
  let verifiedAt = null;

  if (verified.length > 0) {
    status = "verified";
    menus = uniqueMenus(verified)
      .slice(0, 12)
      .map((menu) => ({
        ...menu,
        evidenceSourceIds: ["diningcode", "naver"],
        observedAt: capturedAt,
        confidence: 92,
      }));
    representativeMenu =
      menus.find((menu) => menu.isSignature)?.name ?? menus[0].name;
    notes = `다이닝코드와 네이버 플레이스에서 메뉴명과 가격이 일치한 ${menus.length}개 항목을 반영함.`;
    if (conflicts.length > 0) {
      notes += ` 같은 이름이지만 가격이 다른 ${conflicts.length}개 항목은 제외함.`;
    }
    verifiedAt = capturedAt;
  } else if (conflicts.length > 0 || diningMenus.length > 0 || naverMenus.length > 0) {
    status = "needs-review";
    const candidates = conflicts.length
      ? conflicts
      : [
          ...naverMenus.map((menu) => ({ ...menu, sourceId: "naver" })),
          ...diningMenus.map((menu) => ({ ...menu, sourceId: "diningcode" })),
        ];
    menus = uniqueMenus(candidates)
      .slice(0, 12)
      .map((menu) => ({
        name: menu.name,
        price: menu.price,
        isSignature: Boolean(menu.isSignature),
        evidenceSourceIds: menu.sourceId
          ? [menu.sourceId]
          : ["diningcode", "naver"],
        observedAt: capturedAt,
        confidence: conflicts.length > 0 ? 55 : 65,
      }));
    representativeMenu =
      menus.find((menu) => menu.isSignature)?.name ?? menus[0]?.name ?? "";
    notes = conflicts.length
      ? `두 출처에서 같은 메뉴명의 가격이 달라 재검토가 필요함 (${conflicts.length}개 충돌).`
      : "가격 메뉴는 찾았지만 두 출처에서 같은 메뉴명·가격을 교차 확인하지 못함.";
  }

  return {
    schemaVersion: 1,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    address: restaurant.address,
    status,
    representativeMenu,
    menus,
    sources,
    verifiedAt,
    notes,
  };
}

function researchFilePath(restaurant) {
  const ordinal = restaurant.id.match(/_(\d+)$/)?.[1] ?? restaurant.id;
  return path.join(researchRoot, `${ordinal}-${restaurant.id}.json`);
}

async function collectRestaurant(restaurant, existingRecord = null) {
  let diningCandidate = null;
  let diningMenus = [];
  let naverResult = { searchUrl: "", group: null };
  const errors = [];

  try {
    const existingDiningUrl = existingRecord?.sources?.find(
      (source) => source.id === "diningcode"
    )?.url;
    const existingRid = existingDiningUrl?.match(/[?&]rid=([^&]+)/)?.[1];
    diningCandidate = existingRid
      ? { v_rid: decodeURIComponent(existingRid) }
      : await findDiningCodeRestaurant(restaurant);
    diningMenus = await fetchDiningCodeMenus(diningCandidate);
  } catch (error) {
    errors.push(`다이닝코드: ${error.message}`);
  }

  try {
    naverResult = await fetchNaverMenus(restaurant);
  } catch (error) {
    errors.push(`네이버: ${error.message}`);
    naverResult.searchUrl = `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(`${restaurant.name} 메뉴 가격`)}`;
  }

  const record = buildResearchRecord(
    restaurant,
    diningCandidate,
    diningMenus,
    naverResult
  );
  if (errors.length > 0) record.notes += ` 수집 오류: ${errors.join("; ")}`;
  return record;
}

async function main() {
  const baseDataset = readJson(baseDatasetPath);
  fs.mkdirSync(researchRoot, { recursive: true });
  const overwrite = process.argv.includes("--overwrite");
  const retryNaverErrors = process.argv.includes("--retry-naver-errors");
  const all = process.argv.includes("--all");
  const limit = all ? Number.POSITIVE_INFINITY : readOption("--limit", 20);
  const concurrency = Math.min(readOption("--concurrency", 2), 4);
  const delayMs = readOption("--delay-ms", 700);
  const restaurantIdIndex = process.argv.indexOf("--restaurant-id");
  const restaurantId =
    restaurantIdIndex === -1 ? "" : process.argv[restaurantIdIndex + 1] ?? "";
  const pending = baseDataset.restaurants
    .filter((restaurant) => !restaurantId || restaurant.id === restaurantId)
    .filter((restaurant) => {
      const filePath = researchFilePath(restaurant);
      if (retryNaverErrors) {
        return (
          fs.existsSync(filePath) &&
          readJson(filePath).notes?.includes("403 Forbidden")
        );
      }
      return overwrite || !fs.existsSync(filePath);
    })
    .slice(0, limit);

  console.log(
    `수집 대상 ${pending.length}곳 / 동시 처리 ${concurrency} / 식당별 대기 ${delayMs}ms`
  );
  let nextIndex = 0;
  let completed = 0;

  async function worker() {
    while (nextIndex < pending.length) {
      const restaurant = pending[nextIndex];
      nextIndex += 1;
      const filePath = researchFilePath(restaurant);
      const existingRecord = fs.existsSync(filePath) ? readJson(filePath) : null;
      const record = await collectRestaurant(restaurant, existingRecord);
      fs.writeFileSync(
        researchFilePath(restaurant),
        `${JSON.stringify(record, null, 2)}\n`,
        "utf8"
      );
      completed += 1;
      console.log(
        `[${completed}/${pending.length}] ${restaurant.id} ${record.status} 메뉴 ${record.menus.length}개`
      );
      await sleep(delayMs);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log(`수집 완료: ${completed}곳`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
