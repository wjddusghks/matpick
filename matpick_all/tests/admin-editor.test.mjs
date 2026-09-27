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
test("ambiguous descriptions, orphan prices and negative prices are blocked rather than guessed", () => {
  for (const value of [
    "국밥\n든든한 한 끼\n9,000원",
    "9,000원",
    "국밥\n-9,000원",
    "국밥 -9,000원",
    "만두\n6개\n8,000원",
  ]) {
    const result = editor.parseMenuPaste(value);
    assert.equal(result.rows.length, 0, value);
    assert.ok(result.errors.length, value);
  }
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
