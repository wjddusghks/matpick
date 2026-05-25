import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..", "..");
const enrichmentPath = path.join(
  projectRoot,
  "client",
  "src",
  "data",
  "generated",
  "topic-enrichments",
  "popular-restaurants.enriched.json"
);
const mapCollectionsPath = path.join(projectRoot, "client", "src", "data", "mapCollections.ts");

const restaurantRows = [
  {
    id: "popular_restaurants_gangnam_katsu_by_konban",
    name: "카츠바이콘반",
    region: "서울 강남구",
    address: "서울 강남구 선릉로153길 36 1층",
    category: "일식",
    representativeMenu: "상로스카츠 / 로스카츠 / 히레카츠",
    lat: 37.524206566936396,
    lng: 127.03706865161636,
    imageUrl: "/card-data/popular-restaurants/gangnam-katsu-by-konban.webp",
    menus: [
      ["상로스카츠", "19,000원", true],
      ["로스카츠", "17,000원"],
      ["히레카츠", "19,000원"],
    ],
    episode: "EP.2",
    ordinal: 3,
    note: "상로스카츠 한 점으로 기억나는 압구정 카츠입니다.",
  },
  {
    id: "popular_restaurants_gangnam_katsuwang",
    name: "카츠왕",
    region: "서울 강남구",
    address: "서울특별시 강남구 테헤란로4길 6 지하1층 B101호",
    category: "일식",
    representativeMenu: "등심돈카츠 / 안심돈카츠 / 안심&등심",
    lat: 37.4974102132335,
    lng: 127.029086283948,
    imageUrl: "/card-data/popular-restaurants/gangnam-katsuwang.webp",
    menus: [
      ["등심돈카츠", "10,500원", true],
      ["안심돈카츠", "12,500원"],
      ["안심&등심", "11,900원"],
      ["고구마치즈카츠", "10,500원"],
    ],
    episode: "EP.2",
    ordinal: 2,
    note: "강남역에서 빠르게 고르는 든든한 돈카츠 정식입니다.",
  },
  {
    id: "popular_restaurants_gangnam_just_katsu",
    name: "저스트카츠",
    region: "서울 강남구",
    address: "서울특별시 강남구 학동로4길 10 101호",
    category: "일식",
    representativeMenu: "등심돈카츠정식 / 안심돈카츠정식 / 카츠산도",
    lat: 37.511295,
    lng: 127.022192,
    imageUrl: "/card-data/popular-restaurants/gangnam-just-katsu.webp",
    menus: [
      ["등심돈카츠정식", "12,500원", true],
      ["안심돈카츠정식", "13,500원"],
      ["스페셜 돈카츠 정식", "18,400원"],
      ["카츠산도", "11,900원"],
    ],
    episode: "EP.2",
    ordinal: 1,
    note: "멘치카츠와 카츠산도까지 챙기는 논현 골목 카츠입니다.",
  },
  {
    id: "popular_restaurants_yeongdeungpo_songjukjang",
    name: "송죽장",
    region: "서울 영등포구",
    address: "서울 영등포구 문래로 203",
    category: "중식",
    representativeMenu: "짬뽕 / 삼선짬뽕 / 탕수육",
    lat: 37.5182009,
    lng: 126.9047157,
    imageUrl: "/card-data/popular-restaurants/yeongdeungpo-songjukjang.webp",
    menus: [
      ["짬뽕", "10,000원", true],
      ["삼선짬뽕", "13,000원"],
      ["짜장", "8,500원"],
      ["탕수육(중)", "27,000원"],
    ],
    episode: "EP.4",
    ordinal: 1,
    note: "영등포 노포 분위기에서 만나는 얼큰한 기본기입니다.",
  },
  {
    id: "popular_restaurants_yeongdeungpo_shinchai",
    name: "신차이",
    region: "서울 영등포구",
    address: "서울특별시 영등포구 영중로 15 타임스퀘어 4층",
    category: "중식",
    representativeMenu: "얼큰해물짬뽕 / 짜장면 / 소룡포",
    lat: 37.517184,
    lng: 126.903373,
    imageUrl: "/card-data/popular-restaurants/yeongdeungpo-shinchai.webp",
    menus: [
      ["얼큰해물짬뽕", "17,000원", true],
      ["짜장면", "12,000원"],
      ["소룡포", "13,000원"],
      ["삼선볶음밥", "17,000원"],
    ],
    episode: "EP.4",
    ordinal: 2,
    note: "타임스퀘어 쇼핑 뒤 소룡포와 같이 먹기 좋은 짬뽕입니다.",
  },
  {
    id: "popular_restaurants_yeongdeungpo_dongsungak",
    name: "동순각",
    region: "서울 영등포구",
    address: "서울 영등포구 영등포로45길 14-5",
    category: "중식",
    representativeMenu: "짬뽕 / 짜장면 / 간짜장",
    lat: 37.517733,
    lng: 126.906582,
    imageUrl: "/card-data/popular-restaurants/yeongdeungpo-dongsungak.webp",
    menus: [
      ["짬뽕", "8,000원", true],
      ["짜장면", "7,000원"],
      ["간짜장", "8,000원"],
      ["삼선간짜장", "10,000원"],
    ],
    episode: "EP.4",
    ordinal: 3,
    note: "짜장과 짬뽕을 같이 떠올리게 하는 동네 중식 한 끼입니다.",
  },
  {
    id: "popular_restaurants_yeongdeungpo_singil_spicy_jjamppong",
    name: "신길동 매운짬뽕",
    region: "서울 영등포구",
    address: "서울특별시 영등포구 영등포로62길 10-1",
    category: "중식",
    representativeMenu: "매운짬뽕 / 짬뽕밥 / 탕수육",
    lat: 37.514909,
    lng: 126.915457,
    imageUrl: "/card-data/popular-restaurants/yeongdeungpo-singil-spicy-jjamppong.webp",
    menus: [
      ["매운짬뽕", "14,000원", true],
      ["매운짬뽕 곱빼기", "16,000원"],
      ["짬뽕밥", "15,000원"],
      ["탕수육(소)", "18,000원"],
    ],
    episode: "EP.4",
    ordinal: 4,
    note: "매운맛 각오하고 가는 신길동 대표 도전 짬뽕입니다.",
  },
  {
    id: "popular_restaurants_suwon_jinmi_chicken",
    name: "진미통닭",
    region: "경기 수원시",
    address: "경기도 수원시 팔달구 정조로800번길 21 진미통닭",
    category: "치킨",
    representativeMenu: "후라이드치킨 / 양념치킨",
    lat: 37.2796585,
    lng: 127.0181226,
    imageUrl: "/card-data/popular-restaurants/suwon-jinmi-chicken.webp",
    menus: [
      ["후라이드치킨", "18,000원", true],
      ["양념치킨", "19,000원"],
    ],
    episode: "EP.5",
    ordinal: 1,
    note: "수원 통닭거리에서 먼저 떠오르는 바삭한 후라이드입니다.",
  },
  {
    id: "popular_restaurants_suwon_maehyang_chicken",
    name: "매향통닭",
    region: "경기 수원시",
    address: "경기 수원시 팔달구 수원천로 317",
    category: "치킨",
    representativeMenu: "후라이드치킨 / 매향반반 / 갈비통닭",
    lat: 37.280848,
    lng: 127.018327,
    imageUrl: "/card-data/popular-restaurants/suwon-maehyang-chicken.webp",
    menus: [
      ["후라이드치킨", "21,000원", true],
      ["매향반반", "22,000원"],
      ["양념치킨", "22,000원"],
      ["갈비통닭", "25,000원"],
    ],
    episode: "EP.5",
    ordinal: 2,
    note: "반반과 갈비통닭까지 고르는 통닭거리 선택지입니다.",
  },
  {
    id: "popular_restaurants_suwon_jangan_chicken",
    name: "장안통닭",
    region: "경기 수원시",
    address: "경기 수원시 팔달구 팔달문로3번길 42",
    category: "치킨",
    representativeMenu: "후라이드 / 왕갈비통닭 / 마늘통닭",
    lat: 37.280246,
    lng: 127.018041,
    imageUrl: "/card-data/popular-restaurants/suwon-jangan-chicken.webp",
    menus: [
      ["후라이드", "18,000원", true],
      ["양념", "19,000원"],
      ["마늘통닭", "20,000원"],
      ["왕갈비통닭", "20,000원"],
    ],
    episode: "EP.5",
    ordinal: 3,
    note: "왕갈비와 마늘통닭으로 취향이 갈리는 수원 노포입니다.",
  },
  {
    id: "popular_restaurants_suwon_haenggung_chicken",
    name: "행궁통닭",
    region: "경기 수원시",
    address: "경기 수원시 팔달구 수원천로 291 행궁통닭",
    category: "치킨",
    representativeMenu: "후라이드치킨 / 양념치킨 / 간마고",
    lat: 37.2784402523428,
    lng: 127.018205191083,
    imageUrl: "/card-data/popular-restaurants/suwon-haenggung-chicken.webp",
    menus: [
      ["후라이드치킨", "20,000원", true],
      ["양념치킨", "21,000원"],
      ["양념반후라이드반", "21,000원"],
      ["간마고", "25,000원"],
    ],
    episode: "EP.5",
    ordinal: 4,
    note: "행궁 산책 뒤 간장·마늘·고추 조합으로 마무리하기 좋습니다.",
  },
  {
    id: "popular_restaurants_jeonju_gajok_hoegwan",
    name: "가족회관",
    region: "전북 전주시",
    address: "전북 전주시 완산구 전라감영5길 17 가족회관",
    category: "한식",
    representativeMenu: "전주비빔밥 / 육회비빔밥",
    lat: 35.817355,
    lng: 127.145082,
    imageUrl: "/card-data/popular-restaurants/jeonju-gajok-hoegwan.webp",
    menus: [
      ["전주비빔밥", "15,000원", true],
      ["육회비빔밥", "17,000원"],
    ],
    episode: "EP.6",
    ordinal: 1,
    note: "육회비빔밥으로 전주 한 끼를 시작하기 좋은 곳입니다.",
  },
  {
    id: "popular_restaurants_jeonju_seongmidang",
    name: "성미당",
    region: "전북 전주시",
    address: "전북 전주시 완산구 전라감영5길 19-9",
    category: "한식",
    representativeMenu: "전주비빔밥 / 육회비빔밥 / 해물파전",
    lat: 35.8173299,
    lng: 127.1452968,
    imageUrl: "/card-data/popular-restaurants/jeonju-seongmidang.webp",
    menus: [
      ["전주비빔밥", "16,000원", true],
      ["국내산 육우", "18,000원"],
      ["해물파전", "14,000원"],
    ],
    episode: "EP.6",
    ordinal: 2,
    note: "오래된 전주비빔밥 명가의 정갈한 한 그릇입니다.",
  },
  {
    id: "popular_restaurants_jeonju_gogung",
    name: "고궁",
    region: "전북 전주시",
    address: "전북 전주시 덕진구 송천중앙로 33",
    category: "한식",
    representativeMenu: "전주전통비빔밥 / 육회비빔밥 / 떡갈비",
    lat: 35.8500668,
    lng: 127.1194169,
    imageUrl: "/card-data/popular-restaurants/jeonju-gogung.webp",
    menus: [
      ["전주전통비빔밥", "14,000원", true],
      ["육회비빔밥", "18,000원"],
      ["돌솥비빔밥", "16,000원"],
      ["숯불떡갈비", "15,000원"],
    ],
    episode: "EP.6",
    ordinal: 3,
    note: "비빔밥과 떡갈비를 한 상으로 묶기 좋은 전주 본점입니다.",
  },
];

