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
  restaurantIds?: string[];
  regionKeywords: string[];
  cuisineKeywords?: string[];
  sourceIds?: string[];
  palette: MapCollectionPalette;
  imageUrl?: string;
  cardImageUrls?: string[];
};

type ResolveCollectionOptions = {
  restaurants: Restaurant[];
  getRestaurantsBySource: (sourceId: string) => Restaurant[];
};

export const featuredMapCollections: MapCollectionTopic[] = [
  {
    slug: "popular-dongtan-best7",
    title: "동탄 맛집 BEST7",
    shortTitle: "동탄 BEST7",
    eyebrow: "동탄에서 뭐 먹을지 고민될 때",
    description: "동탄호수공원과 동탄역 근처에서 바로 고르기 좋은 인기 맛집 7곳입니다.",
    areaLabel: "동탄",
    purposeTags: ["동탄", "데이트", "가족"],
    targetCount: 7,
    restaurantIds: [
      "popular_restaurants_dongtan_babwie_saengseon",
      "popular_restaurants_dongtan_gate9",
      "popular_restaurants_dongtan_nongga",
      "popular_restaurants_dongtan_oh_italian",
      "popular_restaurants_dongtan_caffe_maia",
      "popular_restaurants_dongtan_gongwon_blues",
      "popular_restaurants_dongtan_jogakdal",
    ],
    regionKeywords: ["동탄", "화성"],
    imageUrl: "/card-data/popular-restaurants/dongtan-main.webp",
    cardImageUrls: [
      "/card-data/popular-restaurants/dongtan-main.webp",
      "/card-data/popular-restaurants/dongtan-babwie-saengseon.webp",
      "/card-data/popular-restaurants/dongtan-gate9.webp",
      "/card-data/popular-restaurants/dongtan-nongga.webp",
      "/card-data/popular-restaurants/dongtan-oh-italian.webp",
      "/card-data/popular-restaurants/dongtan-caffe-maia.webp",
      "/card-data/popular-restaurants/dongtan-gongwon-blues.webp",
      "/card-data/popular-restaurants/dongtan-jogakdal.webp",
    ],
    palette: {
      background: "linear-gradient(145deg, #26372f 0%, #3f7d63 52%, #ffd27a 100%)",
      accent: "#ff7b83",
    },
  },
  {
    slug: "popular-hongdae-ramen-best4",
    title: "홍대라멘 맛집 BEST4",
    shortTitle: "홍대라멘 BEST4",
    eyebrow: "진한 국물 라멘이 당길 때",
    description: "홍대와 연남동 근처에서 라멘으로 먼저 열어볼 만한 인기 맛집 4곳입니다.",
    areaLabel: "홍대",
    purposeTags: ["홍대", "라멘", "혼밥"],
    targetCount: 4,
    restaurantIds: [
      "popular_restaurants_hongdae_hakata_bunko",
      "popular_restaurants_hongdae_itsumo_ramen",
      "popular_restaurants_hongdae_566_ramen",
      "popular_restaurants_hongdae_sarukame",
    ],
    regionKeywords: ["홍대", "마포", "연남"],
    cuisineKeywords: ["라멘", "일식"],
    imageUrl: "/card-data/popular-restaurants/hongdae-ramen-main.webp",
    cardImageUrls: [
      "/card-data/popular-restaurants/hongdae-ramen-main.webp",
      "/card-data/popular-restaurants/hongdae-hakata-bunko.webp",
      "/card-data/popular-restaurants/hongdae-itsumo-ramen.webp",
      "/card-data/popular-restaurants/hongdae-566-ramen.webp",
      "/card-data/popular-restaurants/hongdae-sarukame.webp",
    ],
    palette: {
      background: "linear-gradient(145deg, #2d211c 0%, #6f3a29 48%, #f17b55 100%)",
      accent: "#ff8c66",
    },
  },
  {
    slug: "popular-daehakro-tteokbokki-best3",
    title: "대학로 떡볶이 BEST3",
    shortTitle: "대학로 떡볶이",
    eyebrow: "혜화에서 가볍게 먹고 싶을 때",
    description: "대학로와 혜화 근처에서 즉석떡볶이와 분식을 고르기 좋은 인기 맛집 3곳입니다.",
    areaLabel: "대학로",
    purposeTags: ["대학로", "떡볶이", "분식"],
    targetCount: 3,
    restaurantIds: [
      "popular_restaurants_daehakro_bongjju_tteokbokki",
      "popular_restaurants_daehakro_nanumi_tteokbokki",
      "popular_restaurants_daehakro_koyako",
    ],
    regionKeywords: ["대학로", "혜화", "종로"],
    cuisineKeywords: ["떡볶이", "분식"],
    imageUrl: "/card-data/popular-restaurants/daehakro-tteokbokki-main.webp",
    cardImageUrls: [
      "/card-data/popular-restaurants/daehakro-tteokbokki-main.webp",
      "/card-data/popular-restaurants/daehakro-bongjju-tteokbokki.webp",
      "/card-data/popular-restaurants/daehakro-nanumi-tteokbokki.webp",
      "/card-data/popular-restaurants/daehakro-koyako.webp",
    ],
    palette: {
      background: "linear-gradient(145deg, #251f3b 0%, #6b4ab3 48%, #ff93a7 100%)",
      accent: "#ff93a7",
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
  if (collection.restaurantIds?.length) {
    const restaurantById = new Map(
      options.restaurants.map((restaurant) => [restaurant.id, restaurant])
    );
    return collection.restaurantIds
      .map((restaurantId) => restaurantById.get(restaurantId))
      .filter((restaurant): restaurant is Restaurant => Boolean(restaurant))
      .slice(0, collection.targetCount);
  }

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
