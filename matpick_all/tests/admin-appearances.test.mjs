import test from "node:test";
import assert from "node:assert/strict";
import { loadAppModules } from "../scripts/load-public-data.mjs";
const [helpers] = await loadAppModules([
  "/src/lib/adminRestaurantAppearances.ts",
]);
const sources = [
  { id: "tv", name: "방송", type: "tv_show" },
  { id: "guide", name: "가이드", type: "guide" },
  { id: "creator", name: "채널", type: "creator" },
];
test("admin episode labels preserve seasons and distinguish different shows", () => {
  const result = helpers.getAdminAppearances(
    [
      {
        sourceId: "tv",
        label: "시즌 4 EP.12",
        broadcastDate: "2026-09-18",
        sourceUrl: "https://example.com/episode",
      },
      { sourceId: "tv", label: "시즌 4 EP.12" },
      { sourceId: "tv", label: "시즌 3 EP.12" },
      { sourceId: "creator", label: "12회" },
    ],
    sources
  );
  assert.equal(result.length, 3);
  assert.equal(new Set(result.map(r => r.key)).size, 3);
  assert.equal(
    result.find(r => r.season === 4 && r.episodeNumber === 12).date,
    "2026-09-18"
  );
});

test("episode view groups same-show restaurants, separates seasons, and keeps missing episodes visible", () => {
  const appearance = label =>
    helpers.getAdminAppearances([{ sourceId: "tv", label }], sources)[0];
  const rows = [
    {
      restaurant: { id: "first" },
      appearances: [appearance("시즌 4 EP.12"), appearance("시즌 3 EP.12")],
    },
    { restaurant: { id: "second" }, appearances: [appearance("시즌 4 12회")] },
    { restaurant: { id: "third" }, appearances: [appearance("시즌 4 EP.11")] },
    { restaurant: { id: "unknown" }, appearances: [] },
  ];
  const groups = helpers.groupAdminRestaurants(rows, "tv");
  assert.equal(groups.length, 4);
  assert.deepEqual(
    groups[0].entries.map(e => e.restaurant.id),
    ["first", "second"]
  );
  assert.equal(groups[0].appearance.season, 4);
  assert.equal(groups[1].appearance.episodeNumber, 11);
  assert.equal(groups[2].appearance.season, 3);
  assert.equal(groups[3].appearance, null);
  assert.equal(
    helpers.groupAdminRestaurants(
      rows.slice(0, 2),
      "tv",
      appearance("시즌 4 EP.12").key
    ).length,
    1
  );
});
test("directory ordinals and guide editions are never invented as episodes", () => {
  assert.deepEqual(
    helpers.getAdminAppearances(
      [
        { sourceId: "tv", ordinal: 53, label: "방송 소개" },
        { sourceId: "guide", ordinal: 100, label: "100회 기념 선정" },
      ],
      sources
    ),
    []
  );
  assert.equal(
    helpers.normalizeAdminRestaurantSearch("전현무계획 EP.12"),
    helpers.normalizeAdminRestaurantSearch("전현무계획 12회")
  );
});
