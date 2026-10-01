import test from "node:test";
import assert from "node:assert/strict";
import { loadAppModules } from "../scripts/load-public-data.mjs";
const [editor] = await loadAppModules(["/src/lib/adminRestaurantEditor.ts"]);
const initial = {
  name: "식당",
  address: "서울 마포구 성미산로 10",
  region: "서울",
  category: "",
  lat: "37.5",
  lng: "127",
  phone: "",
  operationState: "unknown",
  menus: [{ id: "a", name: "국수", price: "8,000원" }],
  menuPriceSources: [],
  menuPriceVerifiedAt: "",
  menuPriceNote: "",
  sourceLinks: [],
};
test("formatting preserves market prices and never guesses malformed prices", () => {
  for (const [input, output] of [
    ["12000", "12,000원"],
    ["12,000", "12,000원"],
    ["0", "0원"],
    ["싯가", "싯가"],
    ["12,00", "12,00"],
    ["10,000~12,000원", "10,000~12,000원"],
    ["", ""],
  ])
    assert.equal(editor.formatMenuPrice(input), output);
});
test("deletion undo preserves unrelated edits and added rows", () => {
  const current = [
    { id: "b", name: "밥", price: "2,000원" },
    { id: "c", name: "차", price: "3,000원" },
  ];
  const restored = editor.restoreRemovedMenus(current, [
    { index: 0, menu: initial.menus[0] },
  ]);
  assert.deepEqual(
    restored.map(m => m.id),
    ["a", "b", "c"]
  );
  assert.equal(restored[1].price, "2,000원");
  assert.equal(
    editor.restoreRemovedMenus(restored, [{ index: 0, menu: initial.menus[0] }])
      .length,
    3
  );
});
test("pasted menus report invalid rows and preserve missing prices", () => {
  const result = editor.parseMenuPaste(
    "국수\t10000\n만두\t\n음료\t-100\n불명\t1000\t추가열"
  );
  assert.deepEqual(result.rows, [
    { name: "국수", price: "10,000원" },
    { name: "만두", price: "" },
  ]);
  assert.equal(result.errors.length, 2);
});
test("menu save validates names without blocking on preexisting missing category", () => {
  const d = structuredClone(initial);
  d.menus[0].price = "9000";
  assert.equal(editor.validateRestaurantDraft(d, initial), null);
  const changes = editor.buildRestaurantChanges(d, initial);
  assert.equal(changes.menus[0].price, "9,000원");
  assert.equal(changes.menuPriceVerifiedAt, "");
  assert.ok(!("lat" in changes));
  d.menus[0].name = "";
  assert.equal(editor.validateRestaurantDraft(d, initial).field, "name-a");
});
test("Naver vertical and inline menu text pairs prices and discards badges and duplicates", () => {
  const result = editor.parseMenuPaste(
    "메뉴\n메뉴판 이미지\n대표\n게장정식\n45,000원\n간장게장(포장)\n40,000원\n게장정식 추가 40,000원\n인기 게장정식\n45,000원\n더보기"
  );
  assert.deepEqual(result.rows, [
    { name: "게장정식", price: "45,000원" },
    { name: "간장게장(포장)", price: "40,000원" },
    { name: "게장정식 추가", price: "40,000원" },
  ]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.duplicates, 1);
});
test("copied links, quantity names, price ranges and variable prices are preserved", () => {
  const result = editor.parseMenuPaste(
    "- [만두(6개)](https://example.com/menu/1)\n***6,000***원\n한우(100g) 20,000~30,000원\n모둠회\n변동\n국수\n8000"
  );
  assert.deepEqual(result.rows, [
    { name: "만두(6개)", price: "6,000원" },
    { name: "한우(100g)", price: "20,000~30,000원" },
    { name: "모둠회", price: "변동" },
    { name: "국수", price: "8,000원" },
  ]);
  assert.deepEqual(result.errors, []);
});
test("Naver descriptions between a menu name and price are skipped", () => {
  const result = editor.parseMenuPaste(
    "양꼬치+파김치(찐궁합)\n텐텐양꼬치에서만 맛볼수있는 파김치와양꼬치의조합\n18,000원\n\n대표\n숯불숙성통양갈비바베큐(소)+파김치\n(2인분)건대에서 유일하게 파김치와 통양갈비의조합을 맛볼수 있는 텐텐양꼬치\n55,000원\n대표\n숯불숙성통양갈비바베큐(중)\n3인분\n65,000원\n대표\n숯불숙성통양갈비바베큐(대)+파김치\n(4인분) 건대에서 유일하게 숙성하여 만든 통양갈비 바베큐입니다.\n75,000원\n대표\n숯불숙성통양다리(소)+파김치\n3시간전 예약\n70,000원\n대표\n숯불숙성통양다리(중)+파김치\n3시간전예약\n80,000원\n대표\n숯불숙성통양다리(대)+파김치\n3시간전예약\n90,000원\n대표\n꿔바로우(소)\n100% 찹쌀튀김을 사용하여 기존의 꿔바로우와는 확연히 다릅니다.\n15,000원\n바지락볶음\n칭따오와 바지락볶음 생각한 그 이상의 조화\n22,000원\n\n양꼬치+파김치(찐궁합)\n설명\n18,000원\n숯불숙성통양갈비바베큐(소)+파김치\n설명\n55,000원\n숯불숙성통양갈비바베큐(중)\n설명\n65,000원\n숯불숙성통양갈비바베큐(대)+파김치\n설명\n75,000원\n숯불숙성통양다리(소)+파김치\n설명\n70,000원\n숯불숙성통양다리(중)+파김치\n설명\n80,000원"
  );
  assert.equal(result.rows.length, 9);
  assert.equal(result.duplicates, 6);
  assert.equal(result.ignoredDescriptions, 15);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rows.at(-1), { name: "바지락볶음", price: "22,000원" });
});
test("orphan and negative prices are blocked rather than guessed", () => {
  for (const value of [
    "9,000원",
    "국밥\n-9,000원",
    "국밥 -9,000원",
  ]) {
    const result = editor.parseMenuPaste(value);
    assert.equal(result.rows.length, 0, value);
    assert.ok(result.errors.length, value);
  }
});
test("CSV remains supported and same-name price conflicts stay visible", () => {
  const result = editor.parseMenuPaste(
    '"국수","10,000원"\n"국수","11,000원"\n"만두(6개)","8,000원"'
  );
  assert.equal(result.rows.length, 3);
  assert.deepEqual(result.conflicts, [
    { name: "국수", prices: ["10,000원", "11,000원"] },
  ]);
});
test("blank lines and badges keep separate Naver card boundaries", () => {
  const result = editor.parseMenuPaste("김밥\n\n대표\n라면\n5,000원");
  assert.deepEqual(result.rows, [
    { name: "김밥", price: "" },
    { name: "라면", price: "5,000원" },
  ]);
});
test("prices mentioned inside descriptions do not replace the card price", () => {
  const result = editor.parseMenuPaste(
    "가족세트\n2인 기준 20,000원 상당 구성\n35,000원"
  );
  assert.deepEqual(result.rows, [{ name: "가족세트", price: "35,000원" }]);
  assert.equal(result.ignoredDescriptions, 1);
  assert.deepEqual(result.errors, []);
});
test("an inline price at the end of a description is surfaced for review", () => {
  const result = editor.parseMenuPaste(
    "가족세트\n추가 선택 20,000원\n35,000원"
  );
  assert.equal(result.rows.length, 0);
  assert.ok(result.errors.some(error => error.includes("설명 안의 가격")));
});
test("invalid coordinates, dates and source links route to the right tab", () => {
  for (const [field, value, tab] of [
    ["lat", "0", "info"],
    ["menuPriceVerifiedAt", "2999-01-01", "sources"],
    ["menuPriceVerifiedAt", "2026-02-30", "sources"],
    [
      "menuPriceSources",
      [{ url: "javascript:alert(1)", label: "" }],
      "sources",
    ],
  ]) {
    assert.equal(
      editor.validateRestaurantDraft({ ...initial, [field]: value }, initial)
        .tab,
      tab
    );
  }
});

test("broadcast sources are editable and validate source, URL and date", () => {
  const source = {
    id: "admin:r_test:1",
    restaurantId: "r_test",
    sourceId: "wednesday-gourmet",
    label: "EP.173",
    sourceUrl: "https://example.com/episode/173",
    broadcastDate: "2026-09-28",
  };
  const draft = { ...structuredClone(initial), sourceLinks: [source] };
  assert.equal(editor.validateRestaurantDraft(draft, initial), null);
  assert.deepEqual(editor.buildRestaurantChanges(draft, initial).sourceLinks, [source]);

  assert.equal(
    editor.validateRestaurantDraft(
      { ...draft, sourceLinks: [{ ...source, sourceId: "" }] },
      initial
    ).field,
    "broadcast-source-0"
  );
  assert.equal(
    editor.validateRestaurantDraft(
      { ...draft, sourceLinks: [{ ...source, sourceUrl: "javascript:alert(1)" }] },
      initial
    ).field,
    "broadcast-url-0"
  );
  assert.equal(
    editor.validateRestaurantDraft(
      { ...draft, sourceLinks: [{ ...source, broadcastDate: "2026-02-30" }] },
      initial
    ).field,
    "broadcast-date-0"
  );
});
