import test from "node:test";
import assert from "node:assert/strict";
import { loadAppModules } from "../scripts/load-public-data.mjs";

const [privateCatalog, data, nearby] = await loadAppModules([
  "/src/lib/privateGuideCatalog.ts",
  "/src/data/index.ts",
  "/src/lib/nearbyRecommendations.ts",
]);
const restaurant = (id, lng = 127, fields = {}) => ({
  id,
  name: `테스트식당 ${id}`,
  region: "테스트구",
  address: `서울 테스트구 가상로 ${id}`,
  category: "한식",
  representativeMenu: "검증용 국수",
  lat: 37.5,
  lng,
  imageUrl: "",
  ...fields,
});
const entry = (id, lng, fields = {}) => ({
  ...restaurant(`private-guide:${id}`, lng),
  privateGuideIds: ["seoul"],
  ...fields,
});

test("private guide duplicates annotate the public branch without mutating public data", () => {
  const original = restaurant("public");
  const duplicate = entry("duplicate", 127, {
    ...original,
    id: "private-guide:duplicate",
  });
  const merged = privateCatalog.mergePrivateRestaurants(
    [original],
    [duplicate]
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, "public");
  assert.deepEqual(merged[0].privateGuideIds, ["seoul"]);
  assert.equal(merged[0].adminOnly, undefined);
  assert.equal(original.privateGuideIds, undefined);
  assert.equal(
    privateCatalog.restaurantDetailPath(merged[0]),
    "/restaurant/public"
  );
});

test("same name with different address stays a separate branch; conflicting explicit public ID is withheld", () => {
  const original = restaurant("public");
  const other = entry("other", 127, {
    name: original.name,
    address: "서울 다른구 다른로 2",
  });
  assert.equal(
    privateCatalog.mergePrivateRestaurants([original], [other]).length,
    2
  );
  assert.equal(
    privateCatalog.mergePrivateRestaurants(
      [original],
      [{ ...other, publicRestaurantId: original.id }]
    ).length,
    1
  );
});

test("private results use the same text, menu, region, source and distance search, including more than six", () => {
  const original = restaurant("public", 127.02);
  const privateEntries = Array.from({ length: 8 }, (_, i) =>
    entry(String(i), 127 + i * 0.001)
  );
  const catalog = privateCatalog.mergePrivateRestaurants(
    [original],
    privateEntries
  );
  assert.equal(data.searchRestaurants("검증용 국수", catalog).length, 9);
  assert.equal(data.searchRestaurants("테스트구", catalog).length, 9);
  assert.equal(data.searchRestaurants("레드리본", catalog).length, 8);
  assert.equal(data.searchRestaurants("레드리본", [original]).length, 0);
  const found = nearby.findNearbyRecommendations(
    catalog,
    { lat: 37.5, lng: 127 },
    6
  );
  assert.equal(found.totalCount, 9);
  assert.deepEqual(
    found.restaurants.slice(0, 6).map(r => r.id),
    privateEntries.slice(0, 6).map(r => r.id)
  );
  const more = nearby.findNearbyRecommendations(
    catalog,
    { lat: 37.5, lng: 127 },
    12
  );
  assert.equal(more.restaurants.length, 9);
  assert.equal(
    privateCatalog.restaurantDetailPath(catalog[1]),
    "/admin/private-guides/restaurant/private-guide%3A0"
  );
  assert.equal(
    data
      .getSearchSuggestions("테스트식당 private-guide:0", 8, catalog)
      .find(r => r.type === "restaurant")?.adminOnly,
    true
  );
});

test("logout removes private-only rows and badges even from deferred search results", () => {
  const original = restaurant("public");
  const duplicate = entry("duplicate", 127, {
    ...original,
    id: "private-guide:duplicate",
  });
  const merged = privateCatalog.mergePrivateRestaurants(
    [original],
    [duplicate, entry("new", 127.01)]
  );
  const publicMap = new Map([[original.id, original]]);
  const afterLogout = privateCatalog.resolveCurrentResults(merged, publicMap);
  assert.deepEqual(afterLogout, [original]);
  assert.equal(afterLogout[0].privateGuideIds, undefined);
  assert.deepEqual(
    privateCatalog.resolveCurrentResults(merged, publicMap, "seoul"),
    []
  );
});