const collections = [
  {
    slug: "popular-gangnam-tonkatsu-best3",
    title: "EP2 강남 돈가스 맛집 BEST3",
    shortTitle: "강남 돈가스",
    eyebrow: "인간 추천과 AI 추천을 같이 비교한 카츠 코스",
    description: "강남역과 압구정 근처에서 고르기 좋은 돈가스 맛집 3곳입니다.",
    areaLabel: "강남",
    purposeTags: ["돈가스", "일식", "강남"],
    targetCount: 3,
    restaurantIds: [
      "popular_restaurants_gangnam_just_katsu",
      "popular_restaurants_gangnam_katsuwang",
      "popular_restaurants_gangnam_katsu_by_konban",
    ],
    regionKeywords: ["강남", "역삼", "압구정", "논현"],
    cuisineKeywords: ["돈가스", "돈카츠", "일식"],
    imageUrl: "/card-data/popular-restaurants/gangnam-tonkatsu-main.webp",
    cardImageUrls: [
      "/card-data/popular-restaurants/gangnam-tonkatsu-main.webp",
      "/card-data/popular-restaurants/gangnam-just-katsu.webp",
      "/card-data/popular-restaurants/gangnam-katsuwang.webp",
      "/card-data/popular-restaurants/gangnam-katsu-by-konban.webp",
    ],
    palette: {
      background: "linear-gradient(145deg, #1f1f1f 0%, #5a2b2b 52%, #ff6b74 100%)",
      accent: "#ff6b74",
    },
  },
  {
    slug: "popular-yeongdeungpo-jjamppong-best4",
    title: "EP4 영등포 짬뽕 추천 BEST4",
    shortTitle: "영등포 짬뽕",
    eyebrow: "얼큰한 국물파를 위한 영등포 중식 코스",
    description: "영등포 노포부터 매운맛까지 짬뽕으로 비교해보기 좋은 맛집 4곳입니다.",
    areaLabel: "영등포",
    purposeTags: ["짬뽕", "중식", "매운맛"],
    targetCount: 4,
    restaurantIds: [
      "popular_restaurants_yeongdeungpo_songjukjang",
      "popular_restaurants_yeongdeungpo_shinchai",
      "popular_restaurants_yeongdeungpo_dongsungak",
      "popular_restaurants_yeongdeungpo_singil_spicy_jjamppong",
    ],
    regionKeywords: ["영등포", "문래", "신길"],
    cuisineKeywords: ["짬뽕", "중식"],
    imageUrl: "/card-data/popular-restaurants/yeongdeungpo-jjamppong-main.webp",
    cardImageUrls: [
      "/card-data/popular-restaurants/yeongdeungpo-jjamppong-main.webp",
      "/card-data/popular-restaurants/yeongdeungpo-songjukjang.webp",
      "/card-data/popular-restaurants/yeongdeungpo-shinchai.webp",
      "/card-data/popular-restaurants/yeongdeungpo-dongsungak.webp",
      "/card-data/popular-restaurants/yeongdeungpo-singil-spicy-jjamppong.webp",
    ],
    palette: {
      background: "linear-gradient(145deg, #260707 0%, #7b1711 52%, #ff4236 100%)",
      accent: "#ff4236",
    },
  },
  {
    slug: "popular-suwon-chicken-best4",
    title: "EP5 수원 통닭 맛집 BEST4",
    shortTitle: "수원 통닭",
    eyebrow: "통닭거리에서 고르는 수원 대표 코스",
    description: "수원 통닭거리와 행궁 근처에서 고르기 좋은 통닭 맛집 4곳입니다.",
    areaLabel: "수원",
    purposeTags: ["통닭", "치킨", "수원"],
    targetCount: 4,
    restaurantIds: [
      "popular_restaurants_suwon_jinmi_chicken",
      "popular_restaurants_suwon_maehyang_chicken",
      "popular_restaurants_suwon_jangan_chicken",
      "popular_restaurants_suwon_haenggung_chicken",
    ],
    regionKeywords: ["수원", "팔달", "행궁"],
    cuisineKeywords: ["통닭", "치킨"],
    imageUrl: "/card-data/popular-restaurants/suwon-chicken-main.webp",
    cardImageUrls: [
      "/card-data/popular-restaurants/suwon-chicken-main.webp",
      "/card-data/popular-restaurants/suwon-jinmi-chicken.webp",
      "/card-data/popular-restaurants/suwon-maehyang-chicken.webp",
      "/card-data/popular-restaurants/suwon-jangan-chicken.webp",
      "/card-data/popular-restaurants/suwon-haenggung-chicken.webp",
    ],
    palette: {
      background: "linear-gradient(145deg, #21140b 0%, #8c431d 52%, #ff7c2e 100%)",
      accent: "#ff7c2e",
    },
  },
  {
    slug: "popular-jeonju-bibimbap-best3",
    title: "EP6 전주 1등 맛집 BEST3",
    shortTitle: "전주 1등 맛집",
    eyebrow: "비빔밥과 한상차림으로 시작하는 전주 대표 한 끼",
    description: "전주 여행에서 비빔밥을 기준으로 고르기 좋은 대표 맛집 3곳입니다.",
    areaLabel: "전주",
    purposeTags: ["비빔밥", "한식", "전주"],
    targetCount: 3,
    restaurantIds: [
      "popular_restaurants_jeonju_gajok_hoegwan",
      "popular_restaurants_jeonju_seongmidang",
      "popular_restaurants_jeonju_gogung",
    ],
    regionKeywords: ["전주", "완산", "덕진"],
    cuisineKeywords: ["비빔밥", "한식"],
    imageUrl: "/card-data/popular-restaurants/jeonju-bibimbap-main.webp",
    cardImageUrls: [
      "/card-data/popular-restaurants/jeonju-bibimbap-main.webp",
      "/card-data/popular-restaurants/jeonju-gajok-hoegwan.webp",
      "/card-data/popular-restaurants/jeonju-seongmidang.webp",
      "/card-data/popular-restaurants/jeonju-gogung.webp",
    ],
    palette: {
      background: "linear-gradient(145deg, #32231b 0%, #9b6341 52%, #ff7b86 100%)",
      accent: "#ff7b86",
    },
  },
];

