import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAppModules } from "../scripts/load-public-data.mjs";
const require = createRequire(import.meta.url);
const {
  validateChanges,
  saveEdit,
  readEdits,
} = require("../../api/restaurants/_restaurantEdits.js");
const handler = require("../../api/admin/_restaurantAdmin.js");
const publicHandler = require("../../api/restaurants/index.js");
const { createProfileSyncToken } = require("../../api/auth/_profileStore.js");
const dataset = require("../client/src/data/generated/public-dataset.json");
const [client] = await loadAppModules(["/src/lib/restaurantEdits.ts"]);

test("deployment remains within the current twelve-function plan", () => {
  const apiRoot = fileURLToPath(new URL("../../api/", import.meta.url));
  function functionsIn(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
      entry.name.startsWith("_") ? [] : entry.isDirectory() ? functionsIn(path.join(directory, entry.name)) : entry.name.endsWith(".js") ? [entry.name] : []
    );
  }
  assert.ok(functionsIn(apiRoot).length <= 12);
});

test("shared catalog endpoint requires admin authorization for metadata and all writes", async () => {
  for (const request of [{ method: "GET", query: { scope: "admin" } }, { method: "POST", body: {} }]) {
    const res = response();
    await publicHandler({ ...request, headers: {} }, res);
    assert.equal(res.code, 403);
  }
});

