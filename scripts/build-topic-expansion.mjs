import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { identityMatch } from "./menu-research/matching.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = "source-data/topic-expansion-2026-09";
const read = async (p) =>
  JSON.parse(await fs.readFile(path.join(root, p), "utf8"));
const write = (p, value) =>
  fs.writeFile(path.join(root, p), JSON.stringify(value, null, 2) + "\n");
const topics = [
  [
    "life-master",
    "생활의 달인",
    "Master of Living",
    "tv_show",
    "SBS",
    "생활 속 달인과 지역 식당을 소개하는 SBS 프로그램입니다. 방송사 식당 안내와 실제 지점을 대조했습니다.",
    "달인",
  ],
  [
    "saturday-food",
    "토요일은 밥이 좋아",
    "Saturday Food",
    "tv_show",
    "E채널",
    "출연자들이 지역 음식을 찾아가는 E채널 프로그램입니다. 방송 영상과 매장 방송 출연 정보로 지점을 확인했습니다.",
    "토밥",
  ],
  [
    "neighborhood-walk",
    "동네 한 바퀴",
    "A Walk Around the Neighborhood",
    "tv_show",
    "KBS",
    "동네의 사람과 음식을 만나는 KBS 프로그램입니다. 공식 방송정보에 소개된 음식점을 수록합니다.",
    "동네",
  ],
  [
    "mogeultende",
    "성시경 먹을텐데",
    "Sung Si-kyung Food",
    "creator",
    "성시경",
    "성시경이 식당을 방문하는 유튜브 시리즈입니다. 공식 영상 소개 이력과 현재 식당 지점을 확인했습니다.",
    "먹텐",
  ],
  [
    "chureupkyeon",
    "츄릅켠",
    "Chureupkyeon",
    "creator",
    "츄릅켠",
    "부산을 중심으로 식당을 소개하는 유튜브 채널입니다. 공식 영상 설명에 나온 식당 정보를 확인했습니다.",
    "츄릅",
  ],
  [
    "jeju-eddy",
    "제주에디",
    "Jeju Eddy",
    "creator",
    "제주에디",
    "제주 여행과 식당을 소개하는 유튜브 채널입니다. 공식 영상에 소개된 식당의 상호·지역을 지도 정보와 대조했습니다.",
    "제주",
  ],
  [
    "kim-three-meals",
    "김사원세끼",
    "Kim Three Meals",
    "creator",
    "김사원세끼",
    "직장인이 찾는 식당과 한 끼를 소개하는 유튜브 채널입니다. 공식 영상 설명의 식당을 수록합니다.",
    "세끼",
  ],
  [
    "taste-of-seoul",
    "서울미식 100선",
    "Taste of Seoul",
    "guide",
    "서울관광재단",
    "서울관광재단의 서울미식 안내입니다. 각 식당에 표시된 선정 연도를 함께 안내하며, 현재 연도 선정으로 바꾸어 표시하지 않습니다.",
    "서울",
  ],
  [
    "century-stores",
    "백년가게",
    "Century Stores",
    "institution",
    "중소벤처기업부",
    "오래 이어온 가게의 성장을 지원하는 백년가게 제도입니다. 공식 관광정보에서 선정 이력이 확인된 음식점을 수록합니다.",
    "백년",
  ],
  [
    "good-price",
    "착한가격업소",
    "Good Price Restaurants",
    "institution",
    "행정안전부·지방자치단체",
    "가격과 서비스 등을 기준으로 지방자치단체가 지정한 업소입니다. 공식 안내에서 확인한 음식점이며 메뉴 가격은 확인 시점 기준입니다.",
    "착한",
  ],
];
const queue = await read(`${dir}/queue.json`),
  results = (await read(`${dir}/results.json`)).restaurants;
let base;
try {
  base = await read(`${dir}/existing-restaurants.json`);
} catch {
  base = (
    await read("matpick_all/client/src/data/generated/public-dataset.json")
  ).restaurants.map(
    ({
      id,
      name,
      address,
      lat,
      lng,
      kakaoPlaceId,
      operationState,
      recommendationHold,
    }) => ({
      id,
      name,
      address,
      lat,
      lng,
      kakaoPlaceId,
      operationState,
      recommendationHold,
    }),
  );
  await write(`${dir}/existing-restaurants.json`, base);
}
const restaurants = new Map(),
  canonical = new Map(),
  sourceLinks = [],
  review = [],
  approved = [];
