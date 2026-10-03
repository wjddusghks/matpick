import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dataset = require("../client/src/data/generated/public-dataset.json");
const { MAX_PAGE_SIZE, MAX_RESULT_OFFSET, queryCatalog } = require("../../api/restaurants/_catalog.js");
const { enforceBrowserRequest } = require("../../api/_requestGuards.js");

function isPubliclyAvailable(restaurant) {
  return !restaurant.recommendationHold &&
    !["closed", "moved", "temporarily_closed"].includes(restaurant.operationState) &&
    !/폐업|이전|휴업|permanently\s*closed|temporarily\s*closed|relocated/i.test(restaurant.operationStatus || "");
}

test("catalog list responses are bounded and omit research provenance", () => {
  const result = queryCatalog({ view: "list", type: "featured", limit: "999" });
  assert.equal(result.status, 200);
  assert.equal(result.body.restaurants.length, MAX_PAGE_SIZE);
  assert.equal(result.body.hasMore, true);
  for (const restaurant of result.body.restaurants) {
    assert.equal("menuPriceSources" in restaurant, false);
    assert.equal("locationSourceUrls" in restaurant, false);
    assert.ok((restaurant.menus || []).length <= 3);
  }
});

test("catalog cursors are bounded by the finite catalog while allowing pagination", () => {
  const accepted = Buffer.from(String(MAX_RESULT_OFFSET), "utf8").toString("base64url");
  assert.equal(queryCatalog({ view: "list", type: "featured", cursor: accepted }).status, 200);
  const rejected = Buffer.from(String(MAX_RESULT_OFFSET + 1), "utf8").toString("base64url");
  assert.equal(queryCatalog({ view: "list", type: "featured", cursor: rejected }).status, 400);
});

test("detail returns one restaurant and only its source relationships", () => {
  const restaurant = dataset.restaurants.find(row =>
    dataset.sourceLinks.some(link => link.restaurantId === row.id)
  );
  const result = queryCatalog({ view: "detail", id: restaurant.id });
  assert.equal(result.status, 200);
  assert.equal(result.body.restaurant.id, restaurant.id);
  assert.ok(result.body.sourceLinks.length > 0);
  assert.ok(result.body.sourceLinks.every(link => link.restaurantId === restaurant.id));
});

test("empty searches cannot be used to dump the catalog", () => {
  assert.equal(queryCatalog({ view: "list", type: "search", q: "" }).status, 400);
  assert.equal(queryCatalog({ view: "list", type: "search", q: "a" }).status, 400);
  assert.equal(queryCatalog({ view: "list", type: "search", q: "온" }).status, 200);
  assert.ok(queryCatalog({ view: "list", type: "search", q: "Busan" }).body.restaurants.length > 0);
});