function response() {
  return {
    code: 200,
    headers: {},
    body: null,
    setHeader(key, value) {
      this.headers[key] = value;
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

function withEnv(patch, run) {
  return (async () => {
    const previous = Object.fromEntries(
      Object.keys(patch).map(key => [key, process.env[key]])
    );
    for (const [key, value] of Object.entries(patch)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
    try {
      return await run();
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value == null) delete process.env[key];
        else process.env[key] = value;
      }
    }
  })();
}
const noStorage = {
  KV_REST_API_URL: null,
  KV_REST_API_TOKEN: null,
  UPSTASH_REDIS_REST_URL: null,
  UPSTASH_REDIS_REST_TOKEN: null,
};

test("editing menus rebuilds the summary and clearing menus removes stale fallback prices", () => {
  const changes = validateChanges(
    {
      menus: [
        { name: " 국밥 ", price: "12,000원", isSignature: true },
        { name: "수육", price: "" },
      ],
      menuPriceVerifiedAt: "2020-01-01",
      menuPriceSources: [
        { url: "https://example.com/menu", label: "점주 메뉴" },
      ],
    },
    "r_test"
  );
  assert.equal(changes.representativeMenu, "국밥 / 수육");
  assert.equal(changes.menus[1].price, "");
  assert.equal(changes.menuPriceVerifiedAt, "2020-01-01");
  const cleared = validateChanges({ menus: [] }, "r_test");
  assert.deepEqual(cleared.menus, []);
  assert.equal(cleared.representativeMenu, "");
  assert.equal(cleared.detailCollectedAt, "");
  assert.equal(cleared.menuPriceVerifiedAt, "");
});

test("invalid coordinates, fake verification dates, unsafe URLs and uneditable fields are rejected", () => {
  for (const changes of [
    { lat: 91 },
    { lng: 0 },
    { name: " " },
    { menus: [{ name: "" }] },
    { menus: [{ name: "국밥", price: "-100원" }] },
    { menus: Array(101).fill({ name: "국밥" }) },
    { menuPriceVerifiedAt: "2099-01-01" },
    { menuPriceVerifiedAt: "2020-02-30" },
    { menuPriceSources: [{ url: "javascript:alert(1)" }] },
    { menuPriceSources: [{ url: "https://user:password@example.com" }] },
    { id: "other" },
    { rating: 5 },
    { sourceLinks: [] },
    null,
    [],
  ]) {
    assert.throws(() => validateChanges(changes, "r_test"), { status: 400 });
  }
});

test("public overlays preserve original data and restaurant identity; tombstones restore base", () => {
  const base = [
    {
      ...dataset.restaurants[0],
      menus: [{ id: "m", name: "원본 메뉴", price: "9000원" }],
    },
  ];
  const original = JSON.stringify(base);
  const edit = {
    restaurantId: base[0].id,
    changes: { id: "injected", name: "수정 상호", menus: [] },
  };
  const updated = client.applyRestaurantEdits(base, [edit]);
  assert.equal(updated[0].id, base[0].id);
  assert.equal(updated[0].name, "수정 상호");
  assert.deepEqual(updated[0].menus, []);
  assert.equal(JSON.stringify(base), original);
  assert.deepEqual(
    client.applyRestaurantEdits(base, [{ ...edit, changes: {} }]),
    base
  );
});

test("unauthorized and cross-origin admin writes cannot touch storage", async () => {
  const res = response();
  await handler({ method: "POST", headers: {}, body: {} }, res);
  assert.equal(res.code, 403);
  const crossOrigin = response();
  await handler(
    {
      method: "POST",
      headers: { origin: "https://evil.invalid", host: "matpick.co.kr" },
      body: {},
    },
    crossOrigin
  );
  assert.equal(crossOrigin.code, 403);
});

test("a valid admin sees storage availability and cannot save to missing durable storage", async () => {
  await withEnv(
    {
      ...noStorage,
      ADMIN_USER_IDS: "naver:local-test-admin",
      AUTH_PROFILE_SIGNING_SECRET: "local-test-secret-only",
    },
    async () => {
      const headers = {
        "x-matpick-admin-key": "naver:local-test-admin",
        "x-matpick-admin-token": createProfileSyncToken("local-test-admin"),
      };
      const get = response();
      await handler({ method: "GET", headers }, get);
      assert.equal(get.code, 200);
      assert.equal(get.body.configured, false);
      const post = response();
      await handler(
        {
          method: "POST",
          headers,
          body: {
            restaurantId: dataset.restaurants[0].id,
            action: "save",
            expectedRevision: 0,
            changes: { phone: "02-0000-0000" },
          },
        },
        post
      );
      assert.equal(post.code, 503);
      assert.ok(!post.body.ok);
      const unknown = response();
      await handler(
        { method: "POST", headers, body: { restaurantId: "not-registered" } },
        unknown
      );
      assert.equal(unknown.code, 404);
      const invalid = response();
      await handler({ method: "POST", headers, body: "null" }, invalid);
      assert.equal(invalid.code, 400);
      const expired = response();
      await handler(
        {
          method: "POST",
          headers: { ...headers, "x-matpick-admin-token": "invalid" },
          body: {},
        },
        expired
      );
      assert.equal(expired.code, 403);
    }
  );
});

test("durable edit roundtrip uses atomic version checks and separates public edits from operator history", async () => {
  await withEnv(
    {
      ...noStorage,
      KV_REST_API_URL: "https://redis.test.invalid",
      KV_REST_API_TOKEN: "test-only",
    },
    async () => {
      const originalFetch = globalThis.fetch;
      const commands = [];
      let stored;
      let conflict = false;
      globalThis.fetch = async (_url, options) => {
        const command = JSON.parse(options.body);
        commands.push(command);
        let result;
        if (command[0] === "EVAL") {
          assert.match(command[1], /revision ~= tonumber\(ARGV\[2\]\)/);
          assert.match(command[1], /LPUSH/);
          if (conflict) result = 0;
          else {
            stored = command[7];
            result = 1;
          }
        } else if (command[0] === "HGET") {
          result = stored || null;
        } else {
          assert.equal(command[0], "HVALS");
          result = stored ? [stored] : [];
        }
        return { ok: true, json: async () => ({ result }) };
      };
      try {
        const edit = await saveEdit({
          restaurantId: "r_test",
          expectedRevision: 0,
          changes: { name: "저장 식당" },
          actor: "naver:operator",
        });
        assert.equal(edit.revision, 1);
        assert.equal(
          commands.find(command => command[0] === "EVAL")[8],
          "naver:operator"
        );
        assert.deepEqual((await readEdits()).edits, [edit]);
        const publicRes = response();
        await publicHandler({ method: "GET", headers: {} }, publicRes);
        assert.equal(publicRes.code, 200);
        assert.ok(!JSON.stringify(publicRes.body).includes("operator"));
        const patched = await saveEdit({
          restaurantId: "r_test",
          expectedRevision: 1,
          changes: { phone: "02-0000-0000" },
          actor: "naver:operator",
        });
        assert.equal(patched.changes.name, "저장 식당");
        assert.equal(patched.changes.phone, "02-0000-0000");
        conflict = true;
        await assert.rejects(
          saveEdit({
            restaurantId: "r_test",
            expectedRevision: 2,
            changes: {},
            actor: "other",
          }),
          { status: 409 }
        );
        assert.deepEqual((await readEdits()).edits, [patched]);
        conflict = false;
        const reset = await saveEdit({
          restaurantId: "r_test",
          expectedRevision: 2,
          changes: {},
          action: "reset",
          actor: "naver:operator",
        });
        assert.deepEqual(reset.changes, {});
        assert.equal(reset.revision, 3);
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  );
});
