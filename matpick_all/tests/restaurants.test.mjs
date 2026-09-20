import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadAppModules, projectRoot } from "../scripts/load-public-data.mjs";

const [data, nearby, eligibility, directions, builder, lightweightAliases, mapsConfig] = await loadAppModules([
  "/src/data/index.ts",
  "/src/lib/nearbyRecommendations.ts",
  "/src/lib/restaurantEligibility.ts",
  "/src/lib/restaurantDirections.ts",
  "/src/data/buildPublicDataset.ts",
  "/src/data/restaurantAliases.ts",
  "/src/lib/naverMapsConfig.ts",
]);
const sample = data.restaurants[0];
test("Maps uses new service keys without silently converting legacy credentials", () => {
  const modern = new URL(mapsConfig.getNaverMapsScriptUrl({ VITE_NAVER_MAP_KEY_ID: " new-key ", VITE_NAVER_MAP_CLIENT_ID: "old-key" }));
  assert.equal(modern.searchParams.get("ncpKeyId"), "new-key");
  assert.equal(modern.searchParams.has("ncpClientId"), false);
  const legacy = new URL(mapsConfig.getNaverMapsScriptUrl({ VITE_NAVER_MAP_CLIENT_ID: "old-key" }));
  assert.equal(legacy.searchParams.get("ncpClientId"), "old-key");
  assert.equal(mapsConfig.getNaverMapsScriptUrl({}), null);
});
const restaurant = (id, lng, operationState = "unknown") => ({
  ...sample,
  id,
  lat: 37.5,
  lng,
  isOverseas: false,
  operationState,
});

test("legacy Baesin URL resolves to the real restaurant without changing canonical IDs", () => {
  const current = data.getRestaurantById(
    "topic_enrichment_baekjong-wok_42ed76417b00"
  );
  assert.ok(current);
  assert.equal(
    data.getRestaurantById("baekjong_wok_restaurant_001").id,
    current.id
  );
  assert.equal(data.getRestaurantById("missing-restaurant"), null);
  assert.equal(data.restaurants.length, 2907);
  for (const [alias, target] of Object.entries(data.restaurantAliases)) {
    assert.equal(data.resolveRestaurantId(alias), target);
    assert.equal(data.resolveRestaurantId(target), target);
  }
});

test("recommendation counts use distinct sources, not empty creator visits or repeated episodes", () => {
  assert.equal(data.visits.length, 0);
  for (const restaurant of data.restaurants) {
    const distinct = new Set(
      data.getSourceLinksByRestaurant(restaurant.id).map(link => link.sourceId)
    );
    assert.equal(data.getRecommendationCount(restaurant.id), distinct.size);
    assert.ok(distinct.size > 0);
    assert.ok(data.getRestaurantRecommendationLabels(restaurant.id).length > 0);
  }
});

test("verified relocation preserves history and carries source evidence to the new location", () => {
  const first = data.getRestaurantById("sikgaek-baekban-trip_restaurant_166");
  const second = data.getRestaurantById("wednesday-gourmet_restaurant_552");
  assert.ok(first && second);
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.address, second.address);
  assert.equal(first.replacementRestaurantId, second.id);
  assert.equal(eligibility.isRestaurantRecommendable(first), false);
  assert.equal(eligibility.isRestaurantRecommendable(second), true);
  const newSources = new Set(data.getSourceLinksByRestaurant(second.id).map(link => link.sourceId));
  assert.ok(newSources.has("sikgaek-baekban-trip"));
  assert.ok(newSources.has("wednesday-gourmet"));
});

test("compiled public catalog matches raw-source compilation and lightweight aliases", () => {
  assert.deepEqual(data.dataSet, JSON.parse(JSON.stringify(builder.publicDataset)));
  for (const [oldId, newId] of Object.entries(data.restaurantAliases)) {
    assert.equal(lightweightAliases.resolveRestaurantId(oldId), newId);
  }
});