function toRestaurant(row) {
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    address: row.address,
    category: row.category,
    representativeMenu: row.representativeMenu,
    lat: row.lat,
    lng: row.lng,
    imageUrl: row.imageUrl,
    foundingYear: null,
    menus: row.menus.map(([name, price, isSignature], index) => ({
      id: `${row.id}_menu_${index + 1}`,
      name,
      price,
      ...(isSignature ? { isSignature: true } : {}),
    })),
  };
}

function toSourceLink(row) {
  return {
    id: `${row.id}_link`,
    restaurantId: row.id,
    sourceId: "popular-restaurants",
    ordinal: row.ordinal,
    label: row.episode,
    note: row.note,
  };
}

function updateEnrichment() {
  const data = JSON.parse(fs.readFileSync(enrichmentPath, "utf8"));
  const ids = new Set(restaurantRows.map((row) => row.id));
  data.restaurants = [
    ...(data.restaurants ?? []).filter((restaurant) => !ids.has(restaurant.id)),
    ...restaurantRows.map(toRestaurant),
  ];
  data.sourceLinks = [
    ...(data.sourceLinks ?? []).filter((link) => !ids.has(link.restaurantId)),
    ...restaurantRows.map(toSourceLink),
  ];
  const source = data.sources?.find((item) => item.id === "popular-restaurants");
  if (source) {
    source.imageUrl = "/card-data/popular-restaurants/gangnam-tonkatsu-main.webp";
  }
  fs.writeFileSync(enrichmentPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function formatTs(value, indent = 2) {
  const json = JSON.stringify(value, null, 2)
    .replace(/"([^"]+)":/g, "$1:")
    .replace(/"/g, '"');
  return json
    .split("\n")
    .map((line) => `${" ".repeat(indent)}${line}`)
    .join("\n");
}

function updateMapCollections() {
  const begin = "  // BEGIN generated popular episode collections\n";
  const end = "  // END generated popular episode collections\n";
  let source = fs.readFileSync(mapCollectionsPath, "utf8");

  if (source.includes(begin) && source.includes(end)) {
    const start = source.indexOf(begin);
    const finish = source.indexOf(end, start) + end.length;
    source = `${source.slice(0, start)}${source.slice(finish)}`;
  }

  const block =
    begin +
    collections.map((collection) => `${formatTs(collection, 2)},`).join("\n") +
    "\n" +
    end;

  const marker = "\n];\n\nfunction normalizeLookupText";
  if (!source.includes(marker)) {
    throw new Error("Could not find featuredMapCollections closing marker.");
  }

  source = source.replace(marker, `\n${block}];\n\nfunction normalizeLookupText`);
  fs.writeFileSync(mapCollectionsPath, source, "utf8");
}

updateEnrichment();
updateMapCollections();
console.log(`Registered ${restaurantRows.length} restaurants and ${collections.length} map collections.`);
