import rawDataset from "./matpick-data.json";
import { creatorProfileImageOverrides } from "./creatorProfileImages";
import oldKorean100Dataset from "./generated/old-korean-100.generated.json";
import sikgaekBaekbanTripDataset from "./generated/sikgaek-baekban-trip.generated.json";
import wednesdayGourmetDataset from "./generated/wednesday-gourmet.generated.json";
import type {
  Creator,
  MatpickDataSet,
  MenuItem,
  Restaurant,
  SearchItem,
  SearchResult,
  Source,
  SourceLink,
  Visit,
} from "./types";

type SourceDataset = {
  restaurants?: Restaurant[];
  sources?: Source[];
  sourceLinks?: SourceLink[];
};

function normalizeLookupValue(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function buildRestaurantLookupKey(restaurant: Pick<Restaurant, "name" | "address">) {
  return `${normalizeLookupValue(restaurant.name)}|${normalizeLookupValue(restaurant.address)}`;
}

function hasValidCoords(restaurant: Pick<Restaurant, "lat" | "lng">) {
  return (
    Number.isFinite(restaurant.lat) &&
    Number.isFinite(restaurant.lng) &&
    restaurant.lat !== 0 &&
    restaurant.lng !== 0
  );
}

function preferLongerText(currentValue: string, nextValue: string) {
  const current = currentValue?.trim() ?? "";
  const next = nextValue?.trim() ?? "";

  if (!current) return next;
  if (!next) return current;
  return next.length > current.length ? next : current;
}

function mergeRestaurantById(current: Restaurant, next: Restaurant): Restaurant {
  const preferredAddressRestaurant =
    preferLongerText(current.address, next.address) === next.address ? next : current;

  return {
    ...current,
    ...next,
    name: preferLongerText(current.name, next.name),
    region: preferLongerText(current.region, next.region),
    address: preferLongerText(current.address, next.address),
    category: preferLongerText(current.category, next.category),
    representativeMenu: preferLongerText(
      current.representativeMenu,
      next.representativeMenu
    ),
    lat: hasValidCoords(preferredAddressRestaurant)
      ? preferredAddressRestaurant.lat
      : hasValidCoords(next)
        ? next.lat
        : current.lat,
    lng: hasValidCoords(preferredAddressRestaurant)
      ? preferredAddressRestaurant.lng
      : hasValidCoords(next)
        ? next.lng
        : current.lng,
    imageUrl: current.imageUrl || next.imageUrl,
    foundingYear: current.foundingYear ?? next.foundingYear ?? null,
    menus: current.menus && current.menus.length > 0 ? current.menus : next.menus ?? [],
    thumbnailFileName: current.thumbnailFileName ?? next.thumbnailFileName ?? null,
    isOverseas: current.isOverseas ?? next.isOverseas,
  };
}

function dedupeRestaurantsById(restaurantsToMerge: Restaurant[]) {
  const dedupedRestaurants: Restaurant[] = [];
  const indexById = new Map<string, number>();

  restaurantsToMerge.forEach((restaurant) => {
    const existingIndex = indexById.get(restaurant.id);
    if (existingIndex == null) {
      indexById.set(restaurant.id, dedupedRestaurants.length);
      dedupedRestaurants.push(restaurant);
      return;
    }

    dedupedRestaurants[existingIndex] = mergeRestaurantById(
      dedupedRestaurants[existingIndex],
      restaurant
    );
  });

  return dedupedRestaurants;
}

function mergeDatasets(base: MatpickDataSet, extras: SourceDataset[]): MatpickDataSet {
  const mergedRestaurants = [...base.restaurants];
  const mergedSources = [...(base.sources ?? [])];
  const mergedSourceLinks = [...(base.sourceLinks ?? [])];
  const restaurantIdMap = new Map<string, string>();
  const existingRestaurantIndex = new Map<string, number>();

  mergedRestaurants.forEach((restaurant, index) => {
    existingRestaurantIndex.set(buildRestaurantLookupKey(restaurant), index);
  });

  extras.forEach((extra) => {
    (extra.sources ?? []).forEach((source) => {
      if (!mergedSources.some((item) => item.id === source.id)) {
        mergedSources.push(source);
      }
    });

    (extra.restaurants ?? []).forEach((restaurant) => {
      const lookupKey = buildRestaurantLookupKey(restaurant);
      const existingIndex = existingRestaurantIndex.get(lookupKey);

      if (existingIndex != null) {
        const existing = mergedRestaurants[existingIndex];
        mergedRestaurants[existingIndex] = {
          ...existing,
          foundingYear: existing.foundingYear ?? restaurant.foundingYear ?? null,
          menus: existing.menus && existing.menus.length > 0 ? existing.menus : restaurant.menus ?? [],
          thumbnailFileName:
            existing.thumbnailFileName ?? restaurant.thumbnailFileName ?? null,
        };
        restaurantIdMap.set(restaurant.id, existing.id);
        return;
      }

      mergedRestaurants.push(restaurant);
      existingRestaurantIndex.set(lookupKey, mergedRestaurants.length - 1);
      restaurantIdMap.set(restaurant.id, restaurant.id);
    });

    (extra.sourceLinks ?? []).forEach((link) => {
      const remappedRestaurantId = restaurantIdMap.get(link.restaurantId) ?? link.restaurantId;
      const dedupeKey = `${link.sourceId}:${remappedRestaurantId}:${link.ordinal ?? ""}`;

      if (
        mergedSourceLinks.some(
          (item) =>
            `${item.sourceId}:${item.restaurantId}:${item.ordinal ?? ""}` === dedupeKey
        )
      ) {
        return;
      }

      mergedSourceLinks.push({
        ...link,
        restaurantId: remappedRestaurantId,
      });
    });
  });

  return {
    creators: base.creators,
    visits: base.visits,
    restaurants: dedupeRestaurantsById(mergedRestaurants),
    sources: mergedSources,
    sourceLinks: mergedSourceLinks,
  };
}

const baseDataset = rawDataset as MatpickDataSet;
const dataset = mergeDatasets(baseDataset, [
  oldKorean100Dataset as SourceDataset,
  sikgaekBaekbanTripDataset as SourceDataset,
  wednesdayGourmetDataset as SourceDataset,
]);
const creatorDisplayNameOverrides: Record<string, string> = {
  UCrDMtdCSMTGVmUKvuhcahRw: "또간집",
};

export function getCreatorDisplayName(creator: Pick<Creator, "id" | "name">) {
  return creatorDisplayNameOverrides[creator.id] ?? creator.name;
}

function getCreatorSearchName(creator: Creator) {
  const displayName = getCreatorDisplayName(creator);
  return displayName === creator.name ? `${creator.name} (${creator.series})` : displayName;
}

const creatorsWithProfileImages: Creator[] = dataset.creators.map((creator) => ({
  ...creator,
  profileImage: creatorProfileImageOverrides[creator.id] ?? creator.profileImage,
}));
const normalizedDataset: MatpickDataSet = {
  ...dataset,
  creators: creatorsWithProfileImages,
};

export const creators: Creator[] = normalizedDataset.creators;
export const restaurants: Restaurant[] = normalizedDataset.restaurants;
export const visits: Visit[] = normalizedDataset.visits;
export const sources: Source[] = normalizedDataset.sources ?? [];
export const sourceLinks: SourceLink[] = normalizedDataset.sourceLinks ?? [];
export const dataSet: MatpickDataSet = normalizedDataset;

type CountEntry = {
  name: string;
  count: number;
};

const regionAliases: Record<string, string> = {
  강남역: "서울",
  건대: "서울",
  광장시장: "서울",
  남대문시장: "서울",
  대학로: "서울",
  망원: "서울",
  명동: "서울",
  문래동: "서울",
  북촌: "서울",
  사당: "서울",
  상암: "서울",
  성수동: "서울",
  신림: "서울",
  압구정: "서울",
  연남동: "서울",
  이태원: "서울",
  잠실: "서울",
  종로: "서울",
  홍대: "서울",
  여의도: "서울",
  을지로: "서울",
  신당동: "서울",
  왕십리: "서울",
  신촌: "서울",
  서촌: "서울",
  한남동: "서울",
  합정: "서울",
  해방촌: "서울",
  연신내: "서울",
  영등포: "서울",
  코엑스: "서울",
  용산: "서울",
  안양: "경기",
  안산: "경기",
  분당: "경기",
  김포: "경기",
  남양주: "경기",
  일산: "경기",
  파주: "경기",
  원주: "강원",
  강릉: "강원",
  속초: "강원",
  춘천: "강원",
  양양: "강원",
  수원: "경기",
  구로디지털단지: "서울",
  군산: "전북",
  전주: "전북",
  목포: "전남",
  남원: "전북",
  경주: "경북",
  구미: "경북",
  서산: "충남",
  천안: "충남",
  청주: "충북",
  충주: "충북",
  여수: "전남",
  해남: "전남",
  해운대: "부산",
  진해: "경남",
  창원: "경남",
  교토: "해외",
  방콕: "해외",
  오사카: "해외",
  도쿄: "해외",
  후쿠오카: "해외",
  하와이: "해외",
  홍콩: "해외",
};

const broadRegionOrder = [
  "서울",
  "경기",
  "부산",
  "대구",
  "대전",
  "광주",
  "인천",
  "울산",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
  "해외",
] as const;

function sortText(a: string, b: string) {
  return a.localeCompare(b, "ko-KR");
}

function getSourceTypeLabel(type: Source["type"]) {
  switch (type) {
    case "guide":
      return "가이드";
    case "tv_show":
      return "방송";
    case "michelin":
      return "미쉐린";
    case "institution":
      return "기관 선정";
    case "book":
      return "책";
    case "magazine":
      return "매거진";
    case "creator":
      return "크리에이터";
    default:
      return "출처";
  }
}

function createSearchId(prefix: string, value: string) {
  return `${prefix}:${encodeURIComponent(value)}`;
}

function countBy(values: string[]): CountEntry[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || sortText(a.name, b.name));
}