test("reviewed Seoul addresses have Seoul coordinates; closure and unresolved status stay excluded", () => {
  const ids = [
    "topic_enrichment_baekjong-wok_135d7666fa1b",
    "topic_enrichment_baekjong-wok_fa72469d5025",
    "topic_enrichment_baekjong-wok_ba28a1999fe0",
    "topic_enrichment_delicious-guys_762a359e49ec",
    "topic_enrichment_delicious-guys_942afcd2b332",
    "topic_enrichment_delicious-guys_06d249d787a7",
  ];
  for (const id of ids) {
    const item = data.getRestaurantById(id);
    assert.ok(item.lat > 37.3 && item.lat < 37.8 && item.lng > 126.7 && item.lng < 127.3);
    assert.ok(item.locationVerifiedAt && item.locationSourceUrls.length);
  }
  const closed = data.getRestaurantById(ids[1]);
  const unresolved = data.getRestaurantById(ids[3]);
  assert.equal(eligibility.getOperationState(closed), "closed");
  assert.equal(eligibility.isRestaurantRecommendable(closed), false);
  assert.equal(eligibility.isRestaurantRecommendable(data.getRestaurantById("wednesday-gourmet_restaurant_355")), false);
  assert.equal(eligibility.getOperationState(unresolved), "unknown");
  assert.equal(eligibility.isRestaurantRecommendable(unresolved), false);
  assert.ok(!data.searchRestaurants("교동두부").some(match => match.restaurant.id === unresolved.id));
  assert.equal(data.getRestaurantById(ids[0]).googlePlaceId, null);
});

test("unrecognized cuisines remain unclassified", () => {
  assert.equal(data.getCuisineCategory(""), "미분류");
  assert.equal(data.getCuisineCategory("unverified cuisine"), "미분류");
  assert.equal(data.getCuisineCategory("한식"), "한식");
  assert.equal(data.getCuisineCategory("이탈리안"), "양식");
  assert.equal(data.getCuisineCategory("베트남 쌀국수"), "베트남");
  assert.equal(data.getCuisineCategory("카페,디저트"), "카페·디저트");
  assert.equal(data.getCuisineCategory("감자탕"), "한식");
});

test("nearby candidates are distance ordered and exclude closed, moved and invalid positions", () => {
  const candidates = [
    restaurant("far", 127.04),
    restaurant("near", 127.001),
    restaurant("middle", 127.006),
    restaurant("closed", 127.0001, "closed"),
    restaurant("moved", 127.0002, "moved"),
    restaurant("invalid", NaN),
  ];
  const result = nearby.findNearbyRecommendations(candidates, {
    lat: 37.5,
    lng: 127,
  });
  assert.deepEqual(
    result.restaurants.map(({ id }) => id),
    ["near", "middle", "far"]
  );
  assert.ok(result.expanded);
  assert.ok(result.radiusMeters >= 3000);
});

test("sparse regions and no results have explicit range and preserve unknown status", () => {
  const sparse = nearby.findNearbyRecommendations([restaurant("only", 127.8)], {
    lat: 37.5,
    lng: 127,
  });
  assert.equal(sparse.restaurants.length, 1);
  assert.ok(sparse.radiusMeters > 30000);
  assert.equal(
    nearby.findNearbyRecommendations([], { lat: 37.5, lng: 127 }).restaurants
      .length,
    0
  );
  assert.equal(
    eligibility.getOperationState({ ...sample, operationStatus: "" }),
    "unknown"
  );
  assert.equal(
    eligibility.isRestaurantRecommendable({
      ...sample,
      operationStatus: "폐업",
    }),
    false
  );
});

test("directions target coordinates and escape the restaurant name", () => {
  const url = new URL(
    directions.getRestaurantDirectionsUrl({ ...sample, name: "A & B/식당" })
  );
  assert.equal(url.hostname, "map.naver.com");
  assert.equal(url.searchParams.get("elat"), String(sample.lat));
  assert.equal(url.searchParams.get("elng"), String(sample.lng));
  assert.equal(url.searchParams.get("etext"), "A & B/식당");
});

test("sitemap contains exactly the canonical restaurant IDs and the public Tasty Guys topic", async () => {
  const sitemap = await readFile(
    path.join(projectRoot, "client/public/sitemap.xml"),
    "utf8"
  );
  const ids = new Set(
    [...sitemap.matchAll(/<loc>[^<]*\/restaurant\/([^<]+)<\/loc>/g)].map(
      match => decodeURIComponent(match[1])
    )
  );
  assert.deepEqual(
    ids,
    new Set(data.restaurants.map(restaurant => restaurant.id))
  );
  const topic = data.discoveryTopics.find(
    topic => topic.targetId === "delicious-guys"
  );
  assert.ok(sitemap.includes(`${topic.path}</loc>`));
  assert.ok(!ids.has("baekjong_wok_restaurant_001"));
});
