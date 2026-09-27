import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportDirectory = path.resolve(root, "../outputs/guided-naver-menu");
const summaryPath = path.join(reportDirectory, "summary.json");
const relocationPath = path.join(
  reportDirectory,
  "yukjeon-relocation-2026-09-28.json",
);
const publicDataPath = path.join(
  root,
  "matpick_all/client/src/data/generated/public-dataset.json",
);
const overridesPath = path.join(
  root,
  "matpick_all/client/src/data/restaurant-overrides.json",
);
const deletionsPath = path.join(
  root,
  "matpick_all/client/src/data/restaurant-permanent-deletions.json",
);
const evidenceDirectory = path.join(
  root,
  "source-data/naver-menu-live-2026-09-27",
);
const evidencePath = path.join(evidenceDirectory, "verified-menu-overrides.json");
const checkedAt = "2026-09-27";
const userIdentityConfirmationAt = "2026-09-28";

const identityReviewDecisions = new Map([
  [
    "topic_enrichment_baekjong-wok_28f264d7f33b",
    {
      disposition: "apply-current-name-and-menu",
      currentName: "지산골온천보리밥",
      note: "온천할머니집과 현재 상호 지산골온천보리밥은 같은 식당으로 사용자 확인.",
    },
  ],
  [
    "sikgaek-baekban-trip_restaurant_218",
    {
      disposition: "apply-current-name-and-menu",
      currentName: "조샌집",
      note: "기존 조센집 표기와 현재 상호 조샌집은 같은 식당으로 사용자 확인.",
    },
  ],
  [
    "sikgaek-baekban-trip_restaurant_593",
    {
      disposition: "apply-current-name-and-menu",
      currentName: "김인복의광평 강남직영점",
      note: "한우다이닝 울릉이 김인복의광평 강남직영점으로 상호를 바꾼 같은 식당으로 사용자 확인.",
    },
  ],
  [
    "sikgaek-baekban-trip_restaurant_655",
    {
      disposition: "apply-current-name-and-menu",
      currentName: "마장동 할머니 갈비탕",
      note: "기존 일반명 갈비탕집과 현재 상호 마장동 할머니 갈비탕은 같은 식당으로 사용자 확인.",
    },
  ],
  [
    "wednesday-gourmet_restaurant_128",
    {
      disposition: "apply-current-name-and-menu",
      currentName: "대정칼국수",
      note: "대정소바와 현재 상호 대정칼국수는 같은 식당으로 사용자 확인.",
    },
  ],
  [
    "wednesday-gourmet_restaurant_466",
    {
      disposition: "permanently-delete",
      currentBusinessName: "진서칼국수만두",
      reason: "owner_confirmed_closed_business_changed_removal",
      note: "어바웃진스는 폐업했고 같은 주소의 현재 메뉴는 다른 업소 진서칼국수만두의 것으로 사용자 확인. 기존 식당을 영구 삭제하며 현재 업소의 메뉴를 전용하지 않음.",
    },
  ],
  [
    "wednesday-gourmet_restaurant_502",
    {
      disposition: "apply-relocation-evidence",
      currentName: "육전식당 신설동본점",
      note: "기존 방송 식당이 천호대로 33으로 이전한 현재 육전식당 신설동본점으로 사용자 확인. 별도 이전 근거의 메뉴만 적용하고 육전제면소 메뉴는 사용하지 않음.",
    },
  ],
  [
    "topic_enrichment_delicious-guys_e9deefd0dd9f",
    {
      disposition: "permanently-delete",
      currentBusinessName: "황금목장 염소요리전문점",
      reason: "owner_confirmed_closed_removal",
      note: "나귀당귀는 폐업한 것으로 사용자 확인. 기존 식당을 영구 삭제하며 현재 업소의 메뉴를 전용하지 않음.",
    },
  ],
]);

const readJson = async (filename) =>
  JSON.parse(await readFile(filename, "utf8"));
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const compactText = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
const placeIdentity = (sourceUrl) => {
  const url = new URL(sourceUrl);
  const placeId = url.pathname.match(/\/restaurant\/(\d+)/)?.[1];
  const orderBusinessId = url.pathname.match(/\/order\/bizes\/(\d+)/)?.[1];
  return placeId
    ? `naver-place:${placeId}`
    : orderBusinessId
      ? `naver-order:${orderBusinessId}`
      : sourceUrl;
};