for (const c of queue) {
  const r = results[c.id];
  const hold = (reason) =>
    review.push({ id: c.id, topicId: c.topicId, name: c.name, reason });
  if (
    !r ||
    ![
      "verified_priced",
      "verified_menu_only",
      "public_menu_unavailable",
    ].includes(r.status) ||
    !r.match?.accepted
  ) {
    hold(r?.status || "not_checked");
    continue;
  }
  if (
    !c.evidence?.length ||
    c.evidence.some((e) => !e.url || !e.sourceObservedAt)
  ) {
    hold("source_evidence_missing");
    continue;
  }
  const p = r.place;
  if (!(p.lat >= 33 && p.lat <= 39 && p.lng >= 124 && p.lng <= 132)) {
    hold("coordinates_invalid");
    continue;
  }
  const samePlace = base.filter(
    (b) => b.kakaoPlaceId === p.kakaoPlaceId && identityMatch(p, b).accepted,
  );
  const matches = samePlace.length
    ? samePlace
    : base.filter((b) => identityMatch(p, b).accepted);
  if (matches.length > 1) {
    hold("canonical_identity_ambiguous");
    continue;
  }
  const existing = canonical.get(p.kakaoPlaceId) || matches[0];
  if (
    existing?.recommendationHold ||
    ["closed", "moved", "temporarily_closed"].includes(existing?.operationState)
  ) {
    hold("existing_record_requires_review");
    continue;
  }
  const id = existing?.id || c.id;
  const menus = r.menus.map((m, i) => ({
    id: `m${i}`,
    name: m.name,
    ...(m.price ? { price: m.price } : {}),
    ...(m.isSignature ? { isSignature: true } : {}),
  }));
  const item = {
    id,
    name: existing?.name || p.name,
    address: existing?.address || p.address,
    lat: p.lat,
    lng: p.lng,
    category: c.category || "음식점",
    region: p.address.split(/\s+/).slice(0, 2).join(" "),
    representativeMenu:
      c.representativeMenu ||
      menus
        .slice(0, 3)
        .map((m) => m.name)
        .join(" / "),
    imageUrl: "",
    kakaoPlaceId: p.kakaoPlaceId,
    placeUrl: p.placeUrl,
    operationState: r.sourceOperationStatus === "Y" ? "operating" : "unknown",
    locationVerifiedAt: r.checkedAt.slice(0, 10),
    locationSourceUrls: [p.placeUrl],
  };
  if (menus.length) {
    Object.assign(item, {
      menus,
      menuPriceVerifiedAt: r.checkedAt,
      menuPriceSources: [
        {
          label: "카카오지도 공개 메뉴",
          url: p.placeUrl,
          ...(r.sourceUpdatedAt ? { publishedAt: r.sourceUpdatedAt } : {}),
        },
      ],
    });
  }
  if (item.operationState === "operating")
    Object.assign(item, {
      operationVerifiedAt: r.checkedAt.slice(0, 10),
      operationSourceUrl: p.placeUrl,
    });
  const previousRestaurant = restaurants.get(id);
  restaurants.set(
    id,
    previousRestaurant?.menuPriceVerifiedAt &&
      previousRestaurant.menuPriceVerifiedAt > (item.menuPriceVerifiedAt || "")
      ? { ...item, ...previousRestaurant }
      : { ...previousRestaurant, ...item },
  );
  canonical.set(p.kakaoPlaceId, restaurants.get(id));
  for (const [i, e] of c.evidence.entries())
    sourceLinks.push({
      id: `appearance_${c.id}_${i}`,
      restaurantId: id,
      sourceId: c.topicId,
      label: e.label,
      sourceUrl: e.url,
      note: [e.publishedAt, c.sourceDisclosure].filter(Boolean).join(" · "),
    });
  approved.push({
    candidateId: c.id,
    restaurantId: id,
    topicId: c.topicId,
    newRestaurant: !base.some((b) => b.id === id),
    withPrice: menus.some((m) => m.price),
    menuItems: menus.length,
  });
}
const sources = topics
  .map(([id, name, , type, provider, description]) => ({
    id,
    name,
    type,
    provider,
    description,
    imageUrl: `/source-covers/${id}.svg`,
  }))
  .filter((s) => sourceLinks.some((l) => l.sourceId === s.id));
await write(
  "matpick_all/client/src/data/generated/topic-expansion.generated.json",
  { restaurants: [...restaurants.values()], sources, sourceLinks },
);
await write(
  "matpick_all/client/src/data/generated/expansion-topic-shortcuts.generated.json",
  sources.map((s) => ({
    slug: s.id,
    type: "source",
    value: s.id,
    name: { ko: s.name, en: topics.find((t) => t[0] === s.id)[2] },
    imageUrl: s.imageUrl,
  })),
);
for (const [index, t] of topics.entries()) {
  const colors = [
    "#aa465f",
    "#ab662b",
    "#526d56",
    "#875846",
    "#427c7a",
    "#397394",
    "#7b5778",
    "#5967a0",
    "#6d5e44",
    "#528451",
  ];
  await fs.writeFile(
    path.join(root, `matpick_all/client/public/source-covers/${t[0]}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="48" cy="48" r="46" fill="${colors[index]}"/><circle cx="48" cy="48" r="38" fill="none" stroke="#fff" stroke-opacity=".35"/><text x="48" y="34" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="9" letter-spacing="2">MATPICK</text><text x="48" y="62" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="700" font-size="25">${t[6]}</text></svg>\n`,
  );
}
const report = {
  checkedAt: new Date().toISOString(),
  candidateCount: queue.length,
  uniquePublished: restaurants.size,
  newRestaurants: new Set(
    approved.filter((a) => a.newRestaurant).map((a) => a.restaurantId),
  ).size,
  appearanceCount: sourceLinks.length,
  topics: topics.map(([id, name], i) => ({
    priority: i + 1,
    id,
    name,
    candidates: queue.filter((c) => c.topicId === id).length,
    published: new Set(
      approved.filter((a) => a.topicId === id).map((a) => a.restaurantId),
    ).size,
    withPrice: new Set(
      approved
        .filter((a) => a.topicId === id && a.withPrice)
        .map((a) => a.restaurantId),
    ).size,
  })),
  approved,
  review,
};
await write(`${dir}/report.json`, report);
console.log(
  JSON.stringify(
    { ...report, approved: undefined, review: review.length },
    null,
    2,
  ),
);
