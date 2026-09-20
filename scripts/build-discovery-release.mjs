import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { identityMatch, normalize } from "./menu-research/matching.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = "source-data/discovery-release-2026-09";
const read = async (p) =>
  JSON.parse(await fs.readFile(path.join(root, p), "utf8"));
const write = (p, d) =>
  fs.writeFile(path.join(root, p), JSON.stringify(d, null, 2) + "\n");
const queue = await read(`${dir}/queue.json`),
  results = (await read(`${dir}/results.json`)).restaurants;
// This stable, pre-release snapshot makes duplicate mapping reproducible across rebuilds.
let base;
try {
  base = await read(`${dir}/existing-restaurants.json`);
} catch {
  base = (
    await read("matpick_all/client/src/data/generated/public-dataset.json")
  ).restaurants.map(
    ({ id, name, address, lat, lng, operationState, recommendationHold }) => ({
      id,
      name,
      address,
      lat,
      lng,
      operationState,
      recommendationHold,
    }),
  );
  await write(`${dir}/existing-restaurants.json`, base);
}
const previous = await read(
  "matpick_all/client/src/data/generated/jeonhyunmoo-plan.generated.json",
);
const travel = [],
  restaurants = [],
  sourceLinks = [],
  review = [];
const canonical = new Map();
function existingMatch(c, p) {
  const k = p.kakaoPlaceId;
  if (canonical.has(k)) return canonical.get(k);
  const matches = base
    .filter((r) => {
      const a = normalize(r.name),
        b = normalize(c.name);
      return a.includes(b) || b.includes(a);
    })
    .filter((r) => identityMatch(c, r).accepted);
  if (matches.length > 1) return { ambiguous: true };
  if (matches[0]) canonical.set(k, matches[0]);
  return matches[0];
}
for (const c of queue) {
  const r = results[c.id];
  if (
    !r ||
    ![
      "verified_priced",
      "verified_menu_only",
      "public_menu_unavailable",
    ].includes(r.status) ||
    !r.match?.accepted
  ) {
    review.push({
      id: c.id,
      name: c.name,
      topic: c.releaseTopic,
      reason: r?.status || "not_checked",
    });
    continue;
  }
  const p = r.place;
  if (!(p.lat >= 33 && p.lat <= 39 && p.lng >= 124 && p.lng <= 132)) {
    review.push({ id: c.id, name: c.name, reason: "coordinates_invalid" });
    continue;
  }
  const match = existingMatch(c, p);
  if (
    match?.ambiguous ||
    match?.recommendationHold ||
    ["closed", "moved", "temporarily_closed"].includes(match?.operationState)
  ) {
    review.push({
      id: c.id,
      name: c.name,
      topic: c.releaseTopic,
      reason: "existing_record_requires_review",
    });
    continue;
  }
  const id =
    match?.id ||
    (c.releaseTopic === "jeonhyunmoo-plan"
      ? c.previousId ||
        `jeonhyunmoo-plan_s${c.season}_no${c.restaurantRecordNo}`
      : `travel_${c.releaseTopic}_${c.nativeId.replace(/[^\w-]/g, "_")}`);
  const common = {
    id,
    name: c.name,
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    category: "음식점",
    region: p.address.split(/\s+/).slice(0, 2).join(" "),
    representativeMenu:
      c.representativeMenu ||
      r.menus
        .slice(0, 3)
        .map((m) => m.name)
        .join(" / "),
    menus: r.menus.map((m, i) => ({ ...m, id: `${id}_current_menu_${i + 1}` })),
    imageUrl: "",
    phone: c.phone || "",
    kakaoPlaceId: p.kakaoPlaceId,
    placeUrl: p.placeUrl,
    operationState: r.sourceOperationStatus === "Y" ? "operating" : "unknown",
    locationVerifiedAt: r.checkedAt.slice(0, 10),
    locationSourceUrls: [p.placeUrl],
    menuPriceVerifiedAt: r.checkedAt.slice(0, 10),
    menuPriceSources: r.menus.length
      ? [
          {
            label: "카카오지도 공개 메뉴",
            url: p.placeUrl,
            ...(r.sourceUpdatedAt ? { publishedAt: r.sourceUpdatedAt } : {}),
          },
        ]
      : [],
  };
  if (common.operationState === "operating") {
    common.operationVerifiedAt = r.checkedAt.slice(0, 10);
    common.operationSourceUrl = p.placeUrl;
  }
  if (c.releaseTopic === "jeonhyunmoo-plan") {
    const old = previous.restaurants.find((x) => x.id === c.previousId);
    common.category = old?.category || "음식점";
    if (!common.menus.length) {
      common.menus = c.menus.map((m, i) => ({
        id: `${id}_broadcast_menu_${i + 1}`,
        name: m.name,
      }));
      common.menuPriceVerifiedAt = c.sourceCheckedAt;
      common.menuPriceSources = [
        {
          label: "MBN 방송 소개 메뉴 · 가격 미확인",
          url: c.sourceUrl,
          publishedAt: c.broadcastDate,
        },
      ];
    }
    restaurants.push(common);
    sourceLinks.push({
      id: `jh_official_s${c.season}_no${c.restaurantRecordNo}`,
      sourceId: "jeonhyunmoo-plan",
      restaurantId: id,
      label: `시즌 ${c.season} EP.${c.episode}`,
      sourceUrl: c.sourceUrl,
      note: `MBN 맛집기록 No.${c.restaurantRecordNo} · ${c.broadcastDate}`,
      broadcastDate: c.broadcastDate,
    });
  } else {
    travel.push({
      ...c,
      existingRestaurantId: match?.id,
      name: common.name,
      address: common.address,
      lat: common.lat,
      lng: common.lng,
      menus: common.menus,
      kakaoPlaceId: p.kakaoPlaceId,
      menuPriceVerifiedAt: common.menuPriceVerifiedAt,
      menuPriceSources: common.menuPriceSources,
      reviewStatus: "approved",
      operationState: common.operationState,
      verification: {
        checkedAt: r.checkedAt.slice(0, 10),
        sourceUrl: p.placeUrl,
        basis: "map_listing",
      },
      issues: [],
    });
  }
  canonical.set(p.kakaoPlaceId, common);
}
await write("source-data/travel-discovery/approved.json", travel);
await write(
  "matpick_all/client/src/data/generated/jeonhyunmoo-plan-public.generated.json",
  {
    restaurants,
    sources: [
      {
        id: "jeonhyunmoo-plan",
        name: "전현무계획",
        type: "tv_show",
        provider: "MBN",
        imageUrl: "/source-covers/jeonhyunmoo-plan.svg",
        description:
          "전현무와 곽튜브가 지역 식당을 찾아가는 음식 여행 프로그램입니다. 공식 맛집기록과 현재 지점을 대조한 식당을 수록합니다.",
      },
    ],
    sourceLinks,
  },
);
const topics = ["busan-bite", "jeju-bite", "jeonhyunmoo-plan"].map((topic) => {
  const q = queue.filter((c) => c.releaseTopic === topic),
    published =
      topic === "jeonhyunmoo-plan"
        ? restaurants
        : travel.filter((c) => c.releaseTopic === topic);
  return {
    topic,
    target: q.length,
    published: published.length,
    withPrice: published.filter((c) => c.menus.some((m) => m.price)).length,
    menuItems: published.reduce((n, c) => n + c.menus.length, 0),
  };
});
await write(`${dir}/report.json`, {
  topics,
  review,
  secondaryBroadcastPending: previous.restaurants
    .filter(
      (r) =>
        !r.evidence.some((e) =>
          e.sourceUrl?.includes("mbn.co.kr/totalCastView/"),
        ),
    )
    .map((r) => ({
      id: r.id,
      name: r.name,
      reason: "official_broadcast_evidence_pending",
    })),
});
await write(
  "matpick_all/client/src/data/generated/discovery-highlights.generated.json",
  topics
    .filter((t) => t.published)
    .map((t) => ({
      slug: t.topic,
      count: new Set(
        t.topic === "jeonhyunmoo-plan"
          ? restaurants.map((r) => r.id)
          : travel
              .filter((c) => c.releaseTopic === t.topic)
              .map((c) => c.existingRestaurantId || c.candidateId),
      ).size,
    })),
);
const md = [
  "# 부산·제주·전현무계획 공개 검수 결과",
  "",
  ...topics.map(
    (t) =>
      `- ${t.topic}: ${t.target}곳 대조, ${t.published}건 공개, 가격 확보 ${t.withPrice}건, 메뉴 ${t.menuItems}개`,
  ),
  "",
  "지도 공개 메뉴의 조회값이며 현장 가격을 보장하지 않습니다. 사진은 공개 조건이 아닙니다. MBN 소개 문장·사진은 복제하지 않고 상호·주소·회차·메뉴명과 출처 링크만 기록합니다.",
  "",
  "## 보류 항목",
  "",
  ...review.map((r) => `- ${r.name}: ${r.reason}`),
  "",
  "## 전현무계획 메뉴·가격 목록",
  "",
  ...restaurants.flatMap((r) => [
    `### ${r.name}`,
    r.address,
    `[메뉴 출처](${r.placeUrl})`,
    ...r.menus.map((m) => `- ${m.name}: ${m.price || "가격 미확인"}`),
    "",
  ]),
].join("\n");
await fs.writeFile(path.join(root, dir, "report.md"), md.trimEnd() + "\n");
console.log(topics);
