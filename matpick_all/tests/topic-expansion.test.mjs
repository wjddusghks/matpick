import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { loadAppModules, projectRoot } from "../scripts/load-public-data.mjs";
const read = async p =>
  JSON.parse(await fs.readFile(path.resolve(projectRoot, p), "utf8"));
const [data, shortcuts] = await loadAppModules([
  "/src/data/index.ts",
  "/src/data/mapTopicShortcuts.ts",
]);
const report = await read("../source-data/topic-expansion-2026-09/report.json");
const queue = await read("../source-data/topic-expansion-2026-09/queue.json");
const before = await read(
  "../source-data/topic-expansion-2026-09/existing-restaurants.json"
);
const results = (
  await read("../source-data/topic-expansion-2026-09/results.json")
).restaurants;
const enrichment = await read(
  "client/src/data/generated/existing-data-enrichment.generated.json"
);
const menuFollowup = await read(
  "client/src/data/generated/menu-price-followup.generated.json"
);
const searchExpansion = await read(
  "client/src/data/generated/search-topic-expansion.generated.json"
);
const searchReport = await read(
  "../source-data/topic-expansion-2026-09-21/report.json"
);
const removed = await read('client/src/data/restaurant-permanent-deletions.json');
const removedIds = new Set(removed.restaurants.map(row => row.id));
test("all ten researched topics open real collections, preserving old restaurant URLs", () => {
  assert.equal(report.topics.length, 10);
  for (const t of report.topics) {
    const linked = new Set(
      data.sourceLinks.filter(l => l.sourceId === t.id).map(l => l.restaurantId)
    );
    assert.ok(t.published > 0, t.name);
    assert.equal(
      linked.size,
      t.published +
        (searchReport.topics.find(next => next.id === t.id)?.added || 0),
      t.name
    );
    assert.ok(
      shortcuts.mapTopicShortcuts.some(
        s => s.type === "source" && s.value === t.id
      )
    );
  }
  for (const r of before) {
    assert.equal(data.restaurants.some(v => v.id === r.id), !removedIds.has(r.id), `Unexpected retention/deletion: ${r.id}`);
  }
  // Subsequent verified batches may add restaurants; existing IDs above must survive.
  assert.ok(data.restaurants.length >=
    before.length + report.newRestaurants + searchReport.newRestaurants - removedIds.size);
});
test("published candidates have source evidence, matching branches and current menu provenance", () => {
  for (const a of report.approved) {
    const candidate = queue.find(c => c.id === a.candidateId),
      result = results[a.candidateId];
    assert.ok(
      candidate.evidence.length &&
        candidate.evidence.every(
          e => e.url.startsWith("https://") && e.sourceObservedAt
        )
    );
    assert.ok(result.match.accepted);
    assert.ok(
      [
        "verified_priced",
        "verified_menu_only",
        "public_menu_unavailable",
      ].includes(result.status)
    );
    const restaurant = data.getRestaurantById(a.restaurantId);
    assert.ok(restaurant);
    if (result.menus.length) {
      const newest = report.approved
        .filter(other => other.restaurantId === a.restaurantId)
        .map(other => results[other.candidateId])
        .filter(other => other.menus.length)
        .sort((left, right) =>
          right.checkedAt.localeCompare(left.checkedAt)
        )[0];
      const refreshed = searchExpansion.patches[restaurant.id]?.menus
        ? searchExpansion.patches[restaurant.id]
        : menuFollowup[restaurant.id]?.menus
          ? menuFollowup[restaurant.id]
          : enrichment[restaurant.id];
      const latestMenu = refreshed?.menus ? refreshed : null;
      assert.equal(
        restaurant.menuPriceVerifiedAt,
        latestMenu?.menuPriceVerifiedAt || newest.checkedAt
      );
      assert.ok(
        restaurant.menuPriceVerifiedAt.slice(0, 10) >=
          newest.checkedAt.slice(0, 10)
      );
      const expectedSources = latestMenu?.menuPriceSources || [
        { url: result.place.placeUrl },
      ];
      for (const source of expectedSources)
        assert.ok(restaurant.menuPriceSources.some(s => s.url === source.url));
      assert.deepEqual(
        restaurant.menus.map(m => [m.name, m.price]),
        (latestMenu?.menus || newest.menus).map(m => [m.name, m.price])
      );
    }
  }
  for (const held of report.review)
    assert.ok(
      !data.sourceLinks.some(l => l.id.startsWith(`appearance_${held.id}_`))
    );
  for (const l of data.sourceLinks.filter(l => l.sourceId === "taste-of-seoul"))
    assert.match(l.label, /2025/);
});