export function getCreatorsByRestaurant(restaurantId: string): Creator[] {
  const creatorIdSet = new Set(
    visits
      .filter((visit) => visit.restaurantId === restaurantId)
      .map((visit) => visit.creatorId)
      .filter(Boolean)
  );

  return creators.filter((creator) => creatorIdSet.has(creator.id));
}

export function getRestaurantsByCreator(creatorId: string): Restaurant[] {
  const restaurantIds = new Set(
    visits
      .filter((visit) => visit.creatorId === creatorId)
      .map((visit) => visit.restaurantId)
      .filter(Boolean)
  );

  return restaurants.filter((restaurant) => restaurantIds.has(restaurant.id));
}

export function getVisitsByRestaurant(restaurantId: string): Visit[] {
  return visits.filter((visit) => visit.restaurantId === restaurantId);
}

export function getRestaurantMenuItems(restaurant: Restaurant): MenuItem[] {
  if (restaurant.menus && restaurant.menus.length > 0) {
    return restaurant.menus.filter((menu) => menu.name.trim().length > 0);
  }

  const items: MenuItem[] = [];

  (restaurant.representativeMenu || "").split("/").forEach((chunk, index) => {
    const trimmed = chunk.trim();
    if (!trimmed) {
      return;
    }

    const priceMatch = trimmed.match(/(\d[\d,]*원?)/);
    const price = priceMatch ? priceMatch[1] : undefined;
    const name = price ? trimmed.replace(price, "").trim() : trimmed;

    items.push({
      id: `${restaurant.id}_menu_${index}`,
      name: name || trimmed,
      price,
      isSignature: index === 0,
    });
  });

  return items;
}

