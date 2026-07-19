import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(projectRoot, "..");
const sourceDir = path.join(workspaceRoot, "source-data", "mogeultende");
const youtubePath = path.join(sourceDir, "youtube-videos.json");
const sourcePath = path.join(sourceDir, "source.json");
const overridesPath = path.join(sourceDir, "overrides.json");
const appDataPath = path.join(
  projectRoot,
  "client",
  "src",
  "data",
  "matpick-data.json"
);
const episodesOutputPath = path.join(sourceDir, "episodes.json");
const restaurantsOutputPath = path.join(sourceDir, "restaurants.json");
const csvOutputPath = path.join(sourceDir, "mogeultende-restaurants.csv");

const genericHashtags = new Set(
  [
    "성시경",
    "성시경먹을텐데",
    "성시경의먹을텐데",
    "먹을텐데",
    "먹텐",
    "성식영",
    "먹방",
    "맛집",
    "맛집추천",
    "맛집탐방",
    "가수",
    "여행",
    "힐링",
    "술방",
    "술먹방",
    "구독",
    "좋아요",
    "광고",
    "협찬",
  ].map(normalizeLookupValue)
);

const menuHintPattern =
  /(탕|국밥|국수|냉면|칼국수|막국수|우동|짜장|짬뽕|만두|순대|곱창|갈비|고기|수육|족발|보쌈|감자탕|닭|오리|전복|장어|낙지|홍어|회|스시|초밥|오마카세|피자|버거|돈까스|돈가스|커리|카레|쌀국수|분짜|반미|크랩|새우|해산물|불고기|육개장|도가니|설렁탕|해장국|추어탕|부대찌개|청국장|아구찜|매운탕|양꼬치|오뎅|어묵|철판구이|쿠시아게|토스트|샌드위치|치킨|통닭|게장|파전|육회|육사시미|내장|꼬치|곰탕|생고기|돼지|소고기|한우|삼겹살|오겹살|목살|전골)/;

