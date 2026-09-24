import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { loadAppModules } from "../scripts/load-public-data.mjs";
const require = createRequire(import.meta.url);
const {
  validateSuggestion,
  saveSuggestion,
  listSuggestions,
  updateSuggestion,
} = require("../../api/restaurants/_suggestionStore.js");
const handler = require("../../api/restaurants/index.js");
const { createProfileSyncToken } = require("../../api/auth/_profileStore.js");
const [client] = await loadAppModules(["/src/lib/restaurantSuggestions.ts"]);
const base = () => ({
  requestId: randomUUID(),
  name: "테스트 국밥",
  location: "부산 해운대구 중동",
  menus: [],
  consent: true,
});
const envKeys = [
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "ADMIN_USER_IDS",
  "VITE_ADMIN_USER_IDS",
  "AUTH_PROFILE_SIGNING_SECRET",
];

function response() {
  return {
    code: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
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
async function sandbox(run, storage = false) {
  const old = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  const oldFetch = globalThis.fetch;
  envKeys.forEach(key => delete process.env[key]);
  if (storage) {
    process.env.KV_REST_API_URL = "https://suggestion-store.test";
    process.env.KV_REST_API_TOKEN = "test-only-token";
  }
  try {
    await run();
  } finally {
    globalThis.fetch = oldFetch;
    envKeys.forEach(key => {
      if (old[key] === undefined) delete process.env[key];
      else process.env[key] = old[key];
    });
  }
}

test("only restaurant identity and consent are required; unknown prices stay unknown", () => {
  const input = base();
  const result = validateSuggestion({
    ...input,
    menus: [
      { name: "밀면", price: "", unit: "1인분" },
      { name: "국밥", price: "10,000" },
    ],
  });
  assert.equal(result.menus[0].price, null);
  assert.equal(result.menus[1].price, 10000);
  assert.equal(validateSuggestion(input).menus.length, 0);
  assert.equal(
    validateSuggestion({ ...input, menus: [{ name: "물", price: "0" }] })
      .menus[0].price,
    0
  );
  assert.equal(result.name, input.name);
});
test("invalid identity, consent, links, price, date and spam fail server validation", () => {
  for (const patch of [
    { name: " " },
    { location: "" },
    { consent: false },
    { requestId: "-".repeat(36) },
    { requestId: [randomUUID()] },
    { name: "x".repeat(101) },
    { mapUrl: "javascript:alert(1)" },
    { mapUrl: "https://user:pass@example.com" },
    { menus: [{ name: "", price: "12000" }] },
    { menus: [{ name: "국밥", price: "-1" }] },
    { menus: [{ name: "국밥", price: "1.5" }] },
    { menus: [{ name: "국밥", price: "10000001" }] },
    { menus: Array(9).fill({ name: "국밥" }) },
    { checkedAt: "2026-02-30" },
    { checkedAt: "2099-01-01" },
    { tags: ["forged"] },
    { website: "bot" },
    { reason: "x".repeat(1001) },
  ])
    assert.throws(() => validateSuggestion({ ...base(), ...patch }), {
      status: 400,
    });
});
test("submitters cannot set moderation state, timestamps or admin identity", () => {
  const result = validateSuggestion({
    ...base(),
    status: "reviewed",
    id: "forged",
    createdAt: 1,
    email: "unneeded@example.com",
    userId: "admin",
  });
  for (const key of ["status", "id", "createdAt", "email", "userId"])
    assert.equal(key in result, false);
});
test("missing durable storage never acknowledges receipt", async () =>
  sandbox(async () => {
    await assert.rejects(saveSuggestion(validateSuggestion(base())), {
      status: 503,
    });
    const res = response();
    await handler(
      {
        method: "POST",
        query: { scope: "suggestions" },
        headers: {},
        body: base(),
      },
      res
    );
    assert.equal(res.code, 503);
    assert.equal(res.body.ok, undefined);
  }));
test("inbox and moderation require signed allowlisted administrator, not just a key", async () =>
  sandbox(async () => {
    process.env.ADMIN_USER_IDS = "naver:test-admin";
    for (const method of ["GET", "PATCH"]) {
      const res = response();
      await handler(
        {
          method,
          query: { scope: "suggestions" },
          headers: { "x-matpick-admin-key": "naver:test-admin" },
          body: {},
        },
        res
      );
      assert.equal(res.code, 403);
    }
  }));
test("cross-origin writes, malformed JSON and large bodies are rejected", async () =>
  sandbox(async () => {
    for (const [body, headers, status] of [
      [base(), { origin: "https://evil.test", host: "matpick.co.kr" }, 403],
      ["{", {}, 400],
      ["x".repeat(25000), {}, 413],
    ]) {
      const res = response();
      await handler(
        {
          method: "POST",
          query: { scope: "suggestions" },
          headers: { ...headers, "x-forwarded-for": randomUUID() },
          body,
        },
        res
      );
      assert.equal(res.code, status);
    }
  }));
test("anonymous submissions are rate limited", async () =>
  sandbox(async () => {
    const headers = { "x-forwarded-for": randomUUID() };
    for (let i = 0; i < 7; i++) {
      const res = response();
      await handler(
        {
          method: "POST",
          query: { scope: "suggestions" },
          headers,
          body: { ...base(), name: "" },
        },
        res
      );
      assert.equal(res.code, i < 6 ? 400 : 429);
    }
  }));
test("atomic write uses retention and stable request ID, retries reuse receipt", async () =>
  sandbox(async () => {
    let stored;
    globalThis.fetch = async (_url, options) => {
      const command = JSON.parse(options.body);
      assert.equal(command[0], "EVAL");
      assert.equal(command[2], 2);
      assert.match(command[1], /ZADD/);
      assert.equal(command.at(-1), 180 * 86400);
      stored ||= command[5];
      return { ok: true, json: async () => ({ result: stored }) };
    };
    const input = validateSuggestion(base());
    const first = await saveSuggestion(input);
    assert.deepEqual(await saveSuggestion(input), first);
    assert.equal(first.status, "pending");
    assert.ok(first.id);
    assert.deepEqual(Object.keys(first).sort(), ["createdAt", "id", "status"]);
    await assert.rejects(saveSuggestion({ ...input, name: "다른 식당" }), {
      status: 409,
    });
  }, true));
test("storage errors and unacknowledged writes never report success", async () =>
  sandbox(async () => {
    for (const value of [{ error: "backend rejected" }, { result: null }]) {
      globalThis.fetch = async () => ({ ok: true, json: async () => value });
      await assert.rejects(saveSuggestion(validateSuggestion(base())), {
        status: 503,
      });
    }
  }, true));
test("admin inbox paginates and preserves empty menu/tag arrays after Lua updates", async () =>
  sandbox(async () => {
    const commands = [];
    globalThis.fetch = async (_url, options) => {
      const command = JSON.parse(options.body);
      commands.push(command);
      const result = {
        ZREMRANGEBYSCORE: 0,
        ZREVRANGE: ["key"],
        MGET: [
          JSON.stringify({
            id: "one",
            menus: {},
            tags: {},
            fingerprint: "private",
          }),
        ],
        ZCARD: 51,
      }[command[0]];
      return { ok: true, json: async () => ({ result }) };
    };
    const result = await listSuggestions(1);
    assert.equal(result.total, 51);
    assert.deepEqual(result.items[0].menus, []);
    assert.deepEqual(result.items[0].tags, []);
    assert.equal(result.items[0].fingerprint, undefined);
    assert.deepEqual(
      commands.find(command => command[0] === "ZREVRANGE").slice(-2),
      [50, 99]
    );
  }, true));
test("moderation preserves original expiry and a missing record cannot be updated", async () =>
  sandbox(async () => {
    globalThis.fetch = async (_url, options) => {
      const command = JSON.parse(options.body);
      assert.match(command[1], /KEEPTTL/);
      return { ok: true, json: async () => ({ result: 0 }) };
    };
    await assert.rejects(updateSuggestion(randomUUID(), "reviewed"), {
      status: 404,
    });
    await assert.rejects(updateSuggestion(randomUUID(), "published"), {
      status: 400,
    });
  }, true));
test("valid administrator can read the inbox through the catalog route", async () =>
  sandbox(async () => {
    process.env.ADMIN_USER_IDS = "naver:test-admin";
    process.env.AUTH_PROFILE_SIGNING_SECRET = "suggestion-test-signing-secret";
    globalThis.fetch = async (_url, options) => {
      const command = options?.body ? JSON.parse(options.body) : [];
      return {
        ok: true,
        json: async () => ({ result: command[0] === "ZREVRANGE" ? [] : 0 }),
      };
    };
    const res = response();
    await handler(
      {
        method: "GET",
        query: { scope: "suggestions" },
        headers: {
          "x-matpick-admin-key": "naver:test-admin",
          "x-matpick-admin-token": createProfileSyncToken("test-admin"),
        },
      },
      res
    );
    assert.equal(res.code, 200);
    assert.deepEqual(res.body.items, []);
  }, true));
test("client validates required fields, partial menus and final consent", () => {
  const draft = client.newSuggestion();
  assert.deepEqual(
    Object.keys(client.validateSuggestionStep(draft, 0, false)),
    ["name", "location"]
  );
  draft.name = "식당";
  draft.location = "부산";
  assert.deepEqual(client.validateSuggestionStep(draft, 0, false), {});
  assert.deepEqual(client.validateSuggestionStep(draft, 1, false), {});
  draft.menus[0].price = "9000";
  assert.ok(client.validateSuggestionStep(draft, 1, false)["menu-0-name"]);
  assert.ok(client.validateSuggestionStep(draft, 2, false).consent);
  assert.deepEqual(client.validateSuggestionStep(draft, 2, true), {});
});
test("draft reload restores progress, while corrupt or expired drafts fail safely", () => {
  const previous = globalThis.sessionStorage;
  const draft = { ...client.newSuggestion(), name: "이어 쓰기" };
  let stored = JSON.stringify({ draft, step: 1, savedAt: Date.now() });
  globalThis.sessionStorage = { getItem: () => stored };
  try {
    assert.equal(client.readSuggestionDraft().draft.name, "이어 쓰기");
    assert.equal(client.readSuggestionDraft().step, 1);
    stored = "{";
    assert.equal(client.readSuggestionDraft().restored, false);
    stored = JSON.stringify({
      draft,
      step: 2,
      savedAt: Date.now() - 8 * 86400000,
    });
    assert.equal(client.readSuggestionDraft().restored, false);
    stored = JSON.stringify({
      draft: { ...draft, menus: [null] },
      savedAt: Date.now(),
    });
    assert.equal(client.readSuggestionDraft().restored, false);
  } finally {
    if (previous === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = previous;
  }
});
