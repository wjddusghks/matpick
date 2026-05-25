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
    slug: "popular-hongdae-ramen-best4",
    title: "EP1 홍대 라멘 맛집 BEST4",
    shortTitle: "홍대 라멘 BEST4",
    eyebrow: "진한 국물 라멘으로 먼저 떠오르는 코스",
    description: "홍대와 연남동 근처에서 라멘으로 고르기 좋은 인기 맛집 4곳입니다.",
    areaLabel: "홍대",
    purposeTags: [
      "홍대",
      "라멘",
      "일식"
    ],
    targetCount: 4,
    restaurantIds: [
      "popular_restaurants_hongdae_hakata_bunko",
      "popular_restaurants_hongdae_itsumo_ramen",
      "popular_restaurants_hongdae_566_ramen",
      "popular_restaurants_hongdae_sarukame"
    ],
    regionKeywords: [
      "홍대",
      "연남",
      "마포"
    ],
    cuisineKeywords: [
      "라멘",
      "일식"
    ],
    imageUrl: "/card-data/popular-restaurants/hongdae-ramen-main.webp",
    cardImageUrls: [
      "/card-data/popular-restaurants/hongdae-ramen-main.webp",
      "/card-data/popular-restaurants/hongdae-hakata-bunko.webp",
      "/card-data/popular-restaurants/hongdae-itsumo-ramen.webp",
      "/card-data/popular-restaurants/hongdae-566-ramen.webp",
      "/card-data/popular-restaurants/hongdae-sarukame.webp"
    ],
    palette: {
      background: "linear-gradient(145deg, #2d211c 0%, #6f3a29 48%, #f17b55 100%)",
      accent: "#ff8c66"
    }
  },
  {
    slug: "popular-gangnam-tonkatsu-best3",
    title: "EP2 강남 돈가스 맛집 BEST3",
    shortTitle: "강남 돈가스 BEST3",
    eyebrow: "강남에서 바삭한 카츠가 생각날 때",
    description: "강남과 압구정 근처에서 돈가스로 고르기 좋은 인기 맛집 3곳입니다.",
    areaLabel: "강남",
    purposeTags: [
      "돈가스",
      "일식",
      "강남"
    ],
    targetCount: 3,
    restaurantIds: [
      "popular_restaurants_gangnam_just_katsu",
      "popular_restaurants_gangnam_katsuwang",
      "popular_restaurants_gangnam_katsu_by_konban"
    ],
    regionKeywords: [
      "강남",
      "역삼",
      "압구정",
      "논현"
    ],
    cuisineKeywords: [
      "돈가스",
      "돈카츠",
      "일식"
    ],
    imageUrl: "/card-data/popular-restaurants/gangnam-tonkatsu-main.webp",
    cardImageUrls: [
      "/card-data/popular-restaurants/gangnam-tonkatsu-main.webp",
      "/card-data/popular-restaurants/gangnam-just-katsu.webp",
      "/card-data/popular-restaurants/gangnam-katsuwang.webp",
      "/card-data/popular-restaurants/gangnam-katsu-by-konban.webp"
    ],
    palette: {
      background: "linear-gradient(145deg, #1f1f1f 0%, #5a2b2b 52%, #ff6b74 100%)",
      accent: "#ff6b74"
    }
  },
  {
    slug: "popular-daehakro-tteokbokki-best3",
    title: "EP3 대학로 떡볶이 맛집 BEST3",
    shortTitle: "대학로 떡볶이 BEST3",
    eyebrow: "대학로에서 가볍게 먹고 싶을 때",
    description: "대학로와 혜화 근처에서 즉석떡볶이와 분식으로 고르기 좋은 인기 맛집 3곳입니다.",
    areaLabel: "대학로",
    purposeTags: [
      "대학로",
      "떡볶이",
      "분식"
    ],
    targetCount: 3,
    restaurantIds: [
      "popular_restaurants_daehakro_bongjju_tteokbokki",
      "popular_restaurants_daehakro_nanumi_tteokbokki",
      "popular_restaurants_daehakro_koyako"
    ],
    regionKeywords: [
      "대학로",
      "혜화",
      "종로"
    ],
    cuisineKeywords: [
      "떡볶이",
      "분식"
    ],
    imageUrl: "/card-data/popular-restaurants/daehakro-tteokbokki-main.webp",
    cardImageUrls: [
      "/card-data/popular-restaurants/daehakro-tteokbokki-main.webp",
      "/card-data/popular-restaurants/daehakro-bongjju-tteokbokki.webp",
      "/card-data/popular-restaurants/daehakro-nanumi-tteokbokki.webp",
      "/card-data/popular-restaurants/daehakro-koyako.webp"
    ],
    palette: {
      background: "linear-gradient(145deg, #251f3b 0%, #6b4ab3 48%, #ff93a7 100%)",
      accent: "#ff93a7"
    }
  },
  {
    slug: "popular-yeongdeungpo-jjamppong-best4",
    title: "EP4 영등포 짬뽕 맛집 BEST4",
    shortTitle: "영등포 짬뽕 BEST4",
    eyebrow: "불향 있는 국물이 당기는 날",
    description: "영등포 노포부터 매운맛까지 짬뽕으로 비교해보기 좋은 인기 맛집 4곳입니다.",
    areaLabel: "영등포",
    purposeTags: [
      "짬뽕",
      "중식",
      "매운맛"
    ],
    targetCount: 4,
    restaurantIds: [
      "popular_restaurants_yeongdeungpo_songjukjang",
      "popular_restaurants_yeongdeungpo_shinchai",
      "popular_restaurants_yeongdeungpo_dongsungak",
      "popular_restaurants_yeongdeungpo_singil_spicy_jjamppong"
    ],
    regionKeywords: [
      "영등포",
      "문래",
      "신길"
    ],
    cuisineKeywords: [
      "짬뽕",
      "중식"
    ],
    imageUrl: "/card-data/popular-restaurants/yeongdeungpo-jjamppong-main.webp",
    cardImageUrls: [
      "/card-data/popular-restaurants/yeongdeungpo-jjamppong-main.webp",
      "/card-data/popular-restaurants/yeongdeungpo-songjukjang.webp",
      "/card-data/popular-restaurants/yeongdeungpo-shinchai.webp",
      "/card-data/popular-restaurants/yeongdeungpo-dongsungak.webp",
      "/card-data/popular-restaurants/yeongdeungpo-singil-spicy-jjamppong.webp"
    ],
    palette: {
      background: "linear-gradient(145deg, #260707 0%, #7b1711 52%, #ff4236 100%)",
      accent: "#ff4236"
    }
  },
  {
    slug: "popular-suwon-chicken-best4",
    title: "EP5 수원 통닭 맛집 BEST4",
    shortTitle: "수원 통닭 BEST4",
    eyebrow: "수원 통닭거리에서 먼저 고를 곳",
    description: "수원 통닭거리와 행궁 근처에서 고르기 좋은 통닭 맛집 4곳입니다.",
    areaLabel: "수원",
    purposeTags: [
      "통닭",
      "치킨",
      "수원"
    ],
    targetCount: 4,
    restaurantIds: [
      "popular_restaurants_suwon_jinmi_chicken",
      "popular_restaurants_suwon_maehyang_chicken",
      "popular_restaurants_suwon_jangan_chicken",
      "popular_restaurants_suwon_haenggung_chicken"
    ],
    regionKeywords: [
      "수원",
      "팔달",
      "행궁"
    ],
    cuisineKeywords: [
      "통닭",
      "치킨"
    ],
    imageUrl: "/card-data/popular-restaurants/suwon-chicken-main.webp",
    cardImageUrls: [
      "/card-data/popular-restaurants/suwon-chicken-main.webp",
      "/card-data/popular-restaurants/suwon-jinmi-chicken.webp",
      "/card-data/popular-restaurants/suwon-maehyang-chicken.webp",
      "/card-data/popular-restaurants/suwon-jangan-chicken.webp",
      "/card-data/popular-restaurants/suwon-haenggung-chicken.webp"
    ],
    palette: {
      background: "linear-gradient(145deg, #21140b 0%, #8c431d 52%, #ff7c2e 100%)",
      accent: "#ff7c2e"
    }
  },
  {
    slug: "popular-jeonju-bibimbap-best3",
    title: "EP6 전주 비빔밥 맛집 BEST3",
    shortTitle: "전주 비빔밥 BEST3",
    eyebrow: "전주에서 첫 끼를 고른다면",
    description: "전주 여행에서 비빔밥과 한상차림으로 고르기 좋은 인기 맛집 3곳입니다.",
    areaLabel: "전주",
    purposeTags: [
      "비빔밥",
      "한식",
      "전주"
    ],
    targetCount: 3,
    restaurantIds: [
      "popular_restaurants_jeonju_gajok_hoegwan",
      "popular_restaurants_jeonju_seongmidang",
      "popular_restaurants_jeonju_gogung"
    ],
    regionKeywords: [
      "전주",
      "완산",
      "덕진"
    ],
    cuisineKeywords: [
      "비빔밥",
      "한식"
    ],
    imageUrl: "/card-data/popular-restaurants/jeonju-bibimbap-main.webp",
    cardImageUrls: [
      "/card-data/popular-restaurants/jeonju-bibimbap-main.webp",
      "/card-data/popular-restaurants/jeonju-gajok-hoegwan.webp",
      "/card-data/popular-restaurants/jeonju-seongmidang.webp",
      "/card-data/popular-restaurants/jeonju-gogung.webp"
    ],
    palette: {
      background: "linear-gradient(145deg, #32231b 0%, #9b6341 52%, #ff7b86 100%)",
      accent: "#ff7b86"
    }
  },
  {
    slug: "popular-cheongju-spicy-galbijjim-best3",
    title: "EP7 충북 매운 갈비찜 맛집 BEST3",
    shortTitle: "충북 매운 갈비찜 BEST3",
    eyebrow: "청주에서 매운 갈비찜이 당기는 날",
    description: "청주 성안길, 율량동, 봉명동에서 매운 갈비찜으로 고르기 좋은 인기 맛집 3곳입니다.",
    areaLabel: "청주",
    purposeTags: [
      "청주",
      "매운갈비찜",
      "한식"
    ],
    targetCount: 3,
    restaurantIds: [
      "popular_restaurants_cheongju_hwang_grandma_galbijip",
      "popular_restaurants_cheongju_changsu_spicy_galbijjim",
      "popular_restaurants_cheongju_ttabong_sikdang"
    ],
    regionKeywords: [
      "청주",
      "충북",
      "성안길",
      "율량동",
      "봉명동"
    ],
    cuisineKeywords: [
      "매운갈비찜",
      "갈비찜",
      "한식"
    ],
    imageUrl: "/card-data/popular-restaurants/cheongju-spicy-galbijjim-main.webp",
    cardImageUrls: [
      "/card-data/popular-restaurants/cheongju-spicy-galbijjim-main.webp",
      "/card-data/popular-restaurants/cheongju-hwang-grandma-galbijip.webp",
      "/card-data/popular-restaurants/cheongju-changsu-spicy-galbijjim.webp",
      "/card-data/popular-restaurants/cheongju-ttabong-sikdang.webp"
    ],
    palette: {
      background: "linear-gradient(145deg, #25110c 0%, #7d241a 52%, #ff5b3f 100%)",
      accent: "#ff5b3f"
    }
  }
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