function normalizeLookupValue(value = "") {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function normalizeAddress(value = "") {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createStableId(name, address) {
  const hash = crypto
    .createHash("sha1")
    .update(`${normalizeLookupValue(name)}|${normalizeAddress(address)}`)
    .digest("hex")
    .slice(0, 12);
  return `mogeultende_${hash}`;
}

function getDateOnly(value) {
  return value?.slice(0, 10) ?? "";
}

function getCountry(address, explicitCountry) {
  if (explicitCountry) return explicitCountry;
  const normalized = address.toLowerCase();
  if (/싱가포르|singapore/.test(normalized)) return "싱가포르";
  if (/일본|japan|tokyo|osaka/.test(normalized)) return "일본";
  if (/베트남|vietnam|ho chi minh/.test(normalized)) return "베트남";
  if (/홍콩|hong kong/.test(normalized)) return "홍콩";
  if (/독일|germany|berlin/.test(normalized)) return "독일";
  return "대한민국";
}

function getRegion(address, country) {
  const compactAddress = address.replace(/\s+/g, " ").trim();
  if (!compactAddress) return country === "대한민국" ? "대한민국" : country;

  if (country !== "대한민국") {
    if (/tokyo|도쿄/i.test(compactAddress)) return "일본 도쿄";
    if (/osaka|오사카/i.test(compactAddress)) return "일본 오사카";
    if (/ho chi minh/i.test(compactAddress)) return "베트남 호치민";
    if (/singapore|싱가포르/i.test(compactAddress)) return "싱가포르";
    if (/hong kong|홍콩/i.test(compactAddress)) return "홍콩";
    if (/berlin|베를린/i.test(compactAddress)) return "독일 베를린";
    return country;
  }

  const tokens = compactAddress.split(" ");
  const province = tokens[0] ?? "대한민국";
  const city = tokens[1] ?? "";
  return [province, city].filter(Boolean).join(" ");
}

function getHashtags(description) {
  return Array.from(
    new Set(
      Array.from(description.matchAll(/#([^\s#]+)/g), (match) =>
        match[1].replace(/[|,.;]+$/g, "").trim()
      ).filter(Boolean)
    )
  );
}

function getMenuTags(hashtags, restaurantNames) {
  const restaurantLookups = restaurantNames.map(normalizeLookupValue);
  return hashtags
    .filter((tag) => {
      const lookup = normalizeLookupValue(tag);
      if (!lookup || genericHashtags.has(lookup)) return false;
      if (
        restaurantLookups.some(
          (restaurantLookup) =>
            lookup === restaurantLookup ||
            restaurantLookup.includes(lookup) ||
            lookup.includes(restaurantLookup)
        )
      ) {
        return false;
      }
      return menuHintPattern.test(tag);
    })
    .slice(0, 8);
}

function extractDescriptionRestaurants(video, exclusions) {
  const normalizedDescription = video.description.replace(/\r/g, "");
  const matches = Array.from(
    normalizedDescription.matchAll(/^\[([^\]\n]+)\]\s*$/gm)
  );

  return matches
    .map((match) => {
      const name = match[1].trim();
      const afterHeading = normalizedDescription
        .slice((match.index ?? 0) + match[0].length)
        .replace(/^\n+/, "");
      const address =
        afterHeading
          .split("\n")
          .map((line) => line.trim())
          .find(Boolean)
          ?.replace(/\|+$/g, "")
          .trim() ?? "";
      return { name, address, verification: "official_description" };
    })
    .filter(
      (restaurant) =>
        !exclusions.some(
          (exclusion) =>
            exclusion.videoId === video.videoId &&
            normalizeLookupValue(exclusion.name) ===
              normalizeLookupValue(restaurant.name)
        )
    );
}

function getExistingMatch(seed, existingRestaurants) {
  const seedName = normalizeLookupValue(seed.name);
  const seedAddress = normalizeAddress(seed.address);
  const seedAddressTokens = new Set(
    seedAddress.split(" ").filter((token) => token.length >= 2)
  );

  return existingRestaurants
    .map((restaurant) => {
      const candidateName = normalizeLookupValue(restaurant.name);
      const candidateAddress = normalizeAddress(restaurant.address);
      let score = 0;

      if (candidateName === seedName) {
        score += 120;
      } else if (
        candidateName &&
        seedName &&
        (candidateName.includes(seedName) || seedName.includes(candidateName))
      ) {
        score += 70;
      }

      candidateAddress
        .split(" ")
        .filter((token) => token.length >= 2)
        .forEach((token) => {
          if (seedAddressTokens.has(token)) score += 3;
        });

      return { restaurant, score };
    })
    .filter((candidate) => candidate.score >= 75)
    .sort((left, right) => right.score - left.score)[0]?.restaurant;
}

function mergeMenus(currentMenus = [], nextMenus = []) {
  const byName = new Map();
  [...currentMenus, ...nextMenus].forEach((menu) => {
    if (!menu?.name) return;
    const key = normalizeLookupValue(menu.name);
    const existing = byName.get(key);
    byName.set(key, {
      id: existing?.id ?? menu.id,
      name: existing?.name ?? menu.name,
      price: existing?.price || menu.price || undefined,
      description: existing?.description || menu.description || undefined,
      isSignature: Boolean(existing?.isSignature || menu.isSignature),
      sourceOrdinal: existing?.sourceOrdinal ?? menu.sourceOrdinal,
    });
  });
  return Array.from(byName.values());
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildCsv(episodes, restaurantsById) {
  const headers = [
    "episodeNumber",
    "episodeLabel",
    "uploadDate",
    "videoTitle",
    "videoUrl",
    "contentType",
    "restaurantId",
    "restaurantName",
    "country",
    "region",
    "address",
    "category",
    "representativeMenu",
    "menusAndPrices",
    "lat",
    "lng",
    "phone",
    "operationStatus",
    "operationSummary",
    "weeklyHours",
    "kakaoPlaceId",
    "placeUrl",
    "rating",
    "reviewCount",
    "facilities",
    "officialDescriptionAddress",
    "verification",
    "notes",
  ];
  const rows = [headers];

  episodes.forEach((episode) => {
    const restaurantIds =
      episode.restaurantIds.length > 0 ? episode.restaurantIds : [null];
    restaurantIds.forEach((restaurantId) => {
      const restaurant = restaurantId
        ? restaurantsById.get(restaurantId)
        : null;
      rows.push([
        episode.episodeNumber,
        episode.episodeLabel,
        episode.uploadDate,
        episode.videoTitle,
        episode.videoUrl,
        episode.contentType,
        restaurant?.id ?? "",
        restaurant?.name ?? "",
        restaurant?.country ?? "",
        restaurant?.region ?? "",
        restaurant?.address ?? "",
        restaurant?.category ?? "",
        restaurant?.representativeMenu ?? "",
        (restaurant?.menus ?? [])
          .map((menu) => [menu.name, menu.price].filter(Boolean).join(" "))
          .join(" | "),
        restaurant?.lat || "",
        restaurant?.lng || "",
        restaurant?.phone ?? "",
        restaurant?.operationStatus ?? "",
        restaurant?.operationSummary ?? "",
        (restaurant?.weeklyHours ?? [])
          .map((item) => `${item.day} ${item.hours.join(" / ")}`)
          .join(" | "),
        restaurant?.kakaoPlaceId ?? "",
        restaurant?.placeUrl ?? "",
        restaurant?.rating ?? "",
        restaurant?.reviewCount ?? "",
        JSON.stringify(restaurant?.facilities ?? {}),
        restaurant?.officialDescriptionAddress ?? "",
        restaurant?.verification ?? "",
        episode.notes ?? "",
      ]);
    });
  });

  return `\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")}\r\n`;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readOptionalJson(filePath, fallback) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function main() {
  const [
    youtube,
    source,
    overrides,
    appData,
    kakaoCache,
    menuCache,
    manualMenuCache,
  ] =
    await Promise.all([
      readJson(youtubePath),
      readJson(sourcePath),
      readJson(overridesPath),
      readJson(appDataPath),
      readOptionalJson(path.join(sourceDir, "kakao-places.json"), {
        restaurants: {},
      }),
      readOptionalJson(path.join(sourceDir, "kakao-menus.json"), {
        restaurants: {},
      }),
      readOptionalJson(path.join(sourceDir, "manual-menu-prices.json"), {
        restaurants: {},
      }),
    ]);

  const sortedVideos = [...youtube.videos].sort(
    (left, right) =>
      left.uploadDate.localeCompare(right.uploadDate) ||
      left.videoId.localeCompare(right.videoId)
  );
  const restaurantMap = new Map();
  const episodes = [];
  const excludedOverseasRestaurantIds = new Set();

  sortedVideos.forEach((video, index) => {
    const override = overrides.episodeOverrides[video.videoId] ?? {};
    const parsedRestaurants = extractDescriptionRestaurants(
      video,
      overrides.excludedDescriptionHeadings
    );
    const allRestaurantSeeds = [
      ...parsedRestaurants,
      ...(override.restaurants ?? []),
    ];
    const excludedOverseasSeeds = source.domesticOnly
      ? allRestaurantSeeds.filter(
          (restaurant) =>
            getCountry(restaurant.address, restaurant.country) !== "대한민국"
        )
      : [];
    excludedOverseasSeeds.forEach((restaurant) => {
      excludedOverseasRestaurantIds.add(
        createStableId(restaurant.name, restaurant.address)
      );
    });
    const restaurantSeeds = source.domesticOnly
      ? allRestaurantSeeds.filter(
          (restaurant) =>
            getCountry(restaurant.address, restaurant.country) === "대한민국"
        )
      : allRestaurantSeeds;
    const hashtags = getHashtags(video.description);
    const menuTags = getMenuTags(
      hashtags,
      restaurantSeeds.map((restaurant) => restaurant.name)
    );
    const restaurantIds = [];

    restaurantSeeds.forEach((seed) => {
      const country = getCountry(seed.address, seed.country);
      const id = createStableId(seed.name, seed.address);
      const existingRestaurant = getExistingMatch(seed, appData.restaurants);
      const kakaoData = kakaoCache.restaurants?.[id] ?? {};
      const menuData = menuCache.restaurants?.[id] ?? {};
      const manualMenuData = manualMenuCache.restaurants?.[id] ?? {};
      const current = restaurantMap.get(id);
      const menus = mergeMenus(
        manualMenuData.replaceMenus
          ? []
          : current?.menus ?? existingRestaurant?.menus ?? [],
        manualMenuData.replaceMenus
          ? manualMenuData.menus ?? []
          : [
              ...(seed.menus ?? []),
              ...(menuData.menus ?? []),
              ...(manualMenuData.menus ?? []),
            ]
      ).map((menu, menuIndex) => ({
        ...menu,
        id: menu.id || `${id}_menu_${String(menuIndex + 1).padStart(3, "0")}`,
      }));
      const representativeMenu =
        manualMenuData.representativeMenu ||
        seed.representativeMenu ||
        menuData.representativeMenu ||
        current?.representativeMenu ||
        menuTags.slice(0, 3).join(", ") ||
        existingRestaurant?.representativeMenu ||
        kakaoData.categoryDetail ||
        "대표 메뉴 확인 필요";
      const restaurant = {
        id,
        name: kakaoData.name || seed.name,
        sourceName: seed.name,
        country,
        region: getRegion(kakaoData.address || seed.address, country),
        address: kakaoData.address || seed.address,
        officialDescriptionAddress: seed.address,
        category:
          kakaoData.categoryDetail ||
          existingRestaurant?.category ||
          (country === "대한민국" ? "음식점" : "해외 음식점"),
        representativeMenu,
        menuTags: Array.from(
          new Set([...(current?.menuTags ?? []), ...menuTags])
        ),
        menus,
        lat: kakaoData.lat || existingRestaurant?.lat || 0,
        lng: kakaoData.lng || existingRestaurant?.lng || 0,
        phone: kakaoData.phone || "",
        operationStatus:
          menuData.operationStatusAtCollection || kakaoData.operationStatus || "",
        operationSummary: menuData.operationSummaryAtCollection || "",
        weeklyHours: menuData.weeklyHours ?? [],
        detailCollectedAt: menuCache.collectedAt || "",
        menuPriceStatus: manualMenuData.status || "",
        menuPriceVerifiedAt: manualMenuData.verifiedAt || "",
        menuPriceNote: manualMenuData.note || "",
        menuPriceSources: manualMenuData.sources ?? [],
        isOverseas: country !== "대한민국",
        imageUrl:
          kakaoData.imageUrl || existingRestaurant?.imageUrl || video.thumbnailUrl,
        kakaoPlaceId: kakaoData.kakaoPlaceId || "",
        placeUrl: kakaoData.placeUrl || "",
        facilities: kakaoData.facilities ?? {},
        reviewCount: kakaoData.reviewCount ?? null,
        rating: kakaoData.rating ?? null,
        verification: seed.verification || "official_description",
        sourceUrls: Array.from(
          new Set(
            [
              ...(current?.sourceUrls ?? []),
              seed.sourceUrl,
              ...(manualMenuData.sources ?? []).map((source) => source.url),
            ].filter(Boolean)
          )
        ),
        episodeNumbers: Array.from(
          new Set([...(current?.episodeNumbers ?? []), index + 1])
        ),
        videoIds: Array.from(
          new Set([...(current?.videoIds ?? []), video.videoId])
        ),
      };

      restaurantMap.set(id, restaurant);
      restaurantIds.push(id);
    });

    const contentType =
      override.contentType ||
      (allRestaurantSeeds.some(
        (restaurant) =>
          getCountry(restaurant.address, restaurant.country) !== "대한민국"
      )
        ? "travel_special"
        : "restaurant");

    episodes.push({
      episodeNumber: index + 1,
      episodeLabel: `${index + 1}화`,
      uploadDate: getDateOnly(video.uploadDate),
      videoId: video.videoId,
      videoUrl: video.videoUrl,
      videoTitle: video.title,
      thumbnailUrl: video.thumbnailUrl,
      contentType,
      restaurantIds,
      restaurantCount: restaurantIds.length,
      excludedOverseasRestaurantCount: excludedOverseasSeeds.length,
      hashtags,
      notes: [
        override.notes ?? "",
        excludedOverseasSeeds.length > 0
          ? `해외 식당 ${excludedOverseasSeeds.length}곳은 국내 전용 데이터셋 정책으로 제외`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
      officialDescription: video.description,
    });
  });

  const restaurants = Array.from(restaurantMap.values()).sort(
    (left, right) =>
      left.episodeNumbers[0] - right.episodeNumbers[0] ||
      left.name.localeCompare(right.name, "ko-KR")
  );
  const restaurantsById = new Map(
    restaurants.map((restaurant) => [restaurant.id, restaurant])
  );
  const collectedAt = youtube.collectedAt;
  const generatedAt = new Date().toISOString();
  const commonMeta = {
    source,
    collectedAt,
    generatedAt,
    officialVideoCount: episodes.length,
    restaurantEpisodeCount: episodes.filter(
      (episode) => episode.restaurantCount > 0
    ).length,
    uniqueRestaurantCount: restaurants.length,
    scope: source.domesticOnly ? "domestic_only" : "all_restaurants",
    excludedOverseasRestaurantCount: excludedOverseasRestaurantIds.size,
    excludedOverseasEpisodeCount: episodes.filter(
      (episode) => episode.excludedOverseasRestaurantCount > 0
    ).length,
  };

  await Promise.all([
    fs.writeFile(
      episodesOutputPath,
      `${JSON.stringify({ ...commonMeta, episodes }, null, 2)}\n`,
      "utf8"
    ),
    fs.writeFile(
      restaurantsOutputPath,
      `${JSON.stringify({ ...commonMeta, restaurants }, null, 2)}\n`,
      "utf8"
    ),
    fs.writeFile(csvOutputPath, buildCsv(episodes, restaurantsById), "utf8"),
  ]);

  console.log(`Episodes: ${episodes.length}`);
  console.log(`Episodes with restaurants: ${commonMeta.restaurantEpisodeCount}`);
  console.log(`Unique restaurants: ${restaurants.length}`);
  console.log(
    `Domestic restaurants: ${restaurants.filter((restaurant) => !restaurant.isOverseas).length}`
  );
  console.log(
    `Overseas restaurants: ${restaurants.filter((restaurant) => restaurant.isOverseas).length}`
  );
  console.log(
    `Missing coordinates: ${restaurants.filter((restaurant) => !restaurant.lat || !restaurant.lng).length}`
  );
  console.log(
    `Missing menu prices: ${restaurants.filter((restaurant) => !restaurant.menus.some((menu) => menu.price)).length}`
  );
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
