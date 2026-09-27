import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  getEnglishMenuName,
  translateMenuNameDetailed,
} from "../client/src/lib/menuEnglish.ts";
import { getLocalizedMenuName } from "../client/src/lib/locale.ts";

test("frequent complete dishes use conventional semantic English names", () => {
  const cases = new Map([
    ["된장찌개", "soybean paste stew"],
    ["비빔냉면", "spicy mixed cold noodles"],
    ["순대국밥", "blood sausage soup with rice"],
    ["군만두", "fried dumplings"],
    ["육회비빔밥", "beef tartare bibimbap"],
    ["아구찜", "spicy braised monkfish"],
    ["난자완스", "braised meatballs"],
    ["성게미역국", "sea urchin seaweed soup"],
    ["기스면", "shredded chicken noodle soup"],
    ["전복뚝배기", "abalone hot-pot stew"],
    ["카페 라떼", "cafe latte"],
    ["특설렁탕", "special ox bone soup"],
    ["회무침", "spicy sashimi salad"],
    ["아이스크림", "ice cream"],
    ["오렌지주스", "orange juice"],
    ["돈코츠라멘", "tonkotsu ramen"],
    ["계란후라이", "fried egg"],
    ["청경채볶음", "stir-fried bok choy"],
    ["대패삼겹살", "thin-sliced pork belly"],
    ["생강차", "ginger tea"],
    ["전복 리조또", "abalone risotto"],
    ["전복리조또", "abalone risotto"],
    ["후토마키(반줄)", "futomaki (half roll)"],
    ["안거미", "angeomi beef cut"],
    ["짝갈비살", "paired rib meat"],
    ["巨大 양념갈비", "Geodae marinated short ribs"],
    ["巨大 양념갈비(240g)", "Geodae marinated short ribs (240g)"],
  ]);

  for (const [korean, english] of cases) {
    assert.equal(getEnglishMenuName(korean), english, korean);
  }
});

test("unseen compounds use longest-match culinary terms", () => {
  assert.equal(getEnglishMenuName("흑돼지김치찌개"), "black pork kimchi stew");
  assert.equal(getEnglishMenuName("바지락칼국수"), "clam knife-cut noodle soup");
  assert.equal(getEnglishMenuName("미더덕찜"), "sea pineapple steamed or braised");
  assert.equal(getEnglishMenuName("한우안심숯불구이"), "Korean beef tenderloin charcoal-grilled");
  assert.equal(getEnglishMenuName("계절 이탈리안 디너 코스"), "seasonal Italian dinner course");
});

test("house-name fragments are romanized while generic dish nouns are translated", () => {
  const result = translateMenuNameDetailed("라도삼겹살 (150g)");
  assert.equal(result.english, "Rado pork belly (150g)");
  assert.deepEqual(result.unknownSegments, ["라도"]);
  assert.ok(result.translatedHangulCharacters > 0);
  assert.ok(result.translatedHangulCharacters < result.totalHangulCharacters);
});

test("sizes, servings, prices, and separators retain their source facts", () => {
  assert.equal(getEnglishMenuName("수육(대)"), "boiled meat slices (large)");
  assert.equal(getEnglishMenuName("모듬회 / 2인분"), "assorted sashimi / 2 servings");
  assert.equal(getEnglishMenuName("10,000~20,000원"), "₩10,000–₩20,000");
  assert.equal(getEnglishMenuName("2인이상 주문 가능"), "for 2+ people order available");
  assert.equal(getEnglishMenuName("1인분"), "1 serving");
  assert.equal(getEnglishMenuName("1인"), "for 1 person");
});

test("ambiguous meat names stay species-neutral", () => {
  assert.equal(getEnglishMenuName("수육"), "boiled meat slices");
  assert.equal(getEnglishMenuName("백숙"), "whole poultry soup");
  assert.doesNotMatch(getEnglishMenuName("수육"), /pork|beef|chicken/i);
});

test("locale menu integration uses the comprehensive translator only in English", () => {
  assert.equal(getLocalizedMenuName("새우볶음밥", "en"), "shrimp fried rice");
  assert.equal(getLocalizedMenuName("새우볶음밥", "ko"), "새우볶음밥");
});

test("the current corpus has useful semantic coverage, tracked separately from romanization", () => {
  const dataset = JSON.parse(fs.readFileSync(
    new URL("../client/src/data/generated/public-dataset.json", import.meta.url),
    "utf8"
  ));
  const names = dataset.restaurants.flatMap(restaurant =>
    (restaurant.menus ?? []).map(menu => menu.name).filter(Boolean)
  );
  let koreanRows = 0;
  let semanticRows = 0;
  let romanizedOnlyRows = 0;

  for (const name of names) {
    const result = translateMenuNameDetailed(name);
    assert.doesNotMatch(result.english, /[가-힣]/, name);
    if (result.totalHangulCharacters === 0) continue;
    koreanRows += 1;
    if (result.translatedHangulCharacters > 0) semanticRows += 1;
    else romanizedOnlyRows += 1;
  }

  assert.equal(names.length, 39_764);
  assert.ok(semanticRows / koreanRows > 0.9, `${semanticRows}/${koreanRows}`);
  assert.ok(romanizedOnlyRows > 0, "unresolved romanized rows must remain visible to the audit");
});