function sourceMenuId(restaurantId, menu, index) {
  const digest = createHash("sha256")
    .update(`${restaurantId}\u0000${menu.name}\u0000${menu.price}\u0000${index}`)
    .digest("hex")
    .slice(0, 16);
  return `naver_20260927_${digest}`;
}

function appendUnique(parts) {
  return [...new Set(parts.map(compactText).filter(Boolean))].join(" · ");
}

function numericMenuDescription(menu) {
  const conditions = (menu.quantityOrConditions ?? []).filter(
    (condition) =>
      !compactText(menu.name).includes(compactText(condition)) &&
      !compactText(menu.description).includes(compactText(condition)),
  );
  return appendUnique([
    menu.description,
    conditions.length ? `수량·구성 조건: ${conditions.join(", ")}` : "",
  ]);
}

const daehanConditions = new Map([
  [
    "활어회 추천메뉴2인",
    "구성: 활어회, 쓰끼다시, 만세튀김, 물회, 매운탕, 라면사리 또는 칼국수사리. 매운탕은 요청 시 제공. 활어회는 계절에 따라 변경될 수 있음.",
  ],
  [
    "몽땅조개구이스페셜2인(포장불가)",
    "포장불가. 구성: 조개구이, 전복, 만세튀김, 떡볶이, 오징어, 후식 칼국수.",
  ],
  [
    "게국지세트3인",
    "구성: 게국지, 간장게장 1마리, 양념게장. 공기밥 포함.",
  ],
  [
    "주말제철세트메뉴2인",
    "구성: 방어 또는 광어, 만세튀김, 물회, 매운탕, 라면사리 또는 칼국수사리. 매운탕은 요청 시 제공. 활어회는 계절에 따라 변경될 수 있음.",
  ],
  [
    "회+대하구이 세트2인(포장불가)",
    "포장불가. 구성: 활어회, 냉동 대하구이, 쓰끼다시, 매운탕. 산대하 변경 20,000원 추가. 매운탕을 게국지로 변경 시 20,000원 추가.",
  ],
  [
    "조개+대하구이세트2인(포장불가)",
    "포장불가. 구성: 조개구이, 냉동 대하구이, 만세튀김, 회덮밥 1개.",
  ],
  [
    "대한 스페셜 세트2인(포장불가)",
    "포장불가. 구성: 활어회, 냉동 대하구이, 쓰끼다시, 조개구이 또는 조개찜, 매운탕.",
  ],
  [
    "모듬튀김",
    "구성: 베이비꽃게, 꽃게튀김, 고구마튀김, 새우튀김, 오징어튀김.",
  ],
]);

function orderMenuDescription(record, menu) {
  if (record.restaurantId === "topic_enrichment_delicious-guys_a9894aaf4dda") {
    const description = daehanConditions.get(menu.name);
    assert.ok(description, `Missing reviewed order condition: ${menu.name}`);
    return description;
  }
  // The other captured descriptions are promotional copy. Keep only a real order condition.
  if (menu.name === "오늘의 수프") return "메뉴는 매일 변경됨.";
  return "";
}

function resolveRestaurantId(record, publicRestaurants) {
  if (record.restaurantId) return { id: record.restaurantId, resolvedBy: "report" };
  const exact = publicRestaurants.filter(
    (restaurant) =>
      compactText(restaurant.name) === compactText(record.name) &&
      compactText(restaurant.address) === compactText(record.address),
  );
  assert.equal(
    exact.length,
    1,
    `Expected one exact catalog identity for ${record.name}; found ${exact.length}`,
  );
  return { id: exact[0].id, resolvedBy: "exact-name-address" };
}

