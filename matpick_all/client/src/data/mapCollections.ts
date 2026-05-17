import type { Restaurant } from "./types";

export type MapCollectionPalette = {
  background: string;
  accent: string;
};

export type MapCollectionTopic = {
  slug: string;
  title: string;
  shortTitle: string;
  eyebrow: string;
  description: string;
  areaLabel: string;
  purposeTags: string[];
  targetCount: number;
  regionKeywords: string[];
  cuisineKeywords?: string[];
  sourceIds?: string[];
  palette: MapCollectionPalette;
};

type ResolveCollectionOptions = {
  restaurants: Restaurant[];
  getRestaurantsBySource: (sourceId: string) => Restaurant[];
};

export const featuredMapCollections: MapCollectionTopic[] = [
  {
    slug: "busan-rising-16",
    title: "요즘 뜨는 부산 맛집 16",
    shortTitle: "부산 맛집 16",
    eyebrow: "부산 여행 계획 중이라면",
    description: "방송과 크리에이터 출처가 있는 부산 맛집을 지도에서 한 번에 봅니다.",
    areaLabel: "부산",
    purposeTags: ["여행", "핫플", "지도"],
    targetCount: 16,
    regionKeywords: ["부산"],
    sourceIds: [
      "ttoganjip",
      "delicious-guys",
      "sikgaek-baekban-trip",
      "wednesday-gourmet",
      "baekjong-wok",
    ],
    palette: {
      background: "linear-gradient(145deg, #2d211c 0%, #6f3a29 48%, #f17b55 100%)",
      accent: "#ff7b83",
    },
  },
  {
    slug: "gangnam-famous-12",
    title: "강남구 유명 맛집 12",
    shortTitle: "강남구 맛집 12",
    eyebrow: "약속 전 빠르게 고를 때",
    description: "강남, 역삼, 신사, 압구정 근처의 유명 맛집 후보를 모았습니다.",
    areaLabel: "강남구",
    purposeTags: ["점심", "회식", "데이트"],
    targetCount: 12,
    regionKeywords: ["강남", "역삼", "신사", "압구정", "청담", "논현", "삼성"],
    sourceIds: ["ttoganjip", "delicious-guys", "michelin", "wednesday-gourmet"],
    palette: {
      background: "linear-gradient(145deg, #251f3b 0%, #6b4ab3 48%, #ff93a7 100%)",
      accent: "#ffb0c0",
    },
  },
  {
    slug: "seongsu-date-12",
    title: "성수 데이트 맛집 12",
    shortTitle: "성수 데이트 12",
    eyebrow: "데이트 동선 짜는 중이라면",
    description: "성수와 성동구 근처에서 같이 가기 좋은 유명 맛집을 추렸습니다.",
    areaLabel: "성수",
    purposeTags: ["데이트", "카페", "저녁"],
    targetCount: 12,
    regionKeywords: ["성수", "성동"],
    sourceIds: ["ttoganjip", "michelin", "sikgaek-baekban-trip"],
    palette: {
      background: "linear-gradient(145deg, #26372f 0%, #3f7d63 52%, #ffd27a 100%)",
      accent: "#ffd27a",
    },
  },
  {
    slug: "yongin-famous-12",
    title: "용인시 유명 맛집 12",
    shortTitle: "용인 맛집 12",
    eyebrow: "근교 나들이 전에",
    description: "용인 근처에서 들를 만한 방송·가이드 기반 맛집 후보입니다.",
    areaLabel: "용인",
    purposeTags: ["근교", "가족", "나들이"],
    targetCount: 12,
    regionKeywords: ["용인"],
    sourceIds: ["delicious-guys", "sikgaek-baekban-trip", "wednesday-gourmet"],
    palette: {
      background: "linear-gradient(145deg, #1c3146 0%, #2278a7 52%, #86d2ff 100%)",
      accent: "#86d2ff",
    },
  },
  {
    slug: "yeonnam-solo-9",
    title: "연남동 혼밥 맛집 9",
    shortTitle: "연남 혼밥 9",
    eyebrow: "혼자 가도 부담 적은 곳",
    description: "연남·마포 근처에서 혼자 고르기 쉬운 맛집 후보를 모았습니다.",
    areaLabel: "연남",
    purposeTags: ["혼밥", "마포", "가벼운 식사"],
    targetCount: 9,
    regionKeywords: ["연남", "마포", "홍대"],
    sourceIds: ["ttoganjip", "delicious-guys", "wednesday-gourmet"],
    palette: {
      background: "linear-gradient(145deg, #38211b 0%, #a04e38 50%, #ffd2b8 100%)",
      accent: "#ffd2b8",
    },
  },
  {
    slug: "haeundae-weekend-12",
    title: "해운대 주말 맛집 12",
    shortTitle: "해운대 주말 12",
    eyebrow: "부산 주말 코스가 필요할 때",
    description: "해운대와 부산 동선에 넣기 좋은 유명 맛집을 지도 중심으로 봅니다.",
    areaLabel: "해운대",
    purposeTags: ["주말", "부산", "여행"],
    targetCount: 12,
    regionKeywords: ["해운대", "부산"],
    sourceIds: ["ttoganjip", "delicious-guys", "sikgaek-baekban-trip"],
    palette: {
      background: "linear-gradient(145deg, #19324d 0%, #2e79b8 48%, #ffcf86 100%)",
      accent: "#ffcf86",
    },
  },
];

