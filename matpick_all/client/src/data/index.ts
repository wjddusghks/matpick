import rawDataset from "./matpick-data.json";
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

const dataset = rawDataset as MatpickDataSet;

export const creators: Creator[] = dataset.creators;
export const restaurants: Restaurant[] = dataset.restaurants;
export const visits: Visit[] = dataset.visits;
export const sources: Source[] = dataset.sources ?? [];
export const sourceLinks: SourceLink[] = dataset.sourceLinks ?? [];
export const dataSet: MatpickDataSet = dataset;

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
  const seriesSet = new Set(
    visits
      .filter((visit) => visit.restaurantId === restaurantId)
      .map((visit) => visit.series)
      .filter(Boolean)
  );

  return creators.filter((creator) => seriesSet.has(creator.series));
}

export function getRestaurantsByCreator(creatorId: string): Restaurant[] {
  const creator = creators.find((candidate) => candidate.id === creatorId);

  if (!creator) {
    return [];
  }

  const restaurantIds = new Set(
    visits
      .filter((visit) => visit.series === creator.series)
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

export function getTotalCreatorCount(): number {
  return creators.length;
}

export function getRecommendationCount(restaurantId: string): number {
  const seriesSet = new Set(
    visits
      .filter((visit) => visit.restaurantId === restaurantId)
      .map((visit) => visit.series)
      .filter(Boolean)
  );

  return seriesSet.size;
}

export function getAllCategories(): string[] {
  return Array.from(new Set(restaurants.map((restaurant) => restaurant.category).filter(Boolean))).sort(sortText);
}

export function getRegions(): string[] {
  return getBroadRegions();
}

export function getRestaurantsByCategory(category: string): Restaurant[] {
  return restaurants.filter((restaurant) => restaurant.category === category);
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
const categoryCounts = countBy(restaurants.map((restaurant) => restaurant.category));
const sortedRestaurants = [...restaurants].sort(
  (a, b) => getRecommendationCount(b.id) - getRecommendationCount(a.id) || sortText(a.name, b.name)
);

export const searchData: SearchItem[] = [
  ...creators.map((creator) => ({
    id: createSearchId("creator", creator.id),
    type: "creator" as const,
    name: `${creator.name} (${creator.series})`,
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
    name: `${creator.name} (${creator.series})`,
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
