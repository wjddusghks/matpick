import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadAppModules } from "../scripts/load-public-data.mjs";
const require = createRequire(import.meta.url);
const provider = require("../../api/routes/_providers.js");
const handler = require("../../api/routes/index.js");
const [nearby, navigation, sources, share, directions, travel] =
  await loadAppModules([
    "/src/lib/nearbyRecommendations.ts",
    "/src/lib/mapNavigation.ts",
    "/src/lib/restaurantSources.ts",
    "/src/lib/share.ts",
    "/src/lib/restaurantDirections.ts",
    "/src/lib/travelTimes.ts",
  ]);
function replaceGlobal(t, key, value) {
  const original = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, key, original);
    else delete globalThis[key];
  });
}
const point = (id, lng, extra = {}) => ({
  id,
  name: id,
  lat: 37.5,
  lng,
  ...extra,
});

test("search starts with six nearest matches without losing the rest or unknown coordinates", () => {
  const input = [
    point("far", 127.12),
    point("unknown", 0),
    ...Array.from({ length: 7 }, (_, i) =>
      point(String(i), 127 + i * 0.005)
    ).reverse(),
  ];
  const sorted = nearby.sortRestaurantsByDistance(input, {
    lat: 37.5,
    lng: 127,
  });
  assert.deepEqual(
    sorted.slice(0, navigation.readMapView("").visibleCount).map(r => r.id),
    ["0", "1", "2", "3", "4", "5"]
  );
  assert.equal(sorted.at(-1).id, "unknown");
  assert.equal(sorted.length, input.length);
  assert.equal(nearby.sortRestaurantsByDistance(input, null), input);
  assert.equal(navigation.readMapView("shown=3").visibleCount, 6);
  const url = navigation.withMapView(
    "type=query&value=성수&source=ttoganjip",
    "far",
    12
  );
  assert.equal(navigation.readMapView(url.split("?")[1]).visibleCount, 12);
  assert.ok(url.includes("source=ttoganjip"));
  assert.equal(
    nearby
      .findNearbyRecommendations(
        input.filter(r => r.id !== "unknown"),
        { lat: 37.5, lng: 127 }
      )
      .restaurants.slice(0, 6).length,
    6
  );
});
test("guide and editorial lists are never labelled as television appearances", () => {
  const guide = sources.describeRestaurantSource(
    { id: "michelin", name: "미쉐린", type: "michelin" },
    "식당"
  );
  assert.equal(guide.badge, "가이드 수록");
  assert.match(guide.description, /스타 획득은 다르/);
  const editorial = sources.describeRestaurantSource(
    { id: "popular-restaurants", name: "인기맛집", type: "guide" },
    "식당"
  );
  assert.doesNotMatch(editorial.description, /방송|검증|보장/);
  assert.equal(
    sources.describeRestaurantSource(
      { id: "sikgaek-baekban-trip", name: "백반기행", type: "tv_show" },
      "식당"
    ).badge,
    "방송 소개"
  );
});
test("Dudley restaurants retain their creator topic rather than a blog-visit label", () => {
  const source = { id: "the-dudley", name: "더들리", type: "creator" };
  const result = sources.describeRestaurantSource(source, "라연");
  assert.equal(result.name, "더들리");
  assert.equal(result.badge, "소개 식당");
  assert.doesNotMatch(result.description, /블로그 방문|영상에서/);
});
test("native share failure offers fallback, cancellation stays a cancellation", async t => {
  replaceGlobal(t, "navigator", {
    share: async () => {
      throw new DOMException("blocked", "NotAllowedError");
    },
  });
  assert.equal(
    await share.shareNatively({ url: "https://matpick.co.kr" }),
    "unavailable"
  );
  globalThis.navigator.share = async () => {
    throw new DOMException("cancelled", "AbortError");
  };
  assert.equal(
    await share.shareNatively({ url: "https://matpick.co.kr" }),
    "cancelled"
  );
  globalThis.navigator.share = async () => {};
  assert.equal(
    await share.shareNatively({ url: "https://matpick.co.kr" }),
    "shared"
  );
});
test("copy works with async clipboard and selection fallback, and reports both failing", async t => {
  let copied = "";
  replaceGlobal(t, "navigator", {
    clipboard: {
      writeText: async text => {
        copied = text;
      },
    },
  });
  assert.equal(
    await share.copyShareLink("https://matpick.co.kr/restaurant/example"),
    true
  );
  assert.match(copied, /restaurant\/example/);
  globalThis.navigator.clipboard.writeText = async () => {
    throw new Error("denied");
  };
  let removed = false;
  replaceGlobal(t, "HTMLElement", class {});
  replaceGlobal(t, "document", {
    activeElement: null,
    createElement: () => ({
      style: {},
      focus() {},
      select() {},
      remove() {
        removed = true;
      },
    }),
    querySelector: () => null,
    body: { appendChild() {} },
    execCommand: () => true,
  });
  assert.equal(await share.copyShareLink("link"), true);
  assert.ok(removed);
  globalThis.document.execCommand = () => false;
  assert.equal(await share.copyShareLink("link"), false);
});
test("Naver car directions preserve coordinates, names and optional origin", () => {
  const restaurant = point("A & B/식당", 127.1);
  for (const origin of [
    null,
    { lat: 37.51, lng: 127 },
    { lat: NaN, lng: 127 },
  ]) {
    const url = new URL(
      directions.getRestaurantDirectionsUrl(restaurant, origin)
    );
    assert.equal(url.hostname, "map.naver.com");
    assert.equal(url.searchParams.get("pathType"), "0");
    assert.equal(url.searchParams.get("etext"), restaurant.name);
    assert.equal(url.searchParams.get("elat"), "37.5");
    assert.equal(url.searchParams.get("elng"), "127.1");
    assert.equal(
      url.searchParams.has("slat"),
      Boolean(origin && Number.isFinite(origin.lat))
    );
    if (origin && Number.isFinite(origin.lat))
      assert.equal(url.searchParams.get("slat"), "37.51");
  }
});
test("driving durations use milliseconds and invalid metrics never become estimates", () => {
  assert.deepEqual(
    provider.parseDriving({
      code: 0,
      route: { trafast: [{ summary: { duration: 61000, distance: 2100 } }] },
    }),
    {
      status: "ok",
      durationMinutes: 2,
      distanceMeters: 2100,
      provider: "NAVER Maps",
    }
  );
  assert.equal(
    provider.parseDriving({
      code: 0,
      route: { trafast: [{ summary: { duration: -1, distance: 2100 } }] },
    }).status,
    "unavailable"
  );
  assert.equal(
    travel.isValidTravelMode({
      status: "ok",
      durationMinutes: NaN,
      distanceMeters: 10,
      provider: "test",
    }),
    false
  );
  assert.equal(travel.formatTravelTime(125), "2시간 5분");
});
test("missing credentials make no calls; routing uses NAVER only", async () => {
  const origin = { lat: 37.5, lng: 127 },
    destination = point("test", 127.1);
  let calls = 0;
  const result = await provider.getTravelTimes(origin, destination, {}, () => {
    calls++;
    throw new Error("unexpected");
  });
  assert.equal(calls, 0);
  assert.equal(result.driving.status, "not_configured");
  const partial = await provider.getTravelTimes(
    origin,
    destination,
    { id: "test", secret: "test", transitKey: "test" },
    async (url, options) => {
      if (String(url).includes("odsay")) throw new Error("timeout");
      assert.equal(options.headers["x-ncp-apigw-api-key-id"], "test");
      assert.match(String(url), /start=127%2C37.5/);
      return {
        ok: true,
        json: async () => ({
          code: 0,
          route: {
            trafast: [{ summary: { duration: 600000, distance: 5000 } }],
          },
        }),
      };
    }
  );
  assert.equal(partial.driving.durationMinutes, 10);
  assert.equal(partial.transit.status, "not_configured");
});
test("routes endpoint rejects cross-site, invalid or unbounded destinations before upstream work", async () => {
  for (const [body, origin, expected] of [
    [
      { origin: { lat: 37.5, lng: 127 }, restaurantIds: Array(7).fill("x") },
      "https://matpick.co.kr",
      400,
    ],
    [
      { origin: { lat: 0, lng: 0 }, restaurantIds: ["x"] },
      "https://matpick.co.kr",
      400,
    ],
    [{}, "https://other.example", 403],
    ["invalid json", "https://matpick.co.kr", 400],
  ]) {
    const res = {
      code: 0,
      setHeader() {},
      status(code) {
        this.code = code;
        return this;
      },
      json() {},
    };
    await handler(
      { method: "POST", headers: { host: "matpick.co.kr", origin }, body },
      res
    );
    assert.equal(res.code, expected);
  }
});

test("nearby show-more expands beyond six and beyond the initial radius", () => {
  const origin = { lat: 37.5, lng: 127 };
  const input = [
    ...Array.from({ length: 6 }, (_, i) => point(String(i), 127 + i * 0.001)),
    point("next", 127.1),
    point("distant", 128),
    point("closed", 127, { operationState: "closed" }),
  ];
  const first = nearby.findNearbyRecommendations(input, origin, 6);
  const more = nearby.findNearbyRecommendations(input, origin, 12);
  assert.equal(first.restaurants.length, 6);
  assert.equal(first.totalCount, 8);
  assert.equal(more.restaurants.length, 8);
  assert.deepEqual(more.restaurants.slice(0, 6), first.restaurants);
  assert.equal(more.restaurants.at(-1).id, "distant");
  assert.ok(more.radiusMeters > first.radiusMeters);
});
