import test from "node:test";
import assert from "node:assert/strict";
import {
  identityMatch,
  normalizeMenus,
  cleanRestaurantName,
} from "../../scripts/menu-research/matching.mjs";
import {
  normalizeTourismRecord,
  parseCsv,
  validateApprovedCandidate,
} from "../../scripts/tourism-data.mjs";

test("menu matches require both branch name and address; coordinates alone cannot approve", () => {
  const target = {
    name: "서울 테스트식당",
    address: "서울 마포구 월드컵로 12 (서교동 12-1)",
    lat: 37.5,
    lng: 127,
  };
  assert.equal(cleanRestaurantName(target), "테스트식당");
  assert.equal(
    identityMatch(target, {
      name: "테스트식당",
      address: "서울특별시 마포구 월드컵로 12 1층",
    }).accepted,
    true
  );
  for (const candidate of [
    { name: "테스트식당", address: "서울 마포구 월드컵로 120" },
    { name: "테스트식당", address: "부산 중구 월드컵로 12" },
    { name: "다른식당", address: target.address },
    { name: "테스트식당", address: "", lat: 37.5, lng: 127 },
  ])
    assert.equal(identityMatch(target, candidate).accepted, false);
});
test("menu prices are never guessed for empty, market-priced or invalid entries", () => {
  const menus = normalizeMenus(
    [
      { name: "국수", price: "10,000" },
      { name: "생선", price: "시가" },
      { name: "고기", price: null },
      { name: "반찬", price: 0 },
      { name: "국수", price: 10000 },
    ],
    "r_test"
  );
  assert.equal(menus.length, 4);
  assert.equal(menus[0].price, "10,000원");
  assert.ok(menus.slice(1).every(menu => !menu.price));
});
test("guide address formatting and local boundary renames retain branch identity", () => {
  for (const [formatted, canonical] of [
    ["강남구 선릉로 158길 11, Seoul, 한국", "서울 강남구 선릉로158길 11"],
    ["중구 퇴계로 6가길 30, Seoul, 한국", "서울 중구 퇴계로6가길 30"],
    ["해운대구 마린시티 3로 37, Busan, 한국", "부산 해운대구 마린시티3로 37"],
  ]) {
    assert.equal(identityMatch({name:"같은식당",address:formatted}, {name:"같은식당",address:canonical}).accepted, true);
    assert.equal(identityMatch({name:"같은식당",address:formatted}, {name:"같은식당",address:`${canonical}-1`}).accepted, false);
  }
  assert.equal(
    identityMatch(
      {
        name: "바오하우스",
        address: "부산진구 서전로 38번길 62-9, Busan, 47294, 한국",
      },
      { name: "바오하우스", address: "부산 부산진구 서전로38번길 62-9" }
    ).accepted,
    true
  );
  assert.equal(
    identityMatch(
      {
        name: "같은식당",
        address: "인천 중구 우현로 10",
        lat: 37.47,
        lng: 126.62,
      },
      {
        name: "같은식당",
        address: "인천 제물포구 우현로 10",
        lat: 37.47001,
        lng: 126.62001,
      }
    ).accepted,
    true
  );
});
test("CSV import preserves Korean, quoted prices and embedded line breaks", () => {
  const rows = parseCsv(
    '\uFEFF콘텐츠명,대표메뉴기타\r\n가게,"국수 8,000원\n냉면 9,000원"\r\n'
  );
  assert.equal(rows[0]["콘텐츠명"], "가게");
  assert.equal(rows[0]["대표메뉴기타"], "국수 8,000원\n냉면 9,000원");
  assert.throws(() => parseCsv('name,menu\n"unclosed'));
});
test("official-feed imports stay pending and never treat missing coordinates as a real location", () => {
  const jeju = normalizeTourismRecord(
    "visit-jeju",
    { 콘텐츠명: "제주식당", 대표메뉴기타: "국수 8,000원" },
    0,
    "2026-09-20"
  );
  assert.equal(jeju.reviewStatus, "pending");
  assert.ok(jeju.issues.includes("address_missing"));
  assert.ok(jeju.issues.includes("coordinates_missing_or_invalid"));
  assert.throws(() => validateApprovedCandidate(jeju));
  assert.equal(
    normalizeTourismRecord(
      "tourapi",
      { contenttypeid: "12", title: "관광지" },
      0,
      "2026-09-20"
    ),
    null
  );
  const busan = normalizeTourismRecord(
    "busan",
    {
      UC_SEQ: 123,
      MAIN_TITLE: "부산식당",
      ADDR1: "중구 중앙대로 1",
      LAT: "35.1",
      LNG: "129.0",
      RPRSNTV_MENU: "국밥",
    },
    0,
    "2026-09-20"
  );
  assert.equal(busan.address, "부산 중구 중앙대로 1");
  assert.equal(busan.lat, 35.1);
  assert.throws(() =>
    validateApprovedCandidate({ ...busan, reviewStatus: "approved" })
  );
  assert.doesNotThrow(() =>
    validateApprovedCandidate({
      ...busan,
      reviewStatus: "approved",
      operationState: "operating",
      verification: {
        checkedAt: "2026-09-20",
        sourceUrl: "https://example.com/restaurant",
      },
    })
  );
});