export function getRestaurantMenuSummary(restaurant: Restaurant) {
  const items = getRestaurantMenuItems(restaurant);
  if (items.length === 0) {
    return "";
  }

  return items
    .slice(0, 3)
    .map((item) => item.name)
    .filter(Boolean)
    .join(" / ");
}

export function getSourceLinksByRestaurant(restaurantId: string) {
  return sourceLinks.filter((link) => link.restaurantId === restaurantId);
}

export function getSourcesByRestaurant(restaurantId: string) {
  const linkedSourceIds = new Set(
    getSourceLinksByRestaurant(restaurantId).map((link) => link.sourceId)
  );

  return sources.filter((source) => linkedSourceIds.has(source.id));
}

export function getSourceById(sourceId: string) {
  return sources.find((source) => source.id === sourceId) ?? null;
}

export function getRestaurantsBySource(sourceId: string) {
  const linkedRestaurantIds = new Set(
    sourceLinks
      .filter((link) => link.sourceId === sourceId)
      .map((link) => link.restaurantId)
  );

  return restaurants.filter((restaurant) => linkedRestaurantIds.has(restaurant.id));
}

export function getSourceRestaurantCount(sourceId: string) {
  return getRestaurantsBySource(sourceId).length;
}

export function getUniqueRegions(): string[] {
  return Array.from(new Set(restaurants.map((restaurant) => restaurant.region).filter(Boolean))).sort(sortText);
}