test("catalog browser guard requires same-site fetch metadata or a Matpick referrer", () => {
  function response() {
    return {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
  }
  const direct = response();
  assert.equal(enforceBrowserRequest({ headers: { host: "matpick.co.kr" } }, direct), false);
  assert.equal(direct.statusCode, 403);
  assert.equal(enforceBrowserRequest({
    headers: { host: "matpick.co.kr", "sec-fetch-site": "same-origin" },
  }, response()), true);
  assert.equal(enforceBrowserRequest({
    headers: { host: "matpick.co.kr", referer: "https://matpick.co.kr/map" },
  }, response()), true);
});

test("source pagination has no overlap and reaches every source restaurant", () => {
  const sourceId = "old-korean-100";
  const availableIds = new Set(dataset.restaurants.filter(isPubliclyAvailable).map(row => row.id));
  const expected = new Set(dataset.sourceLinks
    .filter(link => link.sourceId === sourceId && availableIds.has(link.restaurantId))
    .map(link => link.restaurantId));
  const found = new Set();
  let cursor;
  do {
    const result = queryCatalog({ view: "list", type: "source", value: sourceId, limit: 24, cursor });
    assert.equal(result.status, 200);
    for (const restaurant of result.body.restaurants) {
      assert.equal(found.has(restaurant.id), false, `duplicate ${restaurant.id}`);
      found.add(restaurant.id);
    }
    cursor = result.body.nextCursor || undefined;
  } while (cursor);
  assert.deepEqual(found, expected);
});

test("source totals are independent of the current page", () => {
  const result = queryCatalog({ view: "list", type: "source", value: "wednesday-gourmet", limit: 1 });
  const source = result.body.sources.find(item => item.id === "wednesday-gourmet");
  const availableIds = new Set(dataset.restaurants.filter(isPubliclyAvailable).map(row => row.id));
  const expected = new Set(dataset.sourceLinks
    .filter(link => link.sourceId === source.id && availableIds.has(link.restaurantId))
    .map(link => link.restaurantId)).size;
  assert.equal(result.body.restaurants.length, 1);
  assert.equal(result.body.totalCount, expected);
  assert.equal(source.restaurantCount, expected);
});

test("nearby results are sorted before the response is sliced", () => {
  const origin = dataset.restaurants.find(row => Number.isFinite(row.lat) && Number.isFinite(row.lng));
  const result = queryCatalog({
    view: "list", type: "nearby", lat: origin.lat, lng: origin.lng, limit: 8,
  });
  const distances = result.body.restaurants.map(row => row.distanceKm);
  assert.equal(distances[0], 0);
  assert.deepEqual(distances, [...distances].sort((a, b) => a - b));
});

test("durable edits apply and deleted restaurants stay out of public results", () => {
  const [edited, deleted] = dataset.restaurants.slice(0, 2);
  const edits = [
    { restaurantId: edited.id, changes: { name: "보호테스트식당" }, deletedAt: null },
    { restaurantId: deleted.id, changes: {}, deletedAt: new Date().toISOString() },
  ];
  assert.equal(queryCatalog({ view: "detail", id: edited.id }, edits).body.restaurant.name, "보호테스트식당");
  assert.equal(queryCatalog({ view: "detail", id: deleted.id }, edits).status, 404);
});

test("broadcast source edits replace source relationships in public catalog queries", () => {
  const restaurant = dataset.restaurants.find(row =>
    dataset.sourceLinks.some(link => link.restaurantId === row.id) &&
    !dataset.sourceLinks.some(link => link.restaurantId === row.id && link.sourceId === "community-picks")
  );
  const replacementSource = dataset.sources.find(source =>
    !dataset.sourceLinks.some(
      link => link.restaurantId === restaurant.id && link.sourceId === source.id
    )
  );
  const replacement = {
    id: `admin:${restaurant.id}:1`,
    restaurantId: restaurant.id,
    sourceId: replacementSource.id,
    label: "관리자 추가",
  };
  const edits = [
    {
      restaurantId: restaurant.id,
      changes: { sourceLinks: [replacement] },
      deletedAt: null,
    },
  ];
  const detail = queryCatalog({ view: "detail", id: restaurant.id }, edits);
  assert.deepEqual(detail.body.sourceLinks, [replacement]);
  let cursor;
  let found = false;
  do {
    const sourceResult = queryCatalog(
      {
        view: "list",
        type: "source",
        value: replacementSource.id,
        limit: 100,
        cursor,
      },
      edits
    );
    found ||= sourceResult.body.restaurants.some(row => row.id === restaurant.id);
    cursor = sourceResult.body.nextCursor || undefined;
  } while (cursor && !found);
  assert.equal(found, true);
});

test("imported community relationships survive historical source link overrides", () => {
  const communityLink = dataset.sourceLinks.find(link => link.sourceId === "community-picks");
  assert.ok(communityLink);
  const replacementSource = dataset.sources.find(source =>
    source.id !== "community-picks" &&
    !dataset.sourceLinks.some(
      link => link.restaurantId === communityLink.restaurantId && link.sourceId === source.id
    )
  );
  assert.ok(replacementSource);
  const replacement = {
    id: `admin:${communityLink.restaurantId}:community-regression`,
    restaurantId: communityLink.restaurantId,
    sourceId: replacementSource.id,
    label: "관리자 추가",
  };
  const edits = [{
    restaurantId: communityLink.restaurantId,
    changes: { sourceLinks: [replacement] },
    updatedAt: "2026-10-02T23:59:59+09:00",
    deletedAt: null,
  }];

  const detail = queryCatalog({ view: "detail", id: communityLink.restaurantId }, edits);
  assert.deepEqual(
    detail.body.sourceLinks.map(link => link.sourceId).sort(),
    [replacementSource.id, "community-picks"].sort(),
  );
  assert.equal(detail.body.sources.filter(source => source.id === "community-picks").length, 1);
  const sourceList = queryCatalog({
    view: "list", type: "source", value: "community-picks", limit: 100,
  }, edits);
  assert.ok(sourceList.body.sources.some(source => source.id === "community-picks"));
  assert.equal(sourceList.body.sources.filter(source => source.id === "community-picks").length, 1);

  const futureEdit = [{
    ...edits[0],
    updatedAt: "2026-10-04T00:00:00+09:00",
  }];
  const futureDetail = queryCatalog(
    { view: "detail", id: communityLink.restaurantId },
    futureEdit,
  );
  assert.deepEqual(futureDetail.body.sourceLinks, [replacement]);
});

test("featured ranking, creator scope and episode scope preserve server semantics", () => {
  const featured = queryCatalog({ view: "list", type: "featured", limit: 24 }).body.restaurants;
  const linkCounts = featured.map(row => dataset.sourceLinks.filter(link => link.restaurantId === row.id).length);
  assert.deepEqual(linkCounts, [...linkCounts].sort((a, b) => b - a));

  const creatorId = "UCrDMtdCSMTGVmUKvuhcahRw";
  const creator = queryCatalog({ view: "list", type: "creator", value: creatorId, limit: 24 });
  const creatorSourceIds = new Set(dataset.sources.filter(source => source.creatorId === creatorId).map(source => source.id));
  assert.ok(creator.body.restaurants.length > 0);
  assert.ok(creator.body.creators.some(item => item.id === creatorId));
  assert.ok(creator.body.restaurants.every(restaurant => dataset.sourceLinks.some(
    link => link.restaurantId === restaurant.id && creatorSourceIds.has(link.sourceId)
  )));

  const episode = queryCatalog({
    view: "list", type: "topic", value: "wednesday-gourmet", episode: "ep-173", limit: 24,
  });
  assert.ok(episode.body.restaurants.length > 0);
  const episodeRestaurantIds = new Set(dataset.sourceLinks
    .filter(link => link.sourceId === "wednesday-gourmet" && link.label === "EP.173")
    .map(link => link.restaurantId));
  assert.ok(episode.body.restaurants.length > 0);
  assert.ok(episode.body.restaurants.every(restaurant => episodeRestaurantIds.has(restaurant.id)));
});