function buildSourceRecord(record, publicRestaurants, identityDecision = null) {
  const { id, resolvedBy } = resolveRestaurantId(record, publicRestaurants);
  let sourceMenus;
  let menuGroup;
  if (
    record.classification === "numeric_menu_acquired" ||
    identityDecision?.disposition === "apply-current-name-and-menu"
  ) {
    menuGroup = "numeric-current-menu";
    sourceMenus = record.menus.map((menu) => {
      const excludedPendingReview =
        record.restaurantId === "wednesday-gourmet_restaurant_123" &&
        menu.name === "하바그린티빙수";
      return {
        ...menu,
        ...(excludedPendingReview
          ? { productionDisposition: "excluded-pending-review" }
          : {}),
        ...(numericMenuDescription(menu)
          ? {
              productionDescription: numericMenuDescription(menu),
            }
          : {}),
      };
    });
  } else if (record.classification === "variable_price_only") {
    menuGroup = "variable-price-menu";
    sourceMenus = record.pendingMenus.map((menu) => ({
      ...menu,
      price: "가격 변동",
      variablePrice: true,
      productionDescription: "고정 금액 미표시. 주문 전 가격 확인 필요.",
    }));
  } else if (record.classification === "order_menu_pending") {
    menuGroup = "normalized-order-menu";
    sourceMenus = record.structuredOrderMenus.map((menu) => ({
      ...menu,
      productionDescription: orderMenuDescription(record, menu),
    }));
  } else {
    throw new Error(`Unsupported classification: ${record.classification}`);
  }
  return {
    restaurantId: id,
    reportRestaurantId: record.restaurantId,
    identityResolution: resolvedBy,
    name: identityDecision?.currentName ?? record.name,
    ...(identityDecision
      ? {
          historicalName: record.name,
          identityReviewClassification: record.classification,
          userIdentityConfirmationAt,
          identityReviewNote: identityDecision.note,
        }
      : {}),
    address: record.address,
    classification: record.classification,
    menuGroup,
    checkedAt,
    sourceUrl: record.sourceUrl,
    sourceIdentity: placeIdentity(record.sourceUrl),
    coverageSource: record.coverageSource,
    evidenceFile: record.evidenceFile,
    reviewNote: record.reviewNote,
    itemReviewNotes: record.itemReviewNotes ?? [],
    ...(record.orderContext ? { orderContext: record.orderContext } : {}),
    menus: sourceMenus,
  };
}

function buildAdminRecord(adminRecord, publicRestaurants) {
  assert.equal(adminRecord.saved, true);
  assert.equal(adminRecord.recheckedAt, checkedAt);
  assert.ok(
    publicRestaurants.some((restaurant) => restaurant.id === adminRecord.restaurantId),
    `Missing admin-saved catalog identity: ${adminRecord.restaurantId}`,
  );
  return {
    restaurantId: adminRecord.restaurantId,
    reportRestaurantId: adminRecord.restaurantId,
    identityResolution: "admin-saved-existing-id",
    name: adminRecord.name,
    address: publicRestaurants.find(
      (restaurant) => restaurant.id === adminRecord.restaurantId,
    ).address,
    classification: "admin_saved_numeric_menu",
    menuGroup: "admin-saved-current-menu",
    checkedAt,
    sourceUrl: adminRecord.sourceUrl,
    sourceIdentity: placeIdentity(adminRecord.sourceUrl),
    coverageSource: "admin-recheck",
    evidenceFile: "ultra-gwisan-2026-09-27.json",
    reviewNote: adminRecord.note,
    itemReviewNotes: [],
    menus: adminRecord.menus,
  };
}

