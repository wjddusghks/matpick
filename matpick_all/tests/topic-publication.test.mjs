import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  sameIdentity,
  sameAddress,
  hasPublishableEvidence,
  safeSourceUrl,
} from "../../scripts/topic-publication/identity.mjs";
import { loadAppModules } from "../scripts/load-public-data.mjs";
const require = createRequire(import.meta.url);
const input = require("../../source-data/topic-publication-2026-09-22/candidates.json");
const publication = require("../../source-data/topic-publication-2026-09-22/publication.json");
const baseline = require("../../source-data/topic-publication-2026-09-22/catalog-baseline.json");
const batch = require("../client/src/data/generated/researched-topics.generated.json");
const removed = require('../client/src/data/restaurant-permanent-deletions.json');
const overrides = require('../client/src/data/restaurant-overrides.json');
const requestedBatch = require('../client/src/data/generated/requested-topic-expansion.generated.json');
const requestedPublication = require('../../source-data/expansion-coordinate-2026-09-24/publication.json');
const choizaBatch = require('../client/src/data/generated/choiza-road.generated.json');
const choizaPublication = require('../../source-data/choiza-complete-2026-09-24/publication.json');
const [data, shortcuts, eligibility] = await loadAppModules([
  "/src/data/index.ts",
  "/src/data/mapTopicShortcuts.ts",
  "/src/lib/restaurantEligibility.ts",
]);

test("building numbers, districts and units prevent namesake matches", () => {
  assert.equal(
    sameAddress("서울 서초구 강남대로110길 32", "서울 서초구 강남대로110길 13"),
    false
  );
  assert.equal(
    sameAddress("경기도 광주시 중앙로 10", "광주광역시 동구 중앙로 10"),
    false
  );
  assert.equal(
    sameAddress("경기 수원시 영통구 대학로 1", "경기 수원시 장안구 대학로 1"),
    false
  );
  assert.equal(
    sameAddress(
      "서울 마포구 마포대로 10 1층",
      "서울 마포구 마포대로 10 지하1층"
    ),
    false
  );
  assert.equal(
    sameAddress(
      "서울 마포구 마포대로 10 101호",
      "서울 마포구 마포대로 10 102호"
    ),
    false
  );
  assert.equal(
    sameAddress("서울특별시 마포구 마포대로 10", "마포구 마포대로 10, Seoul"),
    true
  );
  assert.equal(
    sameAddress(
      "서울 마포구 마포대로 10 1층",
      "서울 마포구 마포대로 10 1,2,3층"
    ),
    true
  );
  assert.equal(
    sameIdentity(
      { name: "진미식당", address: "" },
      { name: "진미식당", address: "서울 마포구 마포대로 186-6" }
    ),
    false
  );
  assert.equal(
    sameIdentity(
      { name: "금돼지식당", address: "서울 중구 신당동 370-69" },
      { name: "금돼지 식당", address: "서울 중구 다산로 149" },
      ["서울특별시 중구 다산로 149"]
    ),
    true
  );
});
test("directory listings, transcripts and unsafe links are not publication proof", () => {
  assert.equal(
    hasPublishableEvidence(
      {
        topicRank: 6,
        sourceUrl:
          "https://matstar.sbs.co.kr/program.html?programs=K02_T2014-0844",
        episodeId: "123",
      },
      6
    ),
    false
  );
  assert.equal(
    hasPublishableEvidence(
      {
        topicRank: 1,
        sourceUrl: "https://www.youtube.com/watch?v=abc",
        sourceKind: "public_video_transcript",
      },
      1
    ),
    false
  );
  assert.equal(
    hasPublishableEvidence(
      {
        topicRank: 1,
        sourceUrl: "https://www.youtube.com/watch?v=abc",
        sourceKind: "official_description",
        hasCorrectionOrOperationNote: true,
      },
      1
    ),
    false
  );
  assert.equal(safeSourceUrl("javascript:alert(1)"), "");
  assert.equal(safeSourceUrl("https://user:pass@example.com"), "");
});
test("original census keeps its existing-only feed; verified expansion adds eligible sourced restaurants", () => {
  assert.equal(batch.sources.length, 10);
  assert.equal(batch.restaurants.length, 0);
  assert.equal(data.restaurants.length, baseline.restaurants.length - removed.restaurants.length + requestedPublication.addedRestaurantRows + choizaPublication.newRestaurants);
  const existing = new Map(baseline.restaurants.map(r => [r.id, r]));
  for (const source of batch.sources) {
    assert.ok(shortcuts.mapTopicShortcuts.some(t => t.value === source.id));
    assert.ok(data.publicDiscoveryTopics.some(t => t.targetId === source.id));
    const linked = data.getRestaurantsBySource(source.id);
    const expected = new Set([...batch.sourceLinks, ...requestedBatch.sourceLinks, ...choizaBatch.sourceLinks].filter(link => link.sourceId === source.id)
      .map(link => data.getRestaurantById(link.restaurantId))
      .filter(r => r && eligibility.isRestaurantRecommendable(r)).map(r => r.id));
    assert.deepEqual(new Set(linked.map(r => r.id)), expected);
    for (const r of linked) {
      assert.ok(existing.has(r.id) || [...requestedBatch.restaurants, ...choizaBatch.restaurants].some(next => data.getRestaurantById(next.id)?.id === r.id));
      assert.ok(eligibility.isRestaurantRecommendable(r), r.name);
      const requestedPatch = Object.entries(requestedBatch.patches).find(([id]) => data.getRestaurantById(id)?.id === r.id)?.[1];
      const choizaRestaurant = choizaBatch.restaurants.find(next => data.getRestaurantById(next.id)?.id === r.id);
      const current = {...existing.get(r.id), ...requestedPatch, ...choizaRestaurant, ...overrides[r.id]};
      assert.equal(r.address, current.address);
      assert.equal(r.lat, Number(current.lat.toFixed(6)));
      assert.equal(r.lng, Number(current.lng.toFixed(6)));
    }
  }
  for (const link of batch.sourceLinks)
    assert.ok(safeSourceUrl(link.sourceUrl));
  assert.equal(
    data.sources.some(s => s.id === "culinary-class-wars"),
    false
  );
  assert.match(
    batch.sources.find(s => s.id === "culinary-class-wars-chefs").description,
    /현재 재직을 뜻하지/
  );
});
test("every research row is accounted for; operation conflicts never gain public topics", () => {
  assert.equal(input.records.length, 22117);
  assert.equal(publication.decisions.length, input.records.length);
  assert.equal(
    new Set(publication.decisions.map(r => r.id)).size,
    input.records.length
  );
  const decisions = new Map(publication.decisions.map(d => [d.id, d]));
  for (const c of input.records) {
    const d = decisions.get(c.id);
    assert.ok(d);
    if (d.reason === "operation_review") assert.deepEqual(d.publishedRanks, []);
    for (const rank of d.publishedRanks) assert.ok(c.topicRanks.includes(rank));
  }
  assert.equal(publication.summary.complete, false);
  assert.equal(
    publication.summary.pendingCandidateRows +
      publication.summary.fullyPublishedRows,
    input.records.length
  );
});