function normalizeLookupText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function restaurantMatchesKeywords(restaurant: Restaurant, keywords: string[]) {
  if (keywords.length === 0) {
    return true;
  }

  const haystack = normalizeLookupText(
    [
      restaurant.name,
      restaurant.region,
      restaurant.address,
      restaurant.category,
      restaurant.representativeMenu,
    ].join(" ")
  );

  return keywords.some((keyword) => haystack.includes(normalizeLookupText(keyword)));
}

function dedupeRestaurants(items: Restaurant[]) {
  const byId = new Map<string, Restaurant>();
  items.forEach((restaurant) => {
    if (!byId.has(restaurant.id)) {
      byId.set(restaurant.id, restaurant);
    }
  });
  return Array.from(byId.values());
}

function scoreRestaurant(restaurant: Restaurant) {
  let score = 0;
  if (restaurant.lat && restaurant.lng) score += 4;
  if (restaurant.representativeMenu?.trim()) score += 3;
  if (restaurant.imageUrl?.trim()) score += 2;
  if (restaurant.address?.trim()) score += 1;
  return score;
}

export function getMapCollectionTopicBySlug(slug: string) {
  return featuredMapCollections.find((collection) => collection.slug === slug) ?? null;
}

export function getMapCollectionPath(slug: string) {
  return `/map?type=collection&value=${encodeURIComponent(slug)}`;
}

export function getRestaurantsForMapCollection(
  collection: MapCollectionTopic,
  options: ResolveCollectionOptions
) {
  const sourceRestaurants = dedupeRestaurants(
    (collection.sourceIds ?? []).flatMap((sourceId) =>
      options.getRestaurantsBySource(sourceId)
    )
  );
  const basePool = sourceRestaurants.length > 0 ? sourceRestaurants : options.restaurants;
  const fallbackPool =
    sourceRestaurants.length > 0
      ? options.restaurants.filter((restaurant) =>
          restaurantMatchesKeywords(restaurant, collection.regionKeywords)
        )
      : [];

  const matchesCollection = (restaurant: Restaurant) =>
    restaurantMatchesKeywords(restaurant, collection.regionKeywords) &&
    restaurantMatchesKeywords(restaurant, collection.cuisineKeywords ?? []);

  const primaryMatches = basePool.filter(matchesCollection);
  const fallbackMatches = fallbackPool.filter(matchesCollection);

  return dedupeRestaurants([...primaryMatches, ...fallbackMatches])
    .sort((left, right) => scoreRestaurant(right) - scoreRestaurant(left))
    .slice(0, collection.targetCount);
}
