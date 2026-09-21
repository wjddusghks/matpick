import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { loadAppModules, projectRoot } from "../scripts/load-public-data.mjs";
const read = p =>
  fs.readFile(path.resolve(projectRoot, p), "utf8").then(JSON.parse);
const [data] = await loadAppModules(["/src/data/index.ts"]);
const batch = await read(
  "client/src/data/generated/search-topic-expansion.generated.json"
);
const report = await read(
  "../source-data/topic-expansion-2026-09-21/report.json"
);
const baseline = await read(
  "../source-data/topic-expansion-2026-09-21/baseline.json"
);
const research = await read(
  "../source-data/topic-expansion-2026-09-21/research.json"
);

test("verified search batch adds 20 unique places and 25 topic connections while retaining five canonical IDs", () => {
  assert.equal(report.newRestaurants, 20);
  assert.equal(report.refreshedRestaurants, 5);
  assert.equal(report.topics.length, 11);
  assert.equal(data.restaurants.length, baseline.restaurantCount + 20);
  assert.equal(data.sourceLinks.length, baseline.sourceLinkCount + 25);
  for (const t of report.topics) {
    const linked = new Set(
      data.sourceLinks.filter(l => l.sourceId === t.id).map(l => l.restaurantId)
    );
    assert.equal(linked.size, t.after, t.name);
    assert.ok(t.refreshed > 0, t.name);
  }
  for (const r of batch.restaurants) {
    const live = data.getRestaurantById(r.id);
    assert.ok(live, r.name);
    assert.equal(live.address, r.address);
    assert.deepEqual(
      live.menus.map(m => [m.name, m.price]),
      r.menus.map(m => [m.name, m.price])
    );
    assert.equal(live.menuPriceVerifiedAt, "2026-09-21");
    assert.ok(Math.abs(live.lat - r.lat) <= 0.000000501);
    assert.ok(Math.abs(live.lng - r.lng) <= 0.000000501);
    const evidence = research.find(v => v.name === r.name);
    assert.ok(
      evidence.evidence.length &&
        (evidence.coordinateMatchNote || evidence.coordinateSourceUrl)
    );
    for (const topicId of [
      evidence.topicId,
      ...(evidence.additionalTopics || []).map(t => t.topicId),
    ])
      assert.ok(
        data.getRestaurantsBySource(topicId).some(v => v.id === r.id),
        `${r.name}: ${topicId}`
      );
  }
});
test("unverified and delivery-only candidates stay unpublished; old and takeout prices keep their basis", () => {
  for (const r of research.filter(r => r.status !== "verified"))
    assert.ok(!batch.restaurants.some(v => v.name === r.name), r.name);
  const chicken = batch.restaurants.find(r => r.name === "두부자통닭 암사점");
  assert.equal(chicken.menuPriceSources[0].publishedAt, "2024-03-07");
  assert.match(chicken.menuPriceNote, /2024-03-07/);
  const sandwich = batch.restaurants.find(r => r.name === "금능샌드");
  assert.match(sandwich.menuPriceSources[0].label, /포장/);
  assert.match(sandwich.menuPriceNote, /포장/);
  assert.equal(report.menuItems, 264);
  assert.equal(report.numericPrices, 261);
});
test("relocated Locos retains existing links and receives the newly checked location and named menu items", () => {
  const r = data.getRestaurantById(
    "topic_enrichment_delicious-guys_b58a80b5a260"
  );
  assert.equal(r.address, "서울 용산구 회나무로 26 2층");
  assert.ok(r.lng < 126.99);
  assert.ok(
    data
      .getSourceLinksByRestaurant(r.id)
      .some(l => l.sourceId === "delicious-guys")
  );
  assert.ok(
    data
      .getSourceLinksByRestaurant(r.id)
      .some(l => l.sourceId === "mogeultende")
  );
  assert.equal(r.menus.length, 13);
});
