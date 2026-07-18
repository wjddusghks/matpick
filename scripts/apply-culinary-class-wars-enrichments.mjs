import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "source-data", "culinary-class-wars");
const inputPath = path.join(sourceDir, "restaurants.json");
const candidatePath = path.join(sourceDir, "kakao-address-candidates.json");
const detailPath = path.join(sourceDir, "kakao-place-details.json");
const collectedAt = "2026-07-16";

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const manualMatches = {
  "culinary-class-wars-s1-43-1": {
    kakaoPlaceId: "1741047218",
    matchNote: "지점이 특정되지 않은 프랜차이즈 항목이라 도시곳간 본점을 연결",
  },
  "culinary-class-wars-s2-white-6": { kakaoPlaceId: "1572703534" },
  "culinary-class-wars-s2-white-7": { kakaoPlaceId: "18835270" },
  "culinary-class-wars-s2-white-14": { kakaoPlaceId: "1838545503" },
  "culinary-class-wars-s2-white-15": { kakaoPlaceId: "404432674" },
  "culinary-class-wars-s2-white-25": { kakaoPlaceId: "1052903179" },
  "culinary-class-wars-s2-white-28": {
    kakaoPlaceId: "1449183784",
    matchNote: "동명 제주점 자동 후보를 제외하고 연희점으로 교정",
  },
  "culinary-class-wars-s2-white-29": {
    kakaoPlaceId: "24065719",
    matchNote: "동명 제주점 자동 후보를 제외하고 합정점으로 교정",
  },
  "culinary-class-wars-s2-black-11": { kakaoPlaceId: "1797997961" },
  "culinary-class-wars-s2-black-12": { kakaoPlaceId: "995068389" },
  "culinary-class-wars-s2-black-13": { kakaoPlaceId: "1281283194" },
  "culinary-class-wars-s2-black-18": {
    kakaoPlaceId: "345093504",
    matchNote: "방송 정리 상호 독립식당의 현재 지도 상호 독립밀방을 연결",
  },
  "culinary-class-wars-s2-black-23": {
    kakaoPlaceId: "1952752710",
    address: "서울 강남구 도산대로55길 24 1층",
    lat: 37.5250720429425,
    lng: 127.040713439647,
    matchedPlaceName: "Original Numbers 청담",
    placeUrl: "https://www.catchtable.net/discovery/culinary-class-wars-2-restaurants-of-the-hottest-chefs-round-2-blackwhite-one-on-one-matches-3.html",
    addressSourceUrl: "https://www.catchtable.net/discovery/culinary-class-wars-2-restaurants-of-the-hottest-chefs-round-2-blackwhite-one-on-one-matches-3.html",
    menus: [
      { name: "런치 테이스팅 코스", price: "98,000원" },
      { name: "디너 테이스팅 코스", price: "130,000원" },
    ],
    menuSourceUrl: "https://www.diningcode.com/profile.php?rid=xI4P18VZ5m9d",
    matchNote: "같은 주소의 카카오 장소는 현재 칸티크로 표시되어 주소·좌표만 참고하고 상호와 메뉴는 별도 출처로 검증",
  },
  "culinary-class-wars-s2-black-33": {
    address: "서울 종로구 삼청로2길 40-5",
    lat: 37.5801813093084,
    lng: 126.980982059626,
    matchedPlaceName: "만가타",
    placeUrl: "https://www.diningcode.com/profile.php?rid=WfTXRbgTVZrA",
    addressSourceUrl: "https://mapz.dododo.co.kr/view.php?id=13070",
    menuSourceUrl: "https://www.diningcode.com/profile.php?rid=WfTXRbgTVZrA",
    matchNote: "지도 검색 결과가 없어 도로명 주소와 좌표를 별도 주소 검색으로 검증",
  },
};

function formatPrice(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0
    ? `${amount.toLocaleString("ko-KR")}원`
    : null;
}

function parseRepresentativeMenu(value = "") {
  return String(value)
    .split(/\s*\/\s*|(?<!\d),\s*(?!\d)/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const priceMatch = part.match(
        /(\d[\d,]*(?:\s*[-~]\s*\d[\d,]*)?\s*원|시가)/u
      );
      const price = priceMatch?.[1]?.replace(/\s+/g, " ") ?? null;
      const name = part
        .replace(priceMatch?.[0] ?? "", "")
        .replace(/\s+/g, " ")
        .trim();
      return { name: name || part, price };
    });
}

