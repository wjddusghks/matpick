import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  getKoreaDay,
  readVisitorHistory,
} = require("../../api/analytics/_analyticsStore.js");
const metricsHandler = require("../../api/admin/metrics.js");
const { createSession } = require("../../api/auth/_sessionStore.js");

const STORAGE_ENV = [
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

function response() {
  return {
    code: 200,
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

function bucket({
  visitors = [],
  geography = {},
  countries = {},
  pageViews = 0,
}) {
  return {
    visitors: new Set(visitors),
    geography: new Map(Object.entries(geography)),
    countries: new Map(Object.entries(countries)),
    counts: new Map(pageViews ? [["pageViews", pageViews]] : []),
  };
}

function saveEnvironment(names) {
  return Object.fromEntries(names.map(name => [name, process.env[name]]));
}

function restoreEnvironment(saved) {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

test("memory history preserves missing days and aggregates daily visitors by weekday", async () => {
  const savedEnv = saveEnvironment(STORAGE_ENV);
  STORAGE_ENV.forEach(name => delete process.env[name]);
  const store = globalThis.__MATPICK_ANALYTICS_STORE__;
  const replacements = new Map();
  const setDay = (day, value) => {
    replacements.set(day, store.has(day) ? store.get(day) : undefined);
    store.set(day, value);
  };

  setDay(
    "2026-09-28",
    bucket({
      visitors: ["visitor-a", "visitor-a", "visitor-b"],
      geography: { domestic: 1, unknown: 1 },
      countries: { KR: 1 },
    })
  );
  setDay(
    "2026-09-29",
    bucket({
      visitors: ["visitor-a", "visitor-c", "visitor-d"],
      geography: { domestic: 1, foreign: 1 },
      countries: { KR: 1, US: 1 },
    })
  );
  setDay("2026-09-30", bucket({ pageViews: 1 }));
  setDay(
    "2026-10-04",
    bucket({
      visitors: ["visitor-e"],
      geography: { unknown: 1 },
    })
  );

  const sizeBeforeRead = store.size;
  try {
    const history = await readVisitorHistory({
      days: 7,
      endDay: "2026-10-04",
    });

    assert.equal(
      store.size,
      sizeBeforeRead,
      "reads must not create missing buckets"
    );
    assert.equal(history.startDay, "2026-09-28");
    assert.equal(history.endDay, "2026-10-04");
    assert.equal(history.timeZone, "Asia/Seoul");
    assert.equal(history.storage, "memory");
    assert.deepEqual(
      history.weekdays.map(row => row.weekday),
      [1, 2, 3, 4, 5, 6, 0]
    );
    assert.ok(history.weekdays.every(row => row.days === 1));
    assert.equal(history.totalDailyVisitors, 6);

    assert.deepEqual(history.days[0], {
      day: "2026-09-28",
      weekday: 1,
      visitors: 2,
      countries: [{ label: "KR", count: 1 }],
      unknown: 1,
      historicalUnclassified: 0,
      hasData: true,
    });
    assert.equal(history.days[2].hasData, true);
    assert.equal(history.days[2].visitors, 0);
    assert.equal(history.days[3].hasData, false);
    assert.equal(history.days[3].visitors, 0);
    assert.equal(history.days[1].historicalUnclassified, 1);
    assert.deepEqual(history.countries, [
      { label: "KR", count: 2 },
      { label: "US", count: 1 },
    ]);
    assert.deepEqual(history.weekdays[0].countries, [
      { label: "KR", count: 1 },
    ]);
    assert.equal(history.weekdays[1].visitors, 3);
    assert.equal(history.weekdays[1].historicalUnclassified, 1);
    assert.equal(history.weekdays[6].unknown, 1);

    const fourWeeks = await readVisitorHistory({
      days: 28,
      endDay: "2026-10-04",
    });
    assert.equal(fourWeeks.days.length, 28);
    assert.ok(fourWeeks.weekdays.every(row => row.days === 4));
    assert.equal(store.size, sizeBeforeRead);
  } finally {
    for (const [day, previous] of replacements) {
      if (previous === undefined) store.delete(day);
      else store.set(day, previous);
    }
    restoreEnvironment(savedEnv);
  }
});

test("history validates calendar inputs and Korea day rollover", async () => {
  assert.equal(getKoreaDay(Date.UTC(2026, 9, 10, 14, 59, 59)), "2026-10-10");
  assert.equal(getKoreaDay(Date.UTC(2026, 9, 10, 15, 0, 0)), "2026-10-11");
  await assert.rejects(() => readVisitorHistory({}), /exactly 7 or 28/);
  await assert.rejects(
    () => readVisitorHistory({ days: "7" }),
    /exactly 7 or 28/
  );
  await assert.rejects(
    () => readVisitorHistory({ days: 8 }),
    /exactly 7 or 28/
  );
  await assert.rejects(
    () => readVisitorHistory({ days: 7, endDay: "2026-02-29" }),
    /valid calendar date/
  );
  await assert.rejects(
    () => readVisitorHistory({ days: 7, endDay: "10-10-2026" }),
    /YYYY-MM-DD/
  );
  await assert.rejects(
    () => readVisitorHistory({ days: 7, endDay: "9999-12-31" }),
    /future/
  );
});

test("KV history uses one bounded pipeline and keeps every country", async () => {
  const savedEnv = saveEnvironment(STORAGE_ENV);
  process.env.KV_REST_API_URL = "https://redis-history.test";
  process.env.KV_REST_API_TOKEN = "test-only";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const oldFetch = globalThis.fetch;
  const calls = [];
  const countryPairs = [
    "KR",
    "US",
    "JP",
    "CN",
    "GB",
    "FR",
    "DE",
    "CA",
    "AU",
    "SG",
  ]
    .map((country, index) => [country, String(index + 1)])
    .flat();

  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    const commands = JSON.parse(options.body);
    const payload = commands.map(command => {
      const key = command[1] || "";
      const day = key.match(/:day:(\d{4}-\d{2}-\d{2}):/)?.[1];
      if (command[0] === "EXISTS") {
        return { result: day === "2026-09-28" || day === "2026-09-30" ? 1 : 0 };
      }
      if (command[0] === "SCARD") {
        return { result: day === "2026-09-28" ? 8 : 0 };
      }
      if (command[0] === "HGETALL" && key.endsWith(":geography")) {
        return {
          result:
            day === "2026-09-28"
              ? ["domestic", "3", "foreign", "2", "unknown", "1"]
              : [],
        };
      }
      if (command[0] === "HGETALL" && key.endsWith(":countries")) {
        return { result: day === "2026-09-28" ? countryPairs : [] };
      }
      throw new Error(`Unexpected command: ${command.join(" ")}`);
    });
    return { ok: true, json: async () => payload };
  };

  try {
    const history = await readVisitorHistory({
      days: 7,
      endDay: "2026-10-04",
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://redis-history.test/pipeline");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(JSON.parse(calls[0].options.body).length, 28);
    assert.equal(history.storage, "kv");
    assert.equal(history.days[0].visitors, 8);
    assert.equal(history.days[0].unknown, 1);
    assert.equal(history.days[0].historicalUnclassified, 2);
    assert.equal(history.days[2].hasData, true);
    assert.equal(history.days[3].hasData, false);
    assert.equal(history.countries.length, 10);
    assert.deepEqual(history.countries[0], { label: "SG", count: 10 });
  } finally {
    globalThis.fetch = oldFetch;
    restoreEnvironment(savedEnv);
  }
});

test("admin visitor history retains request guards and rejects invalid periods", async () => {
  const envNames = [
    ...STORAGE_ENV,
    "ADMIN_USER_IDS",
    "AUTH_PROFILE_SIGNING_SECRET",
  ];
  const savedEnv = saveEnvironment(envNames);
  envNames.forEach(name => delete process.env[name]);
  process.env.ADMIN_USER_IDS = "naver:history-admin";
  process.env.KV_REST_API_URL = "https://session.test";
  process.env.KV_REST_API_TOKEN = "test";
  const oldFetch = globalThis.fetch;
  const values = new Map();
  globalThis.fetch = async (url, options) => {
    const command = JSON.parse(options.body);
    if (url.endsWith("/pipeline")) {
      return { ok: true, json: async () => command.map(() => ({ result: 0 })) };
    }
    if (command[0] === "SET") values.set(command[1], command[2]);
    const result =
      command[0] === "GET"
        ? (values.get(command[1]) ?? null)
        : command[0] === "EVAL"
          ? 1
          : "OK";
    return { ok: true, json: async () => ({ result }) };
  };

  const call = async ({ query = {}, headers = {}, method = "GET" } = {}) => {
    const res = response();
    await metricsHandler(
      {
        method,
        query: { view: "visitors", ...query },
        headers: { "x-vercel-forwarded-for": "192.0.2.44", ...headers },
      },
      res
    );
    return res;
  };

  try {
    assert.equal((await call()).code, 403);
    const sessionResponse = response();
    sessionResponse.getHeader = name => sessionResponse.headers[name];
    await createSession({ headers: {} }, sessionResponse, {
      id: "history-admin",
      provider: "naver",
      name: "Admin",
    });
    const headers = {
      cookie: sessionResponse.headers["Set-Cookie"][0].split(";")[0],
    };
    assert.equal(
      (
        await call({
          headers: {
            ...headers,
            origin: "https://evil.invalid",
            host: "matpick.co.kr",
          },
        })
      ).code,
      403
    );
    const invalid = await call({ query: { days: "14" }, headers });
    assert.equal(invalid.code, 400);
    assert.match(invalid.body.error, /7 or 28/);

    const valid = await call({ query: { days: "7" }, headers });
    assert.equal(valid.code, 200);
    assert.equal(valid.body.history.days.length, 7);
    assert.equal(valid.body.history.weekdays.length, 7);
    assert.equal(valid.body.summary, undefined);
    assert.equal(valid.headers["Cache-Control"], "no-store");
  } finally {
    globalThis.fetch = oldFetch;
    restoreEnvironment(savedEnv);
  }
});
