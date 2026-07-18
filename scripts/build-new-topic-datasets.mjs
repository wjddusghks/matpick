import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const generatedRoot = path.join(root, "matpick_all", "client", "src", "data", "generated");

async function readJson(filePath) {
  return JSON.parse((await readFile(filePath, "utf8")).replace(/^\uFEFF/, ""));
}

function normalize(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hash(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function restaurantKey(name, address) {
  return `${normalize(name).toLowerCase()}|${normalize(address).toLowerCase()}`;
}

function collectMenus(records) {
  const menus = new Map();
  for (const record of records) {
    for (const menu of record.menus ?? []) {
      const name = normalize(menu.name);
      if (!name) continue;
      const key = name.toLocaleLowerCase("ko-KR");
      const current = menus.get(key);
      if (!current || (!current.price && menu.price)) {
        menus.set(key, { name, price: normalize(menu.price) || null });
      }
    }
  }
  if (!menus.size) {
    for (const name of new Set(
      records.map((record) => normalize(record.representativeMenu)).filter(Boolean)
    )) {
      menus.set(name.toLocaleLowerCase("ko-KR"), { name, price: null });
    }
  }
  return [...menus.values()];
}

function firstValue(records, key) {
  return records.map((record) => record[key]).find((value) => normalize(value));
}

function collectMenuSources(records) {
  const sources = new Map();
  for (const source of records.flatMap((record) => record.menuPriceSources ?? [])) {
    const url = normalize(source.url);
    if (url && !sources.has(url)) sources.set(url, source);
  }
  return [...sources.values()];
}

async function buildCulinaryClassWars() {
  const records = await readJson(
    path.join(root, "source-data", "culinary-class-wars", "restaurants.json")
  );
  const groups = new Map();
  for (const record of records) {
    const key = restaurantKey(record.restaurantName, record.address);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  const restaurants = [];
  const sourceLinks = [];
  let ordinal = 0;
  for (const [key, affiliations] of groups) {
    ordinal += 1;
    const first = affiliations[0];
    const id = `culinary-class-wars_restaurant_${hash(key)}`;
    const menuNames = [...new Set(affiliations.map((record) => normalize(record.representativeMenu)).filter(Boolean))];
    const menus = collectMenus(affiliations);
    restaurants.push({
      id,
      name: normalize(first.restaurantName),
      region: normalize(first.region),
      address: normalize(first.address),
      category: normalize(first.category),
      representativeMenu: menuNames[0] ?? "",
      lat: Number.isFinite(first.lat) ? first.lat : null,
      lng: Number.isFinite(first.lng) ? first.lng : null,
      imageUrl: "",
      foundingYear: null,
      menus: menus.map((menu, index) => ({
        id: `${id}_menu_${index + 1}`,
        name: menu.name,
        price: menu.price,
        isSignature: index === 0,
      })),
      thumbnailFileName: null,
      isOverseas: !normalize(first.address).startsWith("서울") && /USA|Hong Kong|Italy|Japan|Australia|Thailand/i.test(normalize(first.address)),
      phone: normalize(firstValue(affiliations, "phone")),
      kakaoPlaceId: normalize(firstValue(affiliations, "kakaoPlaceId")) || null,
      placeUrl: normalize(firstValue(affiliations, "placeUrl")),
      menuPriceStatus: normalize(firstValue(affiliations, "menuPriceStatus")),
      menuPriceVerifiedAt: normalize(firstValue(affiliations, "menuPriceVerifiedAt")),
      menuPriceSources: collectMenuSources(affiliations),
      evidence: affiliations.map((record) => ({
        season: record.season,
        spoonClass: record.spoonClass,
        chefName: record.chefName,
        contestantName: record.contestantName,
        sourceUrl: record.sourceUrl,
        listingUrl: record.listingUrl,
        addressSourceUrl: record.addressSourceUrl,
        menuPriceSources: record.menuPriceSources,
        confidence: record.confidence,
        reviewStatus: record.reviewStatus,
      })),
    });
    sourceLinks.push({
      id: `culinary-class-wars_link_${hash(key)}`,
      restaurantId: id,
      sourceId: "culinary-class-wars",
      ordinal,
      label: affiliations
        .map(
          (record) =>
            `시즌 ${record.season} · ${record.spoonClass === "white" ? "백수저" : "흑수저"} · ${record.contestantName || record.chefName}`
        )
        .join(" / "),
    });
  }

  return {
    restaurants,
    sources: [
      {
        id: "culinary-class-wars",
        name: "흑백요리사 셰프 식당",
        type: "tv_show",
        provider: "Netflix",
        description: "흑백요리사 시즌 1·2 출연 셰프와 공개 식당 연결 초안",
      },
    ],
    sourceLinks,
    affiliations: records,
    meta: {
      generatedAt: new Date().toISOString(),
      affiliationCount: records.length,
      uniqueRestaurantCount: restaurants.length,
      needsAddressReviewCount: records.filter((record) => !normalize(record.address)).length,
    },
  };
}

async function buildSeoulTaste100() {
  const records = await readJson(
    path.join(root, "source-data", "seoul-taste-100", "restaurants.json")
  );
  const restaurants = records.map((record) => ({
    id: record.id,
    name: record.name,
    region: record.region,
    address: record.address,
    category: record.category,
    representativeMenu: record.representativeMenu,
    lat: Number.isFinite(record.lat) ? record.lat : null,
    lng: Number.isFinite(record.lng) ? record.lng : null,
    imageUrl: "",
    foundingYear: null,
    menus: (record.menus ?? []).map((menu, index) => ({
      id: `${record.id}_menu_${index + 1}`,
      name: menu.name,
      price: menu.price ?? null,
      isSignature: Boolean(menu.isSignature),
    })),
    thumbnailFileName: null,
    isOverseas: false,
    phone: record.phone,
    hours: record.hours,
    closingDays: record.closingDays,
    description: record.description,
    evidence: record.evidence,
  }));
  const sourceLinks = records.map((record) => ({
    id: `seoul-taste-100_link_${record.ordinal}`,
    restaurantId: record.id,
    sourceId: "seoul-taste-100-2025",
    ordinal: record.ordinal,
    label: `${record.category} · 2025 서울미식 100선`,
  }));
  return {
    restaurants,
    sources: [
      {
        id: "seoul-taste-100-2025",
        name: "2025 서울미식 100선",
        type: "guide",
        provider: "서울특별시",
        description: "국내외 미식 전문가 60명이 선정한 서울 레스토랑·바 100곳",
      },
    ],
    sourceLinks,
    meta: {
      generatedAt: new Date().toISOString(),
      restaurantCount: restaurants.length,
      categoryCounts: restaurants.reduce((result, restaurant) => {
        result[restaurant.category] = (result[restaurant.category] ?? 0) + 1;
        return result;
      }, {}),
    },
  };
}

async function main() {
  const [culinaryClassWars, seoulTaste100] = await Promise.all([
    buildCulinaryClassWars(),
    buildSeoulTaste100(),
  ]);
  await mkdir(generatedRoot, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(generatedRoot, "culinary-class-wars.generated.json"),
      `${JSON.stringify(culinaryClassWars, null, 2)}\n`,
      "utf8"
    ),
    writeFile(
      path.join(generatedRoot, "seoul-taste-100.generated.json"),
      `${JSON.stringify(seoulTaste100, null, 2)}\n`,
      "utf8"
    ),
  ]);
  console.log(
    `culinary-class-wars: ${culinaryClassWars.restaurants.length} restaurants, ${culinaryClassWars.affiliations.length} affiliations`
  );
  console.log(`seoul-taste-100: ${seoulTaste100.restaurants.length} restaurants`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