function normalizeMenus(items = []) {
  const seen = new Set();
  const normalized = items
    .map((item) => ({
      name: String(item?.name ?? "").replace(/\s+/g, " ").trim(),
      price:
        typeof item?.price === "number"
          ? formatPrice(item.price)
          : String(item?.price ?? "").replace(/\s+/g, " ").trim() || null,
    }))
    .filter((item) => item.name)
    .filter((item) => {
      const key = item.name.toLocaleLowerCase("ko-KR");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const priced = normalized.filter((item) => item.price);
  return (priced.length ? priced : normalized).slice(0, 15);
}

async function fetchKakaoPanel(placeId) {
  const url = `https://place-api.map.kakao.com/places/panel3/${placeId}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      appVersion: "6.6.0",
      pf: "PC",
      Origin: "https://place.map.kakao.com",
      Referer: `https://place.map.kakao.com/${placeId}`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36",
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
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
    homepages: Array.isArray(summary.homepages) ? summary.homepages : [],
    menus: normalizeMenus(menu.items ?? []),
    menusUpdatedAt: menu.items_updated_at ?? "",
    placeUpdatedAt: summary.meta?.updated_at ?? "",
    placeUrl: `https://place.map.kakao.com/${placeId}`,
  };
}

function menuEvidence(record, manual, detail, menus) {
  const sources = [];
  if (manual?.menuSourceUrl) {
    sources.push({ label: "메뉴·가격 확인", url: manual.menuSourceUrl });
  } else if (detail?.menus?.length) {
    sources.push({ label: "카카오맵 메뉴판", url: detail.placeUrl });
  } else if (record.listingUrl) {
    sources.push({ label: "방송 식당 정리", url: record.listingUrl });
  }
  return {
    menuPriceStatus: menus.length && menus.every((item) => item.price)
      ? "verified"
      : menus.some((item) => item.price)
        ? "partially-verified"
        : "price-unavailable",
    menuPriceVerifiedAt: collectedAt,
    menuPriceSources: sources,
  };
}

async function main() {
  const records = JSON.parse(await readFile(inputPath, "utf8"));
  const candidates = JSON.parse(await readFile(candidatePath, "utf8"));
  const candidateById = new Map(candidates.results.map((item) => [item.id, item]));
  const targets = records.filter(
    (record) =>
      !String(record.address ?? "").trim() ||
      record.reviewStatus === "address-menu-reviewed"
  );
  const targetIds = new Set(targets.map((record) => record.id));
  const detailByPlaceId = new Map();
  const errors = [];

  for (const [index, record] of targets.entries()) {
    const manual = manualMatches[record.id];
    const placeId = manual?.kakaoPlaceId ?? candidateById.get(record.id)?.selected?.kakaoPlaceId;
    if (!placeId || detailByPlaceId.has(placeId)) continue;
    try {
      const detail = await fetchKakaoPanel(placeId);
      detailByPlaceId.set(placeId, detail);
      console.log(`${index + 1}/${targets.length} ${record.restaurantName}: ${detail.name}`);
    } catch (error) {
      errors.push({
        id: record.id,
        restaurantName: record.restaurantName,
        kakaoPlaceId: placeId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await sleep(80);
  }

  const enriched = records.map((record) => {
    if (!targetIds.has(record.id)) return record;
    const manual = manualMatches[record.id] ?? {};
    const candidate = candidateById.get(record.id)?.selected ?? {};
    const placeId = manual.kakaoPlaceId ?? candidate.kakaoPlaceId;
    const detail = placeId ? detailByPlaceId.get(placeId) : null;
    const fallbackMenus = parseRepresentativeMenu(record.representativeMenu);
    const menus = normalizeMenus(
      manual.menus?.length
        ? manual.menus
        : detail?.menus?.length
          ? detail.menus
          : fallbackMenus
    );
    const address = manual.address ?? detail?.address ?? candidate.address ?? "";
    const lat = manual.lat ?? detail?.lat ?? candidate.lat ?? null;
    const lng = manual.lng ?? detail?.lng ?? candidate.lng ?? null;
    const placeUrl = manual.placeUrl ?? detail?.placeUrl ?? candidate.placeUrl ?? record.listingUrl;
    const matchedPlaceName = manual.matchedPlaceName ?? detail?.name ?? candidate.name ?? record.restaurantName;
    const addressSourceUrl = manual.addressSourceUrl ?? detail?.placeUrl ?? candidate.placeUrl ?? record.listingUrl;
    const extraNotes = [
      record.notes,
      manual.matchNote,
      matchedPlaceName && matchedPlaceName !== record.restaurantName
        ? `지도 매칭 상호: ${matchedPlaceName}`
        : "",
    ].filter(Boolean);

    return {
      ...record,
      address,
      lat,
      lng,
      phone: detail?.phone ?? candidate.phone ?? "",
      kakaoPlaceId: placeId ?? null,
      placeUrl,
      addressSourceUrl,
      matchedPlaceName,
      menus,
      representativeMenu:
        record.representativeMenu ||
        menus.slice(0, 4).map((item) => `${item.name}${item.price ? ` ${item.price}` : ""}`).join(", "),
      ...menuEvidence(record, manual, detail, menus),
      confidence: manual.addressSourceUrl ? 0.86 : manual.kakaoPlaceId ? 0.92 : 0.9,
      reviewStatus: "address-menu-reviewed",
      notes: extraNotes.join(" / "),
    };
  });

  const compactDetails = {
    source: "Kakao Maps place panel and manually reviewed secondary sources",
    collectedAt: new Date().toISOString(),
    targetCount: targets.length,
    kakaoDetailCount: detailByPlaceId.size,
    errors,
    details: Array.from(detailByPlaceId.values()),
  };

  await writeFile(inputPath, `${JSON.stringify(enriched, null, 2)}\n`, "utf8");
  await writeFile(detailPath, `${JSON.stringify(compactDetails, null, 2)}\n`, "utf8");

  const enrichedTargets = enriched.filter((record) => targets.some((target) => target.id === record.id));
  const missingAddress = enrichedTargets.filter((record) => !record.address).length;
  const missingMenus = enrichedTargets.filter((record) => !record.menus?.length).length;
  const missingAllPrices = enrichedTargets.filter(
    (record) => !record.menus?.some((item) => item.price)
  ).length;
  console.log(JSON.stringify({
    targetCount: targets.length,
    kakaoDetailCount: detailByPlaceId.size,
    errorCount: errors.length,
    missingAddress,
    missingMenus,
    missingAllPrices,
  }, null, 2));
}

await main();