function buildRelocationRecord(relocation, publicRestaurants) {
  const catalog = publicRestaurants.find(
    (restaurant) => restaurant.id === relocation.restaurantId,
  );
  assert.ok(catalog, `Missing relocation catalog identity: ${relocation.restaurantId}`);
  assert.equal(relocation.checkedAt, userIdentityConfirmationAt);
  assert.equal(relocation.userConfirmedRelocationAt, userIdentityConfirmationAt);
  assert.equal(relocation.menus.length, 16);
  return {
    restaurantId: relocation.restaurantId,
    reportRestaurantId: relocation.restaurantId,
    identityResolution: "user-confirmed-relocation-existing-id",
    name: relocation.name,
    historicalName: relocation.previousName,
    address: relocation.address,
    classification: "user_confirmed_relocation_current_menu",
    identityReviewClassification: "menu_evidence_identity_review",
    menuGroup: "numeric-current-menu",
    checkedAt: relocation.checkedAt,
    sourceUrl: relocation.sourceUrl,
    sourceIdentity: placeIdentity(relocation.sourceUrl),
    coverageSource: "browser-relocation-followup",
    evidenceFile: path.basename(relocationPath),
    reviewNote: relocation.note,
    identityReviewNote: identityReviewDecisions.get(relocation.restaurantId).note,
    userIdentityConfirmationAt,
    itemReviewNotes: [],
    productionPatch: {
      name: relocation.name,
      address: relocation.address,
      region: "서울 동대문구",
      lat: relocation.geocode.candidate.lat,
      lng: relocation.geocode.candidate.lng,
      phone: relocation.phone,
      locationVerifiedAt: relocation.checkedAt,
      locationSourceUrls: [relocation.homeSourceUrl, relocation.geocode.lookup.url],
      operationState: "operating",
      operationVerifiedAt: relocation.checkedAt,
      operationSourceUrl: relocation.homeSourceUrl,
      recommendationHold: undefined,
      dataReviewNote: `${relocation.checkedAt} 사용자 이전 확인: ${identityReviewDecisions.get(relocation.restaurantId).note}`,
    },
    menus: relocation.menus,
  };
}

function menuPatch(sourceRecord) {
  const menus = sourceRecord.menus
    .filter((menu) => menu.productionDisposition !== "excluded-pending-review")
    .map((menu, index) => ({
    id: sourceMenuId(sourceRecord.restaurantId, menu, index),
    name: compactText(menu.name),
    price: compactText(menu.price),
    ...(compactText(menu.productionDescription)
      ? { description: compactText(menu.productionDescription) }
      : {}),
    }));
  const commonSnapshotNote =
    `${sourceRecord.checkedAt} 공개 화면의 가격·수량·구성 조건 스냅샷이며 방문 또는 주문 전 재확인이 필요합니다.`;
  let menuPriceStatus = `naver-current-menu-${sourceRecord.checkedAt}`;
  let sourceLabel = "네이버 플레이스 현재 메뉴";
  let menuPriceNote = commonSnapshotNote;
  if (sourceRecord.menuGroup === "admin-saved-current-menu") {
    menuPriceStatus = `admin-verified-naver-menu-${sourceRecord.checkedAt}`;
    sourceLabel = "네이버 플레이스 메뉴 관리자 재조회";
    menuPriceNote = appendUnique([sourceRecord.reviewNote, commonSnapshotNote]);
  } else if (sourceRecord.menuGroup === "variable-price-menu") {
    menuPriceStatus = `naver-current-variable-price-menu-${sourceRecord.checkedAt}`;
    sourceLabel = "네이버 플레이스 변동 가격 메뉴";
    menuPriceNote =
      "2026-09-27 공개 메뉴판에 고정 금액 없이 가격 변동으로 표시된 메뉴입니다. 0원이 아니며 주문 전 현재 가격 확인이 필요합니다.";
  } else if (sourceRecord.menuGroup === "normalized-order-menu") {
    menuPriceStatus = `naver-order-partial-takeout-selected-${sourceRecord.checkedAt}`;
    sourceLabel = "네이버 주문 화면 표시 가격 (포장 선택·매장 가격 미확인)";
    menuPriceNote = appendUnique([
      "네이버 주문 화면에서 포장 탭을 선택한 상태의 표시 가격이며 매장 가격과 동일한지 확인되지 않았습니다.",
      "주문 화면에서 확인된 일부 메뉴이며 품절 메뉴는 포함하지 않았습니다.",
      sourceRecord.orderContext?.additionalFee === "Takeout packaging fee 50 KRW"
        ? "포장비 50원 별도입니다."
        : "",
      sourceRecord.menus.some((menu) => menu.name.includes("포장불가"))
        ? "상품명에 포장불가가 명시된 항목은 해당 조건을 그대로 유지했습니다."
        : "",
    ]);
  }
  return {
    ...(sourceRecord.userIdentityConfirmationAt
      ? {
          name: sourceRecord.name,
          dataReviewNote: `${sourceRecord.userIdentityConfirmationAt} 사용자 동일성 확인: ${sourceRecord.identityReviewNote}`,
          recommendationHold: undefined,
        }
      : {}),
    ...(sourceRecord.productionPatch ?? {}),
    menus,
    representativeMenu: menus
      .slice(0, 3)
      .map((menu) => menu.name)
      .join(" / "),
    menuPriceStatus,
    menuPriceVerifiedAt: sourceRecord.checkedAt,
    menuPriceSources: [{ label: sourceLabel, url: sourceRecord.sourceUrl }],
    menuPriceNote,
  };
}

