import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { loadAppModules, projectRoot } from "../scripts/load-public-data.mjs";
import path from "node:path";
import { validateApprovedCandidate } from "../../scripts/tourism-data.mjs";
const read = async p =>
  JSON.parse(await fs.readFile(path.join(projectRoot, p), "utf8"));
const [data, shortcuts, eligibility] = await loadAppModules([
  "/src/data/index.ts",
  "/src/data/mapTopicShortcuts.ts",
  "/src/lib/restaurantEligibility.ts",
]);
test("existing travel and broadcast shortcuts preserve their public collections", async () => {
  const highlights = await read(
    "client/src/data/generated/discovery-highlights.generated.json"
  );
  for (const id of ["busan-bite", "jeju-bite", "jeonhyunmoo-plan"]) {
    assert.ok(shortcuts.mapTopicShortcuts.some(t => t.slug === id));
    const ids = new Set(
      data.sourceLinks.filter(l => l.sourceId === id).map(l => l.restaurantId)
    );
    assert.ok(ids.size > 0);
    assert.equal(highlights.find(h => h.slug === id)?.count, ids.size);
    assert.ok([...ids].some(id => !data.getRestaurantById(id).imageUrl));
    for (const id of ids)
      assert.ok(
        eligibility.isRestaurantRecommendable(data.getRestaurantById(id))
      );
  }
  assert.equal(
    new Set(data.restaurants.map(r => r.id)).size,
    data.restaurants.length
  );
});
test("published broadcast appearances have official episode evidence, never a map URL alone", () => {
  const links = data.sourceLinks.filter(l => l.sourceId === "jeonhyunmoo-plan");
  for (const l of links) {
    assert.match(l.sourceUrl, /^https:\/\/www\.mbn\.co\.kr\/totalCastView\//);
    assert.match(l.label, /시즌 [34] EP\.\d+/);
  }
  assert.ok(links.some(l => l.label === "시즌 4 EP.12"));
});

test("current broadcast menus never inherit old unverified prices", async () => {
  const source = await read("client/src/data/generated/jeonhyunmoo-plan-public.generated.json");
  for (const restaurant of source.restaurants.filter(r => !r.menus.some(m => m.price))) {
    const published = data.getRestaurantById(restaurant.id);
    assert.ok(published);
    assert.ok(published.menus.every(m => !m.price), restaurant.name);
  }
  for (const restaurant of data.restaurants) {
    assert.equal(new Set((restaurant.menus || []).map(m => m.id)).size, (restaurant.menus || []).length);
  }
});
test("publication requires branch proof, and unknown operation status is never called verified open", async () => {
  const approved = await read("../source-data/travel-discovery/approved.json");
  for (const r of approved) {
    validateApprovedCandidate(r);
    assert.match(
      r.verification.sourceUrl,
      /^https:\/\/place\.map\.kakao\.com\/\d+$/
    );
  }
  const c = approved[0];
  assert.ok(c);
  assert.throws(() =>
    validateApprovedCandidate({ ...c, operationState: "closed" })
  );
  assert.throws(() =>
    validateApprovedCandidate({
      ...c,
      operationState: "unknown",
      verification: { ...c.verification, basis: undefined },
    })
  );
  for (const r of data.restaurants.filter(
    r => r.id.startsWith("travel_") && r.operationState === "unknown"
  ))
    assert.equal(r.operationVerifiedAt, undefined);
});
