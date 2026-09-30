import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const catalogHandler = require("../../api/restaurants/index.js");

function responseRecorder() {
  return {
    statusCode: 0,
    body: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("catalog autocomplete runs independent limits together and reuses public state", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.KV_REST_API_URL;
  const originalToken = process.env.KV_REST_API_TOKEN;
  process.env.KV_REST_API_URL = "https://catalog-cache.test";
  process.env.KV_REST_API_TOKEN = "test-token";
  catalogHandler.clearCatalogStateCache();

  let activeRateReads = 0;
  let maximumActiveRateReads = 0;
  let rateReads = 0;
  let stateReads = 0;
  globalThis.fetch = async (_url, options = {}) => {
    if (options.method === "POST") {
      stateReads += 1;
      return { ok: true, json: async () => ({ result: [] }) };
    }
    rateReads += 1;
    activeRateReads += 1;
    maximumActiveRateReads = Math.max(maximumActiveRateReads, activeRateReads);
    await new Promise((resolve) => setTimeout(resolve, 10));
    activeRateReads -= 1;
    return { ok: true, json: async () => ({ result: 2 }) };
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.KV_REST_API_URL;
    else process.env.KV_REST_API_URL = originalUrl;
    if (originalToken === undefined) delete process.env.KV_REST_API_TOKEN;
    else process.env.KV_REST_API_TOKEN = originalToken;
    catalogHandler.clearCatalogStateCache();
  });

  const request = {
    method: "GET",
    query: { scope: "catalog", view: "list", type: "search", q: "Busan", limit: "16" },
    headers: { host: "matpick.co.kr", "sec-fetch-site": "same-origin", "x-forwarded-for": "203.0.113.9" },
  };
  const first = responseRecorder();
  const second = responseRecorder();
  await catalogHandler(request, first);
  await catalogHandler(request, second);

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(maximumActiveRateReads, 2, "minute and daily limits should overlap");
  assert.equal(rateReads, 4, "both limits still apply to every request");
  assert.equal(stateReads, 2, "edits and publications should each be read once per cache window");
  assert.ok(first.body.restaurants.length > 0);
});

test("a failed catalog state read is discarded and retried", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.KV_REST_API_URL;
  const originalToken = process.env.KV_REST_API_TOKEN;
  process.env.KV_REST_API_URL = "https://catalog-retry.test";
  process.env.KV_REST_API_TOKEN = "test-token";
  catalogHandler.clearCatalogStateCache();

  let stateReads = 0;
  let rejectNext = true;
  globalThis.fetch = async () => {
    stateReads += 1;
    if (rejectNext) {
      rejectNext = false;
      return { ok: false, json: async () => ({}) };
    }
    return { ok: true, json: async () => ({ result: [] }) };
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.KV_REST_API_URL;
    else process.env.KV_REST_API_URL = originalUrl;
    if (originalToken === undefined) delete process.env.KV_REST_API_TOKEN;
    else process.env.KV_REST_API_TOKEN = originalToken;
    catalogHandler.clearCatalogStateCache();
  });

  await assert.rejects(catalogHandler.readCatalogState());
  assert.deepEqual(await catalogHandler.readCatalogState(), { edits: [], publications: [] });
  assert.equal(stateReads, 4, "both state reads should be retried after a rejected snapshot");
});