const summary = await readJson(summaryPath);
const relocation = await readJson(relocationPath);
const publicData = await readJson(publicDataPath);
const overrides = await readJson(overridesPath);
const deletions = await readJson(deletionsPath);
assert.equal(summary.generatedAt, "2026-09-27T21:34:39+09:00");
assert.equal(summary.classificationCounts.numeric_menu_acquired, 68);
assert.equal(summary.classificationCounts.variable_price_only, 4);
assert.equal(summary.classificationCounts.order_menu_pending, 2);
assert.equal(summary.classificationCounts.menu_evidence_identity_review, 8);
assert.equal(summary.collection.identityVerifiedNumericMenuItems, 719);
assert.equal(summary.collection.identityVerifiedNumericItemsIncludingAdminSavedUltra, 727);
assert.equal(summary.collection.orderStructuredMenuItemsPendingUse, 34);

const identityReviewRecords = summary.restaurants.filter(
  (record) => record.classification === "menu_evidence_identity_review",
);
assert.equal(identityReviewRecords.length, 8);
assert.deepEqual(
  new Set(identityReviewRecords.map((record) => record.restaurantId)),
  new Set(identityReviewDecisions.keys()),
);
const confirmedIdentityRecords = identityReviewRecords.filter(
  (record) =>
    identityReviewDecisions.get(record.restaurantId)?.disposition ===
    "apply-current-name-and-menu",
);
assert.equal(confirmedIdentityRecords.length, 5);
assert.equal(
  confirmedIdentityRecords.reduce(
    (total, record) => total + record.menus.length,
    0,
  ),
  36,
);

const selectedLiveRecords = summary.restaurants.filter((record) =>
  [
    "numeric_menu_acquired",
    "variable_price_only",
    "order_menu_pending",
  ].includes(record.classification),
);
const sourceRecords = [
  ...selectedLiveRecords.map((record) =>
    buildSourceRecord(record, publicData.restaurants),
  ),
  ...confirmedIdentityRecords.map((record) =>
    buildSourceRecord(
      record,
      publicData.restaurants,
      identityReviewDecisions.get(record.restaurantId),
    ),
  ),
  buildRelocationRecord(relocation, publicData.restaurants),
  buildAdminRecord(summary.adminSavedOutsideLiveTargets, publicData.restaurants),
];
const targetIds = sourceRecords.map((record) => record.restaurantId);
assert.equal(sourceRecords.length, 81);
assert.equal(new Set(targetIds).size, 81);
assert.ok(
  sourceRecords.every((record) =>
    publicData.restaurants.some(
      (restaurant) => restaurant.id === record.restaurantId,
    ),
  ),
);

const numericRecords = sourceRecords.filter((record) =>
  ["numeric-current-menu", "admin-saved-current-menu"].includes(
    record.menuGroup,
  ),
);
const variableRecords = sourceRecords.filter(
  (record) => record.menuGroup === "variable-price-menu",
);
const orderRecords = sourceRecords.filter(
  (record) => record.menuGroup === "normalized-order-menu",
);
assert.equal(numericRecords.length, 75);
assert.equal(
  numericRecords.reduce((total, record) => total + record.menus.length, 0),
  779,
);
assert.equal(variableRecords.length, 4);
assert.equal(
  variableRecords.reduce((total, record) => total + record.menus.length, 0),
  4,
);
assert.equal(orderRecords.length, 2);
assert.equal(
  orderRecords.reduce((total, record) => total + record.menus.length, 0),
  34,
);
assert.equal(
  sourceRecords.reduce((total, record) => total + record.menus.length, 0),
  817,
);
const productionMenuCount = sourceRecords.reduce(
  (total, record) =>
    total +
    record.menus.filter(
      (menu) => menu.productionDisposition !== "excluded-pending-review",
    ).length,
  0,
);
assert.equal(productionMenuCount, 816);

