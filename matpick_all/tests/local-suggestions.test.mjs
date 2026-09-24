import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import {
  createLocalSuggestionStore,
  localSuggestionsPlugin,
} from "../scripts/local-suggestions.mjs";
import { loadAppModules } from "../scripts/load-public-data.mjs";
const require = createRequire(import.meta.url);
const {
  createSuggestionHandler,
} = require("../../api/restaurants/_suggestions.js");
const previousMapKey = process.env.VITE_NAVER_MAP_KEY_ID;
process.env.VITE_NAVER_MAP_KEY_ID = "local-address-test-key";
const [address, client] = await loadAppModules([
  "/src/lib/addressSearch.ts",
  "/src/lib/restaurantSuggestions.ts",
]);
if (previousMapKey === undefined) delete process.env.VITE_NAVER_MAP_KEY_ID;
else process.env.VITE_NAVER_MAP_KEY_ID = previousMapKey;

test("repeated address searches reuse a result and simultaneous requests make only one lookup", async () => {
  const oldWindow = globalThis.window;
  const oldNaver = globalThis.naver;
  let calls = 0;
  const maps = {
    Map: function () {},
    Service: {
      Status: { OK: "OK" },
      geocode(_options, callback) {
        calls++;
        queueMicrotask(() =>
          callback("OK", {
            v2: {
              addresses: [
                {
                  roadAddress: "서울 중구 세종대로 110",
                  jibunAddress: "서울 중구 태평로1가 31",
                },
              ],
            },
          })
        );
      },
    },
  };
  globalThis.naver = { maps };
  globalThis.window = {
    naver: globalThis.naver,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };
  try {
    await assert.rejects(address.searchAddresses(" "));
    const query = "서울 중구 세종대로 110";
    const [first, second] = await Promise.all([
      address.searchAddresses(query),
      address.searchAddresses(query),
    ]);
    assert.deepEqual(first, second);
    assert.deepEqual(await address.searchAddresses(`  ${query}  `), first);
    assert.equal(calls, 1);
  } finally {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
    if (oldNaver === undefined) delete globalThis.naver;
    else globalThis.naver = oldNaver;
  }
});

test("local receipt survives reopening the store, retries don't duplicate, and detail is preserved", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "matpick-suggestions-"));
  try {
    const file = path.join(dir, "inbox.json");
    const store = createLocalSuggestionStore(file);
    const input = store.validateSuggestion({
      ...client.newSuggestion(),
      name: "[테스트] 식당",
      location: "서울 중구 세종대로 110",
      locationDetail: "2층",
      consent: true,
    });
    const [receipt, retry] = await Promise.all([
      store.saveSuggestion(input),
      store.saveSuggestion(input),
    ]);
    assert.deepEqual(receipt, retry);
    assert.equal(receipt.storage, "local");
    const reopened = createLocalSuggestionStore(file);
    const inbox = await reopened.listSuggestions();
    assert.equal(inbox.total, 1);
    assert.equal(inbox.items[0].locationDetail, "2층");
    assert.equal(inbox.items[0].fingerprint, undefined);
    await assert.rejects(reopened.saveSuggestion({ ...input, name: "변경" }), {
      status: 409,
    });
    await reopened.updateSuggestion(input.requestId, "reviewed");
    assert.equal(
      (await reopened.listSuggestions()).items[0].status,
      "reviewed"
    );
    const rows = JSON.parse(await readFile(file, "utf8"));
    rows[0].createdAt = Date.now() - 181 * 86400000;
    await writeFile(file, JSON.stringify(rows));
    assert.equal((await reopened.listSuggestions()).total, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("API refuses to acknowledge disk errors; dev handler retains origin and admin guards", async () => {
  const store = {
    ...createLocalSuggestionStore("unused"),
    saveSuggestion: async () => {
      throw new Error("disk failure");
    },
  };
  const handler = createSuggestionHandler(store);
  for (const [method, origin, expected] of [
    ["POST", "http://localhost:3000", 503],
    ["POST", "https://evil.test", 403],
    ["GET", "http://localhost:3000", 403],
  ]) {
    const res = {
      statusCode: 200,
      setHeader() {},
      status(n) {
        this.statusCode = n;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    await handler(
      {
        method,
        headers: {
          host: "localhost:3000",
          origin,
          "x-forwarded-proto": "http",
          "x-forwarded-for": randomUUID(),
        },
        body: {
          ...client.newSuggestion(),
          name: "식당",
          location: "서울",
          consent: true,
        },
      },
      res
    );
    assert.equal(res.statusCode, expected);
    assert.notEqual(res.body?.ok, true);
  }
  const denied = localSuggestionsPlugin().config({}).server.fs.deny;
  assert.ok(denied.includes("**/.local-data/**"));
  assert.ok(denied.includes(".env.*"));
});

test("address results retain road and lot values, reject empty rows and duplicates; legacy drafts are retained", () => {
  const result = {
    address: "기본주소",
    roadAddress: "서울 중구 세종대로 110",
    jibunAddress: "서울 중구 태평로1가 31",
    userSelectedType: "R",
  };
  assert.deepEqual(
    address.normalizeAddressResults([result, result, {}, null]),
    [{ roadAddress: result.roadAddress, jibunAddress: result.jibunAddress }]
  );
  assert.deepEqual(
    address.normalizeAddressResults([{ jibunAddress: result.jibunAddress }]),
    [{ roadAddress: "", jibunAddress: result.jibunAddress }]
  );
  const previous = globalThis.sessionStorage;
  const draft = client.newSuggestion();
  draft.name = "작성 중인 식당";
  delete draft.locationDetail;
  globalThis.sessionStorage = {
    getItem: () => JSON.stringify({ draft, step: 2, savedAt: Date.now() }),
  };
  try {
    assert.equal(client.readSuggestionDraft().draft.name, draft.name);
  } finally {
    if (previous === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = previous;
  }
});
