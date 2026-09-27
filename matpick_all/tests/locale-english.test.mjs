import assert from "node:assert/strict";
import test from "node:test";
import {
  getEnglishAddress,
  getEnglishMenuName,
  getEnglishRestaurantName,
  getLocalizedEditorialSummary,
  getLocalizedHoursText,
  getLocalizedPriceText,
  hasKoreanText,
} from "../client/src/lib/locale.ts";

test("English restaurant names and Korean addresses do not expose Hangul", () => {
  const name = getEnglishRestaurantName("맛픽식당");
  const address = getEnglishAddress("서울특별시 강남구 테헤란로 1");

  assert.equal(hasKoreanText(name), false);
  assert.equal(hasKoreanText(address), false);
  assert.match(address, /Seoul/);
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