const duplicatePhysicalSources = [...Map.groupBy(sourceRecords, (record) => record.sourceIdentity)]
  .filter(([, records]) => records.length > 1)
  .map(([sourceIdentity, records]) => ({
    sourceIdentity,
    restaurantIds: records.map((record) => record.restaurantId),
    names: records.map((record) => record.name),
    addresses: [...new Set(records.map((record) => record.address))],
    disposition: "기존 식당 ID를 모두 유지하고 동일 메뉴 스냅샷을 각각 적용",
  }));
assert.equal(duplicatePhysicalSources.length, 1);
assert.equal(duplicatePhysicalSources[0].sourceIdentity, "naver-place:11706951");
assert.equal(new Set(sourceRecords.map((record) => record.sourceIdentity)).size, 80);

const excluded = Object.fromEntries(
  Object.entries(Map.groupBy(summary.restaurants, (record) => record.classification))
    .filter(
      ([classification]) =>
        ![
          "numeric_menu_acquired",
          "variable_price_only",
          "order_menu_pending",
        ].includes(classification),
    )
    .map(([classification, records]) => [
      classification,
      {
        restaurantCount: records.length,
        numericMenuEvidenceCount: records.reduce(
          (total, record) => total + (record.menus?.length ?? 0),
          0,
        ),
        restaurantIds: records.map((record) => record.restaurantId),
      },
    ]),
);
excluded.menu_evidence_identity_review = {
  restaurantCount: 2,
  numericMenuEvidenceCount: 11,
  restaurantIds: identityReviewRecords
    .filter(
      (record) =>
        identityReviewDecisions.get(record.restaurantId)?.disposition ===
        "permanently-delete",
    )
    .map((record) => record.restaurantId),
  wrongBusinessMenuEvidenceRejected: {
    restaurantId: relocation.restaurantId,
    numericMenuEvidenceCount: 15,
    sourceUrl: identityReviewRecords.find(
      (record) => record.restaurantId === relocation.restaurantId,
    ).sourceUrl,
  },
};

const evidence = {
  schemaVersion: 1,
  checkedAt,
  generatedFrom: "../outputs/guided-naver-menu/summary.json",
  sourceSummaryGeneratedAt: summary.generatedAt,
  policy: {
    selectedClassifications: [
      "numeric_menu_acquired",
      "variable_price_only",
      "order_menu_pending",
      "admin_saved_numeric_menu",
    ],
    identityReviewApplied: true,
    identityReviewBasis:
      "2026-09-28 사용자 확인으로 5개 동일 식당의 현재 상호와 메뉴를 반영하고, 육전식당 이전 근거를 별도 반영하며, 폐업 2개는 영구 삭제",
    variablePriceRepresentation:
      "가격 변동 문자열로 저장하며 0원으로 변환하지 않음",
    orderPriceContext:
      "네이버 주문 화면에서 포장 선택 상태의 표시 가격. 매장 가격 동일 여부 미확인. 포장불가 상품 조건 유지.",
    ambiguousItemHandling:
      "여수 자연횟집 하바그린티빙수 9,000원은 원문 증거와 검토 메모를 보존하되 검증 전 productionDisposition=excluded-pending-review로 공개 메뉴에서 제외",
  },
  counts: {
    targetRestaurantIds: 81,
    physicalSourceIdentities: 80,
    duplicatePhysicalSourceGroups: 1,
    currentNumericRestaurants: 74,
    currentNumericSourceMenus: 771,
    currentNumericProductionMenus: 770,
    adminSavedNumericRestaurants: 1,
    adminSavedNumericMenus: 8,
    variablePriceRestaurants: 4,
    variablePriceMenus: 4,
    normalizedOrderRestaurants: 2,
    normalizedOrderMenus: 34,
    ambiguousMenusExcludedFromProduction: 1,
    totalSourceMenus: 817,
    totalProductionMenus: 816,
    identityReviewRestaurantsAppliedFromOriginalEvidence: 5,
    identityReviewNumericMenusAppliedFromOriginalEvidence: 36,
    identityReviewRestaurantsAppliedFromRelocationEvidence: 1,
    identityReviewNumericMenusRejectedAsWrongBusiness: 15,
    relocationNumericMenusApplied: 16,
    identityReviewRestaurantsPermanentlyDeleted: 2,
    identityReviewNumericMenusRejectedForDeletedRestaurants: 11,
    identityReviewRestaurantsExcluded: 2,
    identityReviewNumericMenusExcluded: 11,
  },
  duplicatePhysicalSources,
  excluded,
  identityReviewDecisions: identityReviewRecords.map((record) => ({
    ...record,
    checkedAt,
    userIdentityConfirmationAt,
    decision: identityReviewDecisions.get(record.restaurantId),
  })),
  relocationEvidence: relocation,
  restaurants: sourceRecords,
};

