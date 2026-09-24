import test from "node:test";
import assert from "node:assert/strict";
import { reconcileResearch } from "../../scripts/topic-publication/reconcile.mjs";
const restaurant = {
  id: "existing",
  name: "테스트식당",
  address: "서울 중구 을지로 10",
};
const row = (id, extra = {}) => ({
  id,
  name: restaurant.name,
  address: restaurant.address,
  topicRanks: [1],
  registryStatus: "registry_active",
  conflictCount: 0,
  ...extra,
});
const inputs = {
  records: [],
  decisions: [],
  catalog: {
    restaurants: [restaurant],
    sourceLinks: [{ restaurantId: "existing", sourceId: "one" }],
  },
  deletions: [],
  topicList: [
    { rank: 1, id: "one" },
    { rank: 2, id: "two" },
  ],
};

test("repeat appearances merge evidence rows but a missing topic still needs review", () => {
  const result = reconcileResearch({
    ...inputs,
    records: [row("a"), row("b", { topicRanks: [2] })],
  });
  assert.equal(result.groups.length, 1);
  assert.deepEqual(result.groups[0].rowIds, ["a", "b"]);
  assert.deepEqual(result.groups[0].publication.publishedRanks, [1]);
  assert.deepEqual(result.groups[0].publication.pendingRanks, [2]);
  assert.equal(result.summary.pendingCandidateRows, 1);
  assert.equal(result.summary.existingNeedsTopicGroups, 1);
});
test("later catalog additions leave the pending queue without changing original research", () => {
  const records = [row("a")];
  const before = JSON.stringify(records);
  const result = reconcileResearch({ ...inputs, records });
  assert.equal(result.groups[0].publication.reason, "published");
  assert.equal(result.summary.pendingCandidateRows, 0);
  assert.equal(JSON.stringify(records), before);
});
test("missing addresses and different branches are never treated as proven new or duplicates", () => {
  const result = reconcileResearch({
    ...inputs,
    records: [
      row("a", { address: "" }),
      row("b", { address: "" }),
      row("c", { address: "서울 중구 을지로 11" }),
    ],
  });
  assert.equal(result.groups.length, 3);
  assert.ok(
    result.groups.every(
      g =>
        g.publication.reason === "identity_review" &&
        !g.publication.restaurantId
    )
  );
  assert.ok(
    result.groups.every(g => g.publication.catalogState === "possible_existing")
  );
  assert.equal(result.groups[0].publication.possibleMatches[0].id, "existing");
});
test("deletions are excluded while closure or relocation conflicts remain reviewable", () => {
  const result = reconcileResearch({
    ...inputs,
    records: [row("a", { registryStatus: "registry_closed_at_address" })],
  });
  assert.equal(result.groups[0].publication.reason, "operation_review");
  const deleted = reconcileResearch({
    ...inputs,
    catalog: { restaurants: [], sourceLinks: [] },
    deletions: [restaurant],
    records: [row("a")],
  });
  assert.equal(deleted.groups[0].publication.reason, "excluded");
  assert.equal(deleted.summary.pendingCandidateRows, 0);
});
test("a missing unit cannot merge distinct floors through transitive identity", () => {
  const result = reconcileResearch({
    ...inputs,
    catalog: { restaurants: [], sourceLinks: [] },
    records: [
      row("a"),
      row("b", { address: restaurant.address + " 1층" }),
      row("c", { address: restaurant.address + " 2층" }),
    ],
  });
  assert.equal(result.groups.length, 2);
});
