import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, "source-data/topic-expansion-2026-09-21");
const read = (file) =>
  fs.readFile(path.join(directory, file), "utf8").then(JSON.parse);
const records = await read("research.json");
const baseline = await read("baseline.json");
const excluded = JSON.parse(
  await fs.readFile(
    path.join(root, "matpick_all/client/src/data/restaurant-exclusions.json"),
    "utf8",
  ),
);
const hash = (value) =>
  createHash("sha256").update(value).digest("hex").slice(0, 12);
const validUrl = (value) => {
  const u = new URL(value);
  assert.equal(u.protocol, "https:");
  return value;
};
const approved = records.filter((r) => r.status === "verified");
const restaurants = [],
  sourceLinks = [],
  patches = {};
const report = {
  checkedAt: "2026-09-21",
  baselineCommit: baseline.commit,
  newRestaurants: 0,
  refreshedRestaurants: 0,
  menuItems: 0,
  numericPrices: 0,
  topics: [],
  approved: [],
  held: records
    .filter((r) => r.status !== "verified")
    .map((r) => ({
      name: r.name,
      topicId: r.topicId,
      status: r.status,
      reason: r.note || "지점·메뉴 추가 확인 필요",
    })),
};

for (const r of approved) {
  assert.ok(r.name && r.address && r.category, `Missing identity: ${r.name}`);
  assert.ok(
    r.lat > 33 && r.lat < 39 && r.lng > 124 && r.lng < 132,
    `Missing coordinates: ${r.name}`,
  );
  assert.ok(
    r.coordinateSourceUrl || r.existingRestaurantId,
    `Missing coordinate evidence: ${r.name}`,
  );
  assert.ok(
    r.evidence?.length && r.evidence.every((e) => validUrl(e.url)),
    `Missing topic evidence: ${r.name}`,
  );
  assert.equal(r.checkedAt, report.checkedAt);
  assert.ok(
    r.menus?.length &&
      r.menus.every(
        (m) => m.name && /(?:[\d,]+원|가격 변동|변동)/.test(m.price),
      ),
    `Invalid menu: ${r.name}`,
  );
  assert.equal(
    new Set(r.menus.map((m) => m.name)).size,
    r.menus.length,
    `Duplicate menu: ${r.name}`,
  );
  const id = r.existingRestaurantId || `topic_search_${hash(r.naverUrl)}`;
  assert.ok(
    !excluded.restaurantIds.includes(id),
    `Excluded record resurfaced: ${r.name}`,
  );
  if (r.existingRestaurantId)
    assert.ok(
      baseline.existingRestaurants.some((v) => v.id === id),
      `Unreviewed merge: ${id}`,
    );
  const date = r.updated?.match(/(\d{2})\.(\d{2})\.(\d{2})/);
  const publishedAt = date ? `20${date[1]}-${date[2]}-${date[3]}` : undefined;
  const stale =
    publishedAt &&
    new Date(r.checkedAt) - new Date(publishedAt) > 365 * 86400000;
  const menus = r.menus.map((m, i) => ({
    id: `m${i.toString(36)}`,
    name: m.name,
    price: m.price,
  }));
  const patch = {
    name: r.name,
    address: r.address,
    region: r.address.split(" ").slice(0, 2).join(" "),
    category: r.category,
    representativeMenu: menus
      .slice(0, 3)
      .map((m) => m.name)
      .join(", "),
    lat: r.lat,
    lng: r.lng,
    phone: r.phone,
    placeUrl: validUrl(r.naverUrl),
    menus,
    locationVerifiedAt: r.checkedAt,
    locationSourceUrls: [
      ...new Set([
        r.naverUrl,
        ...(r.coordinateSourceUrl ? [validUrl(r.coordinateSourceUrl)] : []),
      ]),
    ],
    menuPriceVerifiedAt: r.checkedAt,
    menuPriceStatus: "verified_priced",
    menuPriceSources: [
      {
        url: r.naverUrl,
        label: r.priceNote?.includes("포장")
          ? "네이버 포장 주문 메뉴"
          : "네이버 메뉴",
        ...(publishedAt ? { publishedAt } : {}),
      },
    ],
    ...(r.priceNote || stale
      ? {
          menuPriceNote: [
            r.priceNote,
            stale
              ? `네이버 메뉴 갱신일은 ${publishedAt}입니다. 방문 전 가격을 확인해 주세요.`
              : "",
          ]
            .filter(Boolean)
            .join(" "),
        }
      : {
          menuPriceNote:
            "네이버 등록 메뉴를 확인한 날짜이며 현장 가격은 다를 수 있습니다.",
        }),
  };
  patches[id] = patch;
  restaurants.push({ id, ...patch, imageUrl: "" });
  const topics = [
    { topicId: r.topicId, evidence: r.evidence },
    ...(r.additionalTopics || []),
  ];
  for (const topic of topics) {
    const old = baseline.topics.find((t) => t.id === topic.topicId);
    assert.ok(old, `Unknown topic ${topic.topicId}`);
    assert.ok(
      topic.evidence?.length && topic.evidence.every((e) => validUrl(e.url)),
    );
    if (!old.restaurantIds.includes(id))
      sourceLinks.push({
        id: `search_20260921_${hash(`${id}:${topic.topicId}`)}`,
        restaurantId: id,
        sourceId: topic.topicId,
        label: topic.evidence[0].label,
        sourceUrl: topic.evidence[0].url,
      });
  }
  report[r.existingRestaurantId ? "refreshedRestaurants" : "newRestaurants"]++;
  report.menuItems += menus.length;
  report.numericPrices += menus.filter((m) => /\d/.test(m.price)).length;
  report.approved.push({
    restaurantId: id,
    name: r.name,
    existing: Boolean(r.existingRestaurantId),
    topics: topics.map((t) => t.topicId),
    menuItems: menus.length,
    source: r.naverUrl,
    publishedAt,
  });
}
assert.equal(new Set(restaurants.map((r) => r.id)).size, restaurants.length);
report.topics = baseline.topics.map((t) => ({
  id: t.id,
  name: t.name,
  before: t.restaurantIds.length,
  added: sourceLinks.filter((l) => l.sourceId === t.id).length,
  after:
    t.restaurantIds.length +
    sourceLinks.filter((l) => l.sourceId === t.id).length,
  refreshed: report.approved.filter((a) => a.topics.includes(t.id)).length,
}));
const output = { restaurants, sourceLinks, patches };
await fs.writeFile(
  path.join(
    root,
    "matpick_all/client/src/data/generated/search-topic-expansion.generated.json",
  ),
  JSON.stringify(output, null, 2) + "\n",
);
await fs.writeFile(
  path.join(directory, "report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
const md = [
  "# 맛픽 기존 주제 추가 조사 · 2026-09-21",
  "",
  `신규 식당 **${report.newRestaurants}곳**, 기존 식당 **${report.refreshedRestaurants}곳** 갱신, 새 주제 연결 **${sourceLinks.length}건**. 메뉴 ${report.menuItems}개 중 숫자 가격 ${report.numericPrices}개, 변동 가격 ${report.menuItems - report.numericPrices}개를 확인했다.`,
  "",
  "네이버·다음·구글 검색으로 후보를 찾고 방송사·공식 채널·기관의 소개 근거를 확인했다. 메뉴와 도로명 주소는 네이버 플레이스/주문 메뉴를 직접 열어 확인했다. 지도 좌표는 동일 식당 또는 해당 도로명 건물의 Google 지도 좌표와 검증된 기존 좌표를 사용했다. 별도의 경로 API 호출은 사용하지 않았다.",
  "",
  "공개 화면에 보이는 가격의 확인일은 현재 판매가 보증일과 다르다. 네이버가 표시한 메뉴 갱신일은 별도 보존했다. 금능샌드는 포장 가격임을 표시했고, 정통관은 배달 가격만 확인되어 공개 대상에서 보류했다. 이전 조사에서 제외한 119곳의 노출 제한은 유지한다.",
  "",
  "| 주제 | 기존 연결 식당 | 새 연결 | 반영 후 | 메뉴 확인 식당 |",
  "|---|---:|---:|---:|---:|",
  ...report.topics.map(
    (t) =>
      `| ${t.name} | ${t.before} | ${t.added} | ${t.after} | ${t.refreshed} |`,
  ),
  "",
  "위 집계는 중복 없는 주제 연결 수다. 영업·자료 검토로 공개 추천에서 제외된 기존 식당을 포함하므로 실제 화면 노출 수와 다를 수 있다. 3대천왕의 범일빈대떡은 기존 식당이어서 새 식당으로 세지 않고 가격을 갱신했다.",
  "",
  "| 식당 | 처리 | 네이버 확인 주소 | 메뉴 | 소개 근거 / 가격 원문 |",
  "|---|---|---|---:|---|",
  ...approved.map(
    (r) =>
      `| ${r.name} | ${r.existingRestaurantId ? "기존 갱신" : "신규"} | ${r.address} | ${r.menus.length} | [소개](${r.evidence[0].url}) · [메뉴](${r.naverUrl}) |`,
  ),
  "",
  "## 주소 및 가격 주의 사항",
  "",
  "- 로코스비비큐 경리단길본점: 기존 회나무로 83을 현재 네이버의 회나무로 26 2층으로 갱신하고 좌표도 변경했다. 기존 식당 ID와 맛있는 녀석들 연결은 유지했다.",
  "- 밀로프: 기존 수집 후보의 동천로 5를 현재 네이버의 동천로 58로 정정했다.",
  "- 두부자통닭 암사점·곰보식당: 네이버 메뉴 갱신일이 각각 2024-03-07·2024-05-23으로 오래되어 상세 화면 출처 영역에 표시했다.",
  "- 금능샌드: 수집한 8개 항목은 네이버 포장 주문 가격이며 매장 식사 가격과 다를 수 있다.",
  "",
  "## 보류 후보",
  "",
  ...report.held.map(
    (r) =>
      `- ${r.name}: ${r.status === "delivery_menu_only" ? "배달 가격만 확인. 매장 메뉴 확인 후 추가." : "소개 근거는 확보했으나 지점·메뉴 검증 대기."}`,
  ),
  "",
  "재생성: 저장소 루트에서 `node scripts/build-search-topic-expansion.mjs`, 이어 `matpick_all`에서 `node scripts/generate-public-data.mjs` 실행. `research.json`은 확인 근거 원본, `baseline.json`은 bd720bc 시점 비교 자료다.",
  "",
].join("\n");
await fs.writeFile(path.join(directory, "REPORT.md"), md);
console.log(
  JSON.stringify({
    new: report.newRestaurants,
    refreshed: report.refreshedRestaurants,
    links: sourceLinks.length,
    menus: report.menuItems,
    priced: report.numericPrices,
    held: report.held.length,
  }),
);