export function getBroadRegion(region: string): string {
  if (!region) return "기타";
  if (region.startsWith("서울")) return "서울";
  if (region.startsWith("부산")) return "부산";
  if (region.startsWith("대구")) return "대구";
  if (region.startsWith("대전")) return "대전";
  if (region.startsWith("광주")) return "광주";
  if (region.startsWith("인천")) return "인천";
  if (region.startsWith("울산")) return "울산";
  if (region.startsWith("세종")) return "세종";
  if (region.startsWith("경기")) return "경기";
  if (region.startsWith("강원")) return "강원";
  if (region.startsWith("충북")) return "충북";
  if (region.startsWith("충남")) return "충남";
  if (region.startsWith("전북")) return "전북";
  if (region.startsWith("전남")) return "전남";
  if (region.startsWith("경북")) return "경북";
  if (region.startsWith("경남")) return "경남";
  if (region.startsWith("제주")) return "제주";

  for (const [areaName, broadRegion] of Object.entries(regionAliases)) {
    if (region.includes(areaName)) {
      return broadRegion;
    }
  }

  return region;
}

export function getBroadRegions(): string[] {
  const available = new Set(
    restaurants
      .map((restaurant) => getBroadRegion(restaurant.region))
      .filter((region) => region !== "기타")
  );

  return broadRegionOrder.filter((region) => available.has(region));
}

const cuisineCategoryOrder = [
  "한식",
  "중식",
  "일식",
  "양식",
  "멕시칸",
  "인도",
  "태국",
  "베트남",
] as const;

const cuisineCategoryMatchers: Array<{
  name: (typeof cuisineCategoryOrder)[number];
  keywords: string[];
}> = [
  {
    name: "한식",
    keywords: [
      "한식",
      "설렁탕",
      "곰탕",
      "국밥",
      "냉면",
      "백반",
      "비빔밥",
      "국수",
      "칼국수",
      "갈비",
      "불고기",
      "장어",
      "해장국",
      "추어탕",
      "복국",
      "떡갈비",
      "보쌈",
      "족발",
      "찌개",
      "전골",
      "정식",
      "회",
      "게장",
      "분식",
      "삼겹",
      "순대",
      "보리밥",
      "쌈밥",
      "아구",
      "해물탕",
    ],
  },
  {
    name: "중식",
    keywords: [
      "중식",
      "짜장",
      "짬뽕",
      "탕수육",
      "마라",
      "딤섬",
      "양꼬치",
      "훠궈",
      "사천",
      "중국",
      "홍콩",
    ],
  },
  {
    name: "일식",
    keywords: [
      "일식",
      "스시",
      "초밥",
      "오마카세",
      "사시미",
      "라멘",
      "우동",
      "돈카츠",
      "돈까스",
      "규카츠",
      "텐동",
      "소바",
      "이자카야",
      "야키토리",
      "일본",
    ],
  },
  {
    name: "양식",
    keywords: [
      "양식",
      "파스타",
      "피자",
      "스테이크",
      "이탈리안",
      "프렌치",
      "브런치",
      "버거",
      "샌드위치",
      "비스트로",
      "그릴",
      "유럽",
      "와인",
    ],
  },
  {
    name: "멕시칸",
    keywords: ["멕시칸", "타코", "부리또", "브리또", "퀘사디아", "나초", "엔칠라다"],
  },
  {
    name: "인도",
    keywords: ["인도", "커리", "카레", "난", "탄두리", "비리야니"],
  },
  {
    name: "태국",
    keywords: ["태국", "팟타이", "똠얌", "카오", "쏨땀", "태국식"],
  },
  {
    name: "베트남",
    keywords: ["베트남", "쌀국수", "포", "반미", "분짜", "짜조", "월남쌈"],
  },
];

export function getCuisineCategory(category: string) {
  const normalized = category.trim().toLowerCase();

  if (!normalized) {
    return "한식";
  }

  const matched = cuisineCategoryMatchers.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
  );

  return matched?.name ?? "한식";
}

export function getCuisineCategories() {
  return [...cuisineCategoryOrder];
}

export function getTotalCreatorCount(): number {
  return creators.length;
}

export function getRecommendationCount(restaurantId: string): number {
  const creatorIdSet = new Set(
    visits
      .filter((visit) => visit.restaurantId === restaurantId)
      .map((visit) => visit.creatorId)
      .filter(Boolean)
  );

  return creatorIdSet.size;
}

