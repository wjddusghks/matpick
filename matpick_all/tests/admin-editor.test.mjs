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