const conflicts = [];
let applied = 0;
let unchanged = 0;
for (const sourceRecord of sourceRecords) {
  const nextPatch = menuPatch(sourceRecord);
  const previous = overrides[sourceRecord.restaurantId] ?? {};
  const previousMenus = previous.menus ?? [];
  const oursAlready =
    previous.menuPriceVerifiedAt === sourceRecord.checkedAt &&
    String(previous.menuPriceStatus ?? "").includes(sourceRecord.checkedAt) &&
    previous.menuPriceSources?.some(
      (source) =>
        placeIdentity(source.url) === sourceRecord.sourceIdentity,
    );
  if (previousMenus.length && !oursAlready) {
    conflicts.push({
      restaurantId: sourceRecord.restaurantId,
      name: sourceRecord.name,
      existingMenuCount: previousMenus.length,
      existingVerifiedAt: previous.menuPriceVerifiedAt ?? null,
      sourceMenuCount: sourceRecord.menus.length,
      disposition: "preserved-existing-versioned-menu",
    });
    continue;
  }
  const merged = { ...previous, ...nextPatch };
  if (JSON.stringify(previous) === JSON.stringify(merged)) unchanged += 1;
  else applied += 1;
  overrides[sourceRecord.restaurantId] = merged;
}
assert.deepEqual(conflicts, [], "Refusing to replace an existing nonempty menu edit");

const deletionRecordsById = new Map(
  identityReviewRecords.map((record) => [record.restaurantId, record]),
);
const newTombstones = [...identityReviewDecisions]
  .filter(([, decision]) => decision.disposition === "permanently-delete")
  .map(([restaurantId, decision]) => {
    const record = deletionRecordsById.get(restaurantId);
    assert.ok(record, `Missing identity-review deletion source: ${restaurantId}`);
    return {
      id: restaurantId,
      name: record.name,
      address: record.address,
      reason: decision.reason,
      deletedAt: userIdentityConfirmationAt,
      note: decision.note,
      evidenceClassification: record.classification,
      evidenceCheckedAt: checkedAt,
      evidenceSourceUrl: record.sourceUrl,
      userIdentityConfirmationAt,
      currentBusinessName: decision.currentBusinessName,
    };
  });
let tombstonesAdded = 0;
let tombstoneOverridesRemoved = 0;
for (const tombstone of newTombstones) {
  const existing = deletions.restaurants.find((row) => row.id === tombstone.id);
  if (existing) {
    assert.deepEqual(existing, tombstone);
  } else {
    deletions.restaurants.push(tombstone);
    tombstonesAdded += 1;
  }
  if (overrides[tombstone.id]) {
    delete overrides[tombstone.id];
    tombstoneOverridesRemoved += 1;
  }
}

await mkdir(evidenceDirectory, { recursive: true });
await writeFile(evidencePath, stableJson(evidence), "utf8");
await writeFile(overridesPath, stableJson(overrides), "utf8");
await writeFile(deletionsPath, stableJson(deletions), "utf8");
console.log(
  JSON.stringify(
    {
      applied,
      unchanged,
      conflicts,
      tombstonesAdded,
      tombstoneOverridesRemoved,
      targetRestaurantIds: sourceRecords.length,
      totalMenus: evidence.counts.totalProductionMenus,
      numericSourceMenus: 779,
      numericProductionMenus: 778,
      variablePriceMenus: 4,
      normalizedOrderMenus: 34,
      physicalSourceIdentities: evidence.counts.physicalSourceIdentities,
      duplicatePhysicalSources,
      evidencePath: path.relative(root, evidencePath).replaceAll("\\", "/"),
    },
    null,
    2,
  ),
);