export function getAllCategories(): string[] {
  return Array.from(new Set(restaurants.map((restaurant) => restaurant.category).filter(Boolean))).sort(sortText);
}

export function getRegions(): string[] {
  return getBroadRegions();
}

export function getRestaurantsByCategory(category: string): Restaurant[] {
  return restaurants.filter(
    (restaurant) =>
      restaurant.category === category || getCuisineCategory(restaurant.category) === category
  );
}

export function getRestaurantsBySeries(series: string): Restaurant[] {
  const restaurantIds = new Set(
    visits
      .filter((visit) => visit.series === series)
      .map((visit) => visit.restaurantId)
      .filter(Boolean)
  );

  return restaurants.filter((restaurant) => restaurantIds.has(restaurant.id));
}

export function getSeriesList(): string[] {
  return Array.from(new Set(visits.map((visit) => visit.series).filter(Boolean))).sort(sortText);
}

const regionCounts = countBy(restaurants.map((restaurant) => restaurant.region));
const categoryCounts = countBy(
  restaurants.map((restaurant) => getCuisineCategory(restaurant.category))
);
const sortedRestaurants = [...restaurants].sort(
  (a, b) => getRecommendationCount(b.id) - getRecommendationCount(a.id) || sortText(a.name, b.name)
);
const sourceSearchEntries = sources
  .map((source) => ({
    source,
    restaurantCount: getSourceRestaurantCount(source.id),
  }))
  .filter((entry) => entry.restaurantCount > 0)
  .sort(
    (a, b) =>
      b.restaurantCount - a.restaurantCount ||
      sortText(a.source.name, b.source.name)
  );

export const searchData: SearchItem[] = [
  ...creators.map((creator) => ({
    id: createSearchId("creator", creator.id),
    type: "creator" as const,
    name: getCreatorSearchName(creator),
    subtitle: `${creator.channelName} · ${creator.subscribers}`,
    icon: "🎬",
  })),
  ...regionCounts.map((entry) => ({
    id: createSearchId("region", entry.name),
    type: "region" as const,
    name: entry.name,
    subtitle: `맛집 ${entry.count}개`,
    icon: "📍",
  })),
  ...categoryCounts.map((entry) => ({
    id: createSearchId("food", entry.name),
    type: "food" as const,
    name: entry.name,
    subtitle: `맛집 ${entry.count}개`,
    icon: "🍽️",
  })),
  ...sourceSearchEntries.map((entry) => ({
    id: createSearchId("source", entry.source.id),
    type: "source" as const,
    name: entry.source.name,
    subtitle: `${getSourceTypeLabel(entry.source.type)} · 맛집 ${entry.restaurantCount}곳`,
    icon: "🗂️",
  })),
  ...sortedRestaurants.map((restaurant) => ({
    id: createSearchId("restaurant", restaurant.id),
    type: "restaurant" as const,
    name: restaurant.name,
    subtitle: restaurant.address || restaurant.region,
    icon: "🍴",
  })),
];

export const mockSearchData: SearchResult[] = [
  ...creators.map((creator) => ({
    id: creator.id,
    type: "creator" as const,
    name: getCreatorSearchName(creator),
    platform: "YouTube",
    subscribers: creator.subscribers,
    image: creator.profileImage,
  })),
  ...regionCounts.map((entry) => ({
    id: createSearchId("region", entry.name),
    type: "region" as const,
    name: entry.name,
    parentRegion: getBroadRegion(entry.name),
    restaurantCount: entry.count,
  })),
  ...categoryCounts.map((entry) => ({
    id: createSearchId("food", entry.name),
    type: "food" as const,
    name: entry.name,
    restaurantCount: entry.count,
  })),
  ...sourceSearchEntries.map((entry) => ({
    id: entry.source.id,
    type: "source" as const,
    name: entry.source.name,
    image: entry.source.imageUrl,
    restaurantCount: entry.restaurantCount,
    sourceTypeLabel: getSourceTypeLabel(entry.source.type),
  })),
  ...sortedRestaurants.map((restaurant) => ({
    id: restaurant.id,
    type: "restaurant" as const,
    name: restaurant.name,
    category: restaurant.category,
    address: restaurant.address,
  })),
];

export type {
  Creator,
  MatpickDataSet,
  MenuItem,
  Restaurant,
  SearchItem,
  SearchResult,
  Source,
  SourceLink,
  Visit,
} from "./types";
