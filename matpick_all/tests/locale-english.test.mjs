import assert from "node:assert/strict";
import test from "node:test";
import {
  getEnglishAddress,
  getEnglishCreatorName,
  getEnglishEpisodeLabel,
  getEnglishMenuName,
  getEnglishProviderName,
  getEnglishRestaurantName,
  getEnglishSourceName,
  getLocalizedEditorialSummary,
  getLocalizedHoursText,
  getLocalizedPriceText,
  getLocalizedSearchDetail,
  getLocalizedSearchLabel,
  hasKoreanText,
} from "../client/src/lib/locale.ts";

test("English restaurant names and Korean addresses do not expose Hangul", () => {
  const name = getEnglishRestaurantName("맛픽식당");
  const address = getEnglishAddress("서울특별시 강남구 테헤란로 1");

  assert.equal(hasKoreanText(name), false);
  assert.equal(hasKoreanText(address), false);
  assert.match(address, /Seoul/);
});

test("English addresses keep numbers and use readable Korean address suffixes", () => {
  assert.equal(
    getEnglishAddress("서울특별시 강남구 테헤란로 1"),
    "Seoul, Gangnam-gu, Teheran-ro 1"
  );
  assert.equal(
    getEnglishAddress("충청남도 천안시 동남구 삼룡1길 9-40"),
    "Chungcheongnam-do, Cheonan-si, Dongnam-gu, Samryong 1-gil 9-40"
  );
  assert.equal(
    getEnglishAddress("서울시 강남구 역삼동 820-9 글라스타워 12층"),
    "Seoul, Gangnam-gu, Yeoksam-dong, 820-9 Geulraseu Tower Floor 12"
  );
  assert.equal(hasKoreanText(getEnglishAddress("인천광역시 중구 신흥동1가 34-1 상가 지하1층")), false);
});

test("established source and creator names stay consistent in English", () => {
  assert.equal(getEnglishSourceName("수요미식회"), "Wednesday Food Talk");
  assert.equal(getEnglishSourceName("맛있는 녀석들"), "Tasty Guys");
  assert.equal(getEnglishSourceName("흑백요리사 출연 셰프 식당"), "Culinary Class Wars Chef Restaurants");
  assert.equal(getEnglishCreatorName("성시경"), "Sung Si-kyung");
  assert.equal(getEnglishCreatorName("스튜디오수제"), "Studio Suze");
  assert.equal(getEnglishProviderName("중소벤처기업부"), "Ministry of SMEs and Startups");
  assert.equal(getEnglishEpisodeLabel("제12회 2부"), "Episode 12 Part 2");
});

test("search badges and matching details are useful English rather than raw transliteration", () => {
  assert.equal(getLocalizedSearchLabel("메뉴 일치", "en"), "Menu match");
  assert.equal(getLocalizedSearchLabel("기관 선정", "en"), "Institution selection");
  assert.equal(
    getLocalizedSearchDetail("돼지국밥 · 김치찌개", "메뉴 일치", "en"),
    "pork soup with rice · kimchi stew"
  );
  assert.equal(
    getLocalizedSearchDetail("메뉴·카테고리·지역에서 12곳", "통합 검색", "en"),
    "12 restaurants across menus, cuisines, and regions"
  );
});

test("the semantic menu glossary translates common Korean dishes", () => {
  assert.equal(getEnglishMenuName("돼지국밥"), "pork soup with rice");
  assert.equal(getEnglishMenuName("김치찌개"), "kimchi stew");
  assert.equal(getEnglishMenuName("전복죽"), "abalone porridge");
  assert.equal(getEnglishMenuName("새우튀김"), "shrimp tempura");
  assert.equal(getEnglishMenuName("순두부찌개"), "soft tofu stew");
  assert.equal(getEnglishMenuName("짜장면"), "black bean noodles");
  assert.equal(getEnglishMenuName("간짜장"), "dry-style black bean noodles");
  assert.equal(getEnglishMenuName("고기국수"), "meat noodle soup");
});

test("English price and hours presentation removes Korean-only units", () => {
  assert.equal(getLocalizedPriceText("11,000원", "en"), "₩11,000");
  assert.equal(getLocalizedPriceText("시가", "en"), "Market price");
  assert.equal(getLocalizedPriceText("10,000원 / 1인분", "en"), "₩10,000 per serving");
  assert.equal(getLocalizedPriceText("10,000원~20,000원", "en"), "₩10,000–₩20,000");
  assert.equal(getLocalizedPriceText("10,000~20,000원", "en"), "₩10,000–₩20,000");
  assert.equal(getLocalizedPriceText("10,000원(1인분)", "en"), "₩10,000 per serving");
  assert.equal(getLocalizedPriceText("20,000원 / 2인", "en"), "₩20,000 for 2 people");
  assert.equal(getLocalizedHoursText("정기휴무", "en"), "Closed");
});

test("Korean editorial prose uses an honest English fallback", () => {
  assert.equal(
    getLocalizedEditorialSummary("맛집을 소개하는 한국어 설명", "en", "English summary unavailable."),
    "English summary unavailable."
  );
  assert.equal(
    getLocalizedEditorialSummary("An authored English summary.", "en", "Fallback"),
    "An authored English summary."
  );
});
