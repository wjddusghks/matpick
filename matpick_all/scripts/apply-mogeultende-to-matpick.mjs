import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CREATOR_ID = "UCfpaSruWW3S4dibonKXENjA";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const sourceDir = path.resolve(projectRoot, "..", "source-data", "mogeultende");
const appDataPath = path.join(projectRoot, "client", "src", "data", "matpick-data.json");
const episodesPath = path.join(sourceDir, "episodes.json");
const restaurantsPath = path.join(sourceDir, "restaurants.json");

function normalize(value = "") {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function addressTokens(value = "") {
  return Array.from(
    new Set(
      value
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[(),]/g, " ")
        .match(/[\p{L}\p{N}-]+/gu) ?? []
    )
  );
}

function findReusableRestaurant(sourceRestaurant, candidates) {
  const sourceNames = new Set(
    [sourceRestaurant.name, sourceRestaurant.sourceName]
      .map(normalize)
      .filter(Boolean)
  );
  const sourceAddressTokens = new Set(addressTokens(sourceRestaurant.address));

  return candidates
    .map((candidate) => {
      const candidateName = normalize(candidate.name);
      let nameScore = 0;
      for (const sourceName of sourceNames) {
        if (sourceName === candidateName) {
          nameScore = Math.max(nameScore, 130);
        } else if (
          sourceName.includes(candidateName) ||
          candidateName.includes(sourceName)
        ) {
          nameScore = Math.max(nameScore, 75);
        }
      }

      let addressScore = 0;
      for (const token of addressTokens(candidate.address)) {
        if (!sourceAddressTokens.has(token)) continue;
        if (/\d/.test(token)) addressScore += 18;
        else if (/(로|길)$/.test(token)) addressScore += 22;
        else if (/(동|가|읍|면|리|구|시|군)$/.test(token)) addressScore += 10;
        else addressScore += 2;
      }

      return { candidate, score: nameScore + Math.min(addressScore, 70) };
    })
    .filter(({ score }) => score >= 140)
    .sort((left, right) => right.score - left.score)[0]?.candidate;
}

function toAppRestaurant(sourceRestaurant, id, existing) {
  return {
    ...existing,
    id,
    name: sourceRestaurant.name,
    region: sourceRestaurant.region,
    address: sourceRestaurant.address,
    category: sourceRestaurant.category,
    representativeMenu: sourceRestaurant.representativeMenu,
    lat: sourceRestaurant.lat,
    lng: sourceRestaurant.lng,
    imageUrl: sourceRestaurant.imageUrl,
    foundingYear: existing?.foundingYear ?? null,
    menus: sourceRestaurant.menus.map((menu, index) => ({
      id: menu.id || `${id}_menu_${String(index + 1).padStart(3, "0")}`,
      name: menu.name,
      price: menu.price || undefined,
      description: menu.description || undefined,
      isSignature: Boolean(menu.isSignature),
      sourceOrdinal: menu.sourceOrdinal,
    })),
    thumbnailFileName: existing?.thumbnailFileName ?? null,
    googlePlaceId: existing?.googlePlaceId ?? null,
    isOverseas: sourceRestaurant.isOverseas,
    country: sourceRestaurant.country,
    phone: sourceRestaurant.phone,
    operationStatus: sourceRestaurant.operationStatus,
    operationSummary: sourceRestaurant.operationSummary,
    weeklyHours: sourceRestaurant.weeklyHours,
    kakaoPlaceId: sourceRestaurant.kakaoPlaceId,
    placeUrl: sourceRestaurant.placeUrl,
    facilities: sourceRestaurant.facilities,
    rating: sourceRestaurant.rating,
    reviewCount: sourceRestaurant.reviewCount,
    officialDescriptionAddress: sourceRestaurant.officialDescriptionAddress,
    detailCollectedAt: sourceRestaurant.detailCollectedAt,
    menuPriceStatus: sourceRestaurant.menuPriceStatus,
    menuPriceVerifiedAt: sourceRestaurant.menuPriceVerifiedAt,
    menuPriceNote: sourceRestaurant.menuPriceNote,
    menuPriceSources: sourceRestaurant.menuPriceSources,
    verification: sourceRestaurant.verification,
    sourceUrls: sourceRestaurant.sourceUrls,
    episodeNumbers: sourceRestaurant.episodeNumbers,
    videoIds: sourceRestaurant.videoIds,
  };
}

