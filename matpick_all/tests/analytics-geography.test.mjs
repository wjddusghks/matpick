import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const analyticsHandler = require("../../api/analytics/event.js");
const {
  readAnalyticsSummary,
  recordAnalyticsEvent,
} = require("../../api/analytics/_analyticsStore.js");

function response() {
  return {
    code: 0,
    body: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function record(visitorId, platformCountry, bodyCountry = "") {
  const res = response();
  await analyticsHandler(
    {
      method: "POST",
      headers: {
        "x-vercel-forwarded-for": `192.0.2.${Math.floor(Math.random() * 200) + 1}`,
        ...(platformCountry ? { "x-vercel-ip-country": platformCountry } : {}),
      },
      body: {
        type: "page_view",
        path: "/geography-test",
        visitorId,
        sessionId: `session-${visitorId}`,
        countryCode: bodyCountry,
      },
    },
    res
  );
  assert.equal(res.code, 200);
}

test("visitor geography uses the platform country header and keeps unknown separate", async () => {
  const storageKeys = [
    "VERCEL",
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ];
  const previous = storageKeys.map(key => process.env[key]);
  storageKeys.forEach(key => delete process.env[key]);
  process.env.VERCEL = "1";

  try {
    const run = `${Date.now()}-${Math.random()}`;
    const before = await readAnalyticsSummary({ scope: "all" });

    await record(`geo-kr-${run}`, "kr");
    await record(`geo-us-${run}`, "US");
    await record(`geo-unknown-${run}`, "", "KR");
    await record(`geo-invalid-${run}`, "XX", "KR");
    process.env.VERCEL = "0";
    await record(`geo-untrusted-header-${run}`, "KR");
    process.env.VERCEL = "1";
    await record(`geo-kr-${run}`, "US");

    const after = await readAnalyticsSummary({ scope: "all" });
    assert.equal(
      after.visitorGeography.domestic - before.visitorGeography.domestic,
      1
    );
    assert.equal(
      after.visitorGeography.foreign - before.visitorGeography.foreign,
      1
    );
    assert.equal(
      after.visitorGeography.unknown - before.visitorGeography.unknown,
      3
    );
    assert.equal(
      after.visitorGeography.tracked - before.visitorGeography.tracked,
      5
    );
    assert.equal(
      after.topCountries.find(entry => entry.label === "KR")?.count,
      (before.topCountries.find(entry => entry.label === "KR")?.count || 0) + 1
    );
    assert.equal(
      after.topCountries.find(entry => entry.label === "US")?.count,
      (before.topCountries.find(entry => entry.label === "US")?.count || 0) + 1
    );
  } finally {
    storageKeys.forEach((key, index) =>
      previous[index] === undefined
        ? delete process.env[key]
        : (process.env[key] = previous[index])
    );
  }
});

test("pre-existing visitors remain explicitly unclassified", async () => {
  const store = globalThis.__MATPICK_ANALYTICS_STORE__;
  const all = store.get("all");
  const marker = `legacy-${Date.now()}-${Math.random()}`;
  all.visitors.add(marker);

  try {
    const summary = await readAnalyticsSummary({ scope: "all" });
    assert.ok(summary.visitorGeography.historicalUnclassified >= 1);
    assert.equal(
      summary.visitorGeography.tracked +
        summary.visitorGeography.historicalUnclassified,
      summary.counts.visitors
    );
  } finally {
    all.visitors.delete(marker);
  }
});

test("Redis assigns visitor geography atomically and reads coverage", async () => {
  const oldFetch = globalThis.fetch;
  const previousUrl = process.env.KV_REST_API_URL;
  const previousToken = process.env.KV_REST_API_TOKEN;
  process.env.KV_REST_API_URL = "https://redis.example.test";
  process.env.KV_REST_API_TOKEN = "test-only";
  const commands = [];

  globalThis.fetch = async url => {
    const command = new URL(url).pathname
      .slice(1)
      .split("/")
      .map(decodeURIComponent);
    commands.push(command);
    let result = 1;
    if (command[0] === "SCARD" && command[1].endsWith(":visitors")) {
      result = 5;
    } else if (command[0] === "SCARD") {
      result = 0;
    } else if (command[0] === "HGETALL" && command[1].endsWith(":geography")) {
      result = ["domestic", "2", "foreign", "1", "unknown", "1"];
    } else if (command[0] === "HGETALL" && command[1].endsWith(":countries")) {
      result = ["KR", "2", "US", "1"];
    } else if (command[0] === "HGETALL") {
      result = [];
    }
    return { ok: true, json: async () => ({ result }) };
  };

  try {
    await recordAnalyticsEvent(
      {
        type: "page_view",
        visitorId: "redis-geography-test",
        path: "/",
      },
      { countryCode: "US" }
    );
    const visitorCommands = commands.filter(
      command => command[0] === "EVAL" && command[4]?.endsWith(":geography")
    );
    assert.equal(visitorCommands.length, 2);
    assert.ok(
      visitorCommands.every(
        command =>
          command[5]?.endsWith(":countries") &&
          command.at(-2) === "foreign" &&
          command.at(-1) === "US"
      )
    );

    const summary = await readAnalyticsSummary({ scope: "all" });
    assert.deepEqual(summary.visitorGeography, {
      tracked: 4,
      domestic: 2,
      foreign: 1,
      unknown: 1,
      historicalUnclassified: 1,
    });
    assert.deepEqual(summary.topCountries, [
      { label: "KR", count: 2 },
      { label: "US", count: 1 },
    ]);
  } finally {
    globalThis.fetch = oldFetch;
    previousUrl === undefined
      ? delete process.env.KV_REST_API_URL
      : (process.env.KV_REST_API_URL = previousUrl);
    previousToken === undefined
      ? delete process.env.KV_REST_API_TOKEN
      : (process.env.KV_REST_API_TOKEN = previousToken);
  }
});
