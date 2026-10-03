import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const mapCollectionsSource = await readFile(
  new URL("../client/src/data/mapCollections.ts", import.meta.url),
  "utf8"
);
const runtimeDatasetSource = await readFile(
  new URL("../client/src/data/runtimeDataset.ts", import.meta.url),
  "utf8"
);
const searchMapSource = await readFile(
  new URL("../client/src/pages/SearchMap.tsx", import.meta.url),
  "utf8"
);
const dataset = JSON.parse(
  await readFile(
    new URL(
      "../client/src/data/generated/public-dataset.json",
      import.meta.url
    ),
    "utf8"
  )
);

function readSeongsuRestaurantIds() {
  const collection = mapCollectionsSource.match(
    /slug:\s*"seongsu-tv-youtube"[\s\S]*?restaurantIds:\s*\[([\s\S]*?)\]\s*,\s*regionKeywords:/
  );
  assert.ok(collection, "Seongsu campaign collection must exist");
  return Array.from(collection[1].matchAll(/"([^"]+)"/g), match => match[1]);
}

test("Seongsu launch collection is a stable 24-place TV/YouTube map inside Seongdong", () => {
  const ids = readSeongsuRestaurantIds();
  assert.equal(ids.length, 24);
  assert.equal(new Set(ids).size, ids.length);

  const restaurantsById = new Map(
    dataset.restaurants.map(restaurant => [restaurant.id, restaurant])
  );
  const sourcesById = new Map(
    dataset.sources.map(source => [source.id, source])
  );
  const sourceLinksByRestaurant = new Map();
  for (const link of dataset.sourceLinks) {
    const links = sourceLinksByRestaurant.get(link.restaurantId) || [];
    links.push(link);
    sourceLinksByRestaurant.set(link.restaurantId, links);
  }

  for (const id of ids) {
    const restaurant = restaurantsById.get(id);
    assert.ok(restaurant, `${id} must exist in the public catalog`);
    assert.match(restaurant.address, /성동구/);
    assert.doesNotMatch(restaurant.address, /광진구/);
    assert.ok(
      restaurant.lat >= 37.537 && restaurant.lat <= 37.55,
      `${id} latitude must stay in the audited Seongsu corridor`
    );
    assert.ok(
      restaurant.lng >= 127.038 && restaurant.lng <= 127.065,
      `${id} longitude must stay in the audited Seongsu corridor`
    );
    assert.ok(!restaurant.recommendationHold);
    assert.ok(
      !["closed", "moved", "temporarily_closed"].includes(
        restaurant.operationState
      )
    );

    const sourceTypes = (sourceLinksByRestaurant.get(id) || [])
      .map(link => sourcesById.get(link.sourceId)?.type)
      .filter(Boolean);
    assert.ok(
      sourceTypes.some(type => type === "tv_show" || type === "creator"),
      `${id} must have a TV or YouTube/creator source`
    );
  }
});

test("collection deep links load their explicit restaurants and report the collection count", () => {
  assert.match(
    runtimeDatasetSource,
    /type === "collection"[\s\S]*?type: "ids"/
  );
  assert.match(
    runtimeDatasetSource,
    /ids: collection\.restaurantIds\.join\(","\)/
  );
  assert.match(
    searchMapSource,
    /const usesCatalogPagination = \[[\s\S]*?\]\.includes\(type\)/
  );
  assert.match(searchMapSource, /const reportedTotal = usesCatalogPagination/);
  assert.match(
    searchMapSource,
    /const nextCatalogPageHref = usesCatalogPagination/
  );
});

test("client attribution keeps the first campaign when a later URL has new UTMs", async () => {
  const analyticsSource = await readFile(
    new URL("../client/src/lib/analytics.ts", import.meta.url),
    "utf8"
  );
  const testableSource = analyticsSource.replace(
    /import\s+\{\s*hasAnalyticsConsent\s*\}\s+from\s+"@\/lib\/privacyConsent";/,
    "const hasAnalyticsConsent = () => true;"
  );
  const compiled = ts.transpileModule(testableSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const analytics = await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
  );

  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const oldWindow = globalThis.window;
  const oldFetch = globalThis.fetch;
  const payloads = [];
  globalThis.window = {
    location: {
      hostname: "matpick.co.kr",
      pathname: "/map",
      search: "?utm_source=instagram&utm_medium=paid_social&utm_campaign=initial_a&utm_content=ko_demo_a",
    },
    sessionStorage: storage,
    localStorage: storage,
  };
  globalThis.fetch = async (_url, options) => {
    payloads.push(JSON.parse(options.body));
    return { ok: true };
  };

  try {
    analytics.trackAnalyticsEvent("session_start");
    globalThis.window.location.search =
      "?utm_source=instagram&utm_medium=paid_social&utm_campaign=later_b&utm_content=ko_carousel_b";
    analytics.trackAnalyticsEvent("marketing_event", {
      name: "directions_click",
      restaurantId: "r_f2be38a5",
    });
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(payloads.length, 2);
    assert.equal(
      payloads[0].campaignPath,
      "/?utm_source=instagram&utm_medium=paid_social&utm_campaign=initial_a&utm_content=ko_demo_a"
    );
    assert.equal(payloads[1].campaignPath, payloads[0].campaignPath);
    assert.doesNotMatch(payloads[1].campaignPath, /later_b|ko_carousel_b/);
  } finally {
    globalThis.window = oldWindow;
    globalThis.fetch = oldFetch;
  }
});