async function main() {
  const [appData, episodeSource, restaurantSource] = await Promise.all([
    fs.readFile(appDataPath, "utf8").then(JSON.parse),
    fs.readFile(episodesPath, "utf8").then(JSON.parse),
    fs.readFile(restaurantsPath, "utf8").then(JSON.parse),
  ]);

  const oldCreatorVisits = appData.visits.filter(
    (visit) => visit.creatorId === CREATOR_ID
  );
  const oldCreatorRestaurantIds = new Set(
    oldCreatorVisits.map((visit) => visit.restaurantId).filter(Boolean)
  );
  const restaurantIdsUsedElsewhere = new Set(
    appData.visits
      .filter((visit) => visit.creatorId !== CREATOR_ID)
      .map((visit) => visit.restaurantId)
      .filter(Boolean)
  );

  const retainedRestaurants = appData.restaurants.filter(
    (restaurant) =>
      !oldCreatorRestaurantIds.has(restaurant.id) ||
      restaurantIdsUsedElsewhere.has(restaurant.id)
  );
  const retainedById = new Map(
    retainedRestaurants.map((restaurant) => [restaurant.id, restaurant])
  );
  const sourceToAppRestaurantId = new Map();
  const nextRestaurants = [...retainedRestaurants];
  let reusedRestaurantCount = 0;

  for (const sourceRestaurant of restaurantSource.restaurants) {
    const reusable = findReusableRestaurant(sourceRestaurant, nextRestaurants);
    const appRestaurantId = reusable?.id ?? sourceRestaurant.id;
    const existing = retainedById.get(appRestaurantId) ?? reusable;
    const appRestaurant = toAppRestaurant(
      sourceRestaurant,
      appRestaurantId,
      existing
    );
    const existingIndex = nextRestaurants.findIndex(
      (restaurant) => restaurant.id === appRestaurantId
    );

    if (existingIndex >= 0) {
      nextRestaurants[existingIndex] = appRestaurant;
      reusedRestaurantCount += 1;
    } else {
      nextRestaurants.push(appRestaurant);
    }
    retainedById.set(appRestaurantId, appRestaurant);
    sourceToAppRestaurantId.set(sourceRestaurant.id, appRestaurantId);
  }

  const newVisits = episodeSource.episodes.flatMap((episode) =>
    episode.restaurantIds.map((sourceRestaurantId, restaurantIndex) => {
      const restaurantId =
        sourceToAppRestaurantId.get(sourceRestaurantId) ?? sourceRestaurantId;
      return {
        id: `mogeultende_${episode.videoId}_${String(restaurantIndex + 1).padStart(2, "0")}`,
        restaurantId,
        creatorId: CREATOR_ID,
        videoId: episode.videoId,
        videoUrl: episode.videoUrl,
        videoTitle: episode.videoTitle,
        visitDate: episode.uploadDate,
        episode: episode.episodeLabel,
        rating: "",
        comment: episode.notes || "",
        thumbnailUrl: episode.thumbnailUrl,
        series: "먹을텐데",
      };
    })
  );

  const nextCreators = appData.creators.map((creator) =>
    creator.id === CREATOR_ID
      ? {
          ...creator,
          description:
            "성시경 공식 유튜브 채널의 먹을텐데 국내 맛집을 업로드 순서 기준 회차별로 정리했습니다.",
          youtubeUrl: "https://www.youtube.com/@sungsikyung",
          series: "먹을텐데",
        }
      : creator
  );

  const nextData = {
    ...appData,
    creators: nextCreators,
    restaurants: nextRestaurants,
    visits: [
      ...appData.visits.filter((visit) => visit.creatorId !== CREATOR_ID),
      ...newVisits,
    ],
  };

  await fs.writeFile(appDataPath, `${JSON.stringify(nextData, null, 2)}\n`, "utf8");

  console.log(`Removed old creator visits: ${oldCreatorVisits.length}`);
  console.log(`Added official creator visits: ${newVisits.length}`);
  console.log(`Added source restaurants: ${restaurantSource.restaurants.length}`);
  console.log(`Reused existing restaurant records: ${reusedRestaurantCount}`);
  console.log(`Final app restaurants: ${nextRestaurants.length}`);
  console.log(`Final app visits: ${nextData.visits.length}`);
}

await main();
