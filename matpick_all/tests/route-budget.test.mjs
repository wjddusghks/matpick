import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadAppModules } from "../scripts/load-public-data.mjs";
const require = createRequire(import.meta.url);
const budget = require("../../api/routes/_budget.js");
const handler = require("../../api/routes/index.js");
const catalog = require("../client/src/data/generated/public-dataset.json");
const [{ createRouteClient }] = await loadAppModules([
  "/src/lib/routeClient.ts",
]);
const origin = { lat: 37.5, lng: 127 };
const restaurant = catalog.restaurants.find(
  r =>
    r.lat > 33 &&
    r.lat < 39 &&
    r.lng > 124 &&
    r.lng < 132 &&
    !r.recommendationHold &&
    !r.isOverseas &&
    !["closed", "moved", "temporarily_closed"].includes(r.operationState) &&
    !/폐업|이전|휴업/.test(r.operationStatus || "")
);
const driving = {
  status: "ok",
  distanceMeters: 5000,
  durationMinutes: 15,
  provider: "NAVER Maps",
};
function env(t, values = {}) {
  const names = [
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "ROUTE_DAILY_REQUEST_LIMIT",
    "ROUTE_MONTHLY_REQUEST_LIMIT",
    "NAVER_MAP_API_KEY_ID",
    "NAVER_MAP_API_KEY",
  ];
  const old = Object.fromEntries(names.map(k => [k, process.env[k]]));
  for (const k of names) {
    if (values[k] === undefined) delete process.env[k];
    else process.env[k] = values[k];
  }
  t.after(() => {
    for (const k of names) {
      if (old[k] === undefined) delete process.env[k];
      else process.env[k] = old[k];
    }
  });
}
const store = {
  KV_REST_API_URL: "https://redis.test",
  KV_REST_API_TOKEN: "test",
  NAVER_MAP_API_KEY_ID: "test",
  NAVER_MAP_API_KEY: "test",
};
const json = result => ({ ok: true, json: async () => ({ result }) });
function response() {
  return {
    code: 0,
    body: null,
    setHeader() {},
    status(n) {
      this.code = n;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
}
const request = (ids = [restaurant.id], ip = "test") => ({
  method: "POST",
  headers: {
    host: "matpick.co.kr",
    origin: "https://matpick.co.kr",
    "x-forwarded-for": ip,
  },
  body: { origin, restaurantIds: ids },
});
test("route client makes no automatic calls and coalesces clicks, then expires its cache", async () => {
  let calls = 0,
    clock = 0,
    finish;
  const client = createRouteClient(
    async (_url, options) => {
      calls++;
      assert.deepEqual(JSON.parse(options.body).restaurantIds, ["one"]);
      await new Promise(resolve => (finish = resolve));
      return {
        ok: true,
        json: async () => ({ routes: [{ restaurantId: "one", driving }] }),
      };
    },
    () => clock
  );
  assert.equal(calls, 0);
  const first = client.request(origin, "one"),
    second = client.request(origin, "one");
  assert.equal(first, second);
  assert.equal(calls, 1);
  finish();
  assert.deepEqual((await first).driving, driving);
  await client.request(origin, "one");
  assert.equal(calls, 1);
  clock = 300001;
  const next = client.request(origin, "one");
  assert.equal(calls, 2);
  finish();
  await next;
});
test("failed explicit lookup is cached briefly and never retries itself", async () => {
  let calls = 0,
    clock = 0;
  const client = createRouteClient(
    async () => {
      calls++;
      throw new Error("offline");
    },
    () => clock
  );
  assert.equal(
    (await client.request(origin, "one")).driving.status,
    "unavailable"
  );
  await client.request(origin, "one");
  assert.equal(calls, 1);
  clock = 30001;
  await client.request(origin, "one");
  assert.equal(calls, 2);
});
test("budget uses Korea calendar boundaries and rejects invalid or expanded limits", () => {
  assert.deepEqual(budget.keys(new Date("2026-09-30T15:00:00Z")), [
    "matpick:route-budget:day:2026-10-01",
    "matpick:route-budget:month:2026-10",
  ]);
  assert.equal(budget.limit("300", 100), 100);
  assert.equal(budget.limit("0", 100), 0);
  for (const value of ["NaN", "-1", "1.5"])
    assert.throws(() => budget.limit(value, 100));
});
test("one atomic admission checks both ceilings; store errors fail closed", async t => {
  env(t, {
    ...store,
    ROUTE_DAILY_REQUEST_LIMIT: "300",
    ROUTE_MONTHLY_REQUEST_LIMIT: "2000",
  });
  assert.equal(
    await budget.reserveRouteCall(async (_url, options) => {
      const command = JSON.parse(options.body);
      assert.equal(command[0], "EVAL");
      assert.equal(command[2], 2);
      assert.deepEqual(command.slice(-2), [100, 1000]);
      return json(1);
    }),
    true
  );
  assert.equal(await budget.reserveRouteCall(async () => json(0)), false);
  await assert.rejects(
    budget.reserveRouteCall(async () => ({
      ok: true,
      json: async () => ({ error: "store error" }),
    }))
  );
  await assert.rejects(budget.reserveRouteCall(async () => json("1")));
});
test("endpoint rejects multi-restaurant requests and missing shared budget without provider calls", async t => {
  env(t, { NAVER_MAP_API_KEY_ID: "test", NAVER_MAP_API_KEY: "test" });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    throw new Error("unexpected network");
  });
  const batch = response();
  await handler(request([restaurant.id, restaurant.id]), batch);
  assert.equal(batch.code, 400);
  const missing = response();
  await handler(request(undefined, "missing-store"), missing);
  assert.equal(missing.code, 503);
  assert.equal(calls, 0);
});
test("endpoint reuses cache and cannot call provider after global admission is denied", async t => {
  env(t, store);
  let providerCalls = 0,
    admissions = 0,
    cached = null,
    allow = true;
  t.mock.method(globalThis, "fetch", async (url, options = {}) => {
    if (String(url).startsWith("https://maps.apigw.ntruss.com/")) {
      providerCalls++;
      return {
        ok: true,
        json: async () => ({
          code: 0,
          route: {
            trafast: [{ summary: { duration: 900000, distance: 5000 } }],
          },
        }),
      };
    }
    assert.ok(String(url).startsWith("https://redis.test"));
    if (!options.body) return json(1); // existing per-IP limiter
    const cmd = JSON.parse(options.body);
    if (cmd[0] === "GET") return json(cached);
    if (cmd[0] === "EVAL") {
      admissions++;
      return json(allow ? 1 : 0);
    }
    if (cmd[0] === "SET") {
      cached = cmd[2];
      return json("OK");
    }
    throw new Error("Unexpected Redis command");
  });
  const first = response();
  await handler(request(), first);
  assert.equal(first.code, 200);
  assert.equal(providerCalls, 1);
  const second = response();
  await handler(request(), second);
  assert.equal(second.code, 200);
  assert.equal(providerCalls, 1);
  assert.equal(admissions, 1);
  cached = null;
  allow = false;
  const blocked = response();
  await handler(request(), blocked);
  assert.equal(blocked.code, 429);
  assert.equal(providerCalls, 1);
});
test("malformed or stale shared cache never becomes a current route estimate", async t => {
  env(t, store);
  for (const value of [
    { driving, checkedAt: Date.now() - 301000 },
    { driving, checkedAt: Date.now() + 60000 },
    { driving: { ...driving, distanceMeters: -1 }, checkedAt: Date.now() },
    "not-json",
  ]) {
    assert.equal(
      await budget.readRouteCache(origin, restaurant, async () =>
        json(typeof value === "string" ? value : JSON.stringify(value))
      ),
      null
    );
  }
});
