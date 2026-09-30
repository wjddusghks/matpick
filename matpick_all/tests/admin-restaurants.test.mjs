import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAppModules } from "../scripts/load-public-data.mjs";
const require = createRequire(import.meta.url);
const {
  createRestaurant,
  validateChanges,
  validateNewRestaurant,
  saveEdit,
  readEdits,
} = require("../../api/restaurants/_restaurantEdits.js");
const { queryCatalog } = require("../../api/restaurants/_catalog.js");
const handler = require("../../api/admin/_restaurantAdmin.js");
const publicHandler = require("../../api/restaurants/index.js");
const { createProfileSyncToken } = require("../../api/auth/_profileStore.js");
const dataset = require("../client/src/data/generated/public-dataset.json");
const [client, catalogClient] = await loadAppModules([
  "/src/lib/restaurantEdits.ts",
  "/src/lib/adminRestaurantCatalog.ts",
]);

test("deployment remains within the current twelve-function plan", () => {
  const apiRoot = fileURLToPath(new URL("../../api/", import.meta.url));
  function functionsIn(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
      entry.name.startsWith("_")
        ? []
        : entry.isDirectory()
          ? functionsIn(path.join(directory, entry.name))
          : entry.name.endsWith(".js")
            ? [entry.name]
            : []
    );
  }
  assert.ok(functionsIn(apiRoot).length <= 12);
});

test("shared catalog endpoint requires admin authorization for metadata and all writes", async () => {
  for (const request of [
    { method: "GET", query: { scope: "admin" } },
    { method: "POST", body: {} },
  ]) {
    const res = response();
    await publicHandler({ ...request, headers: {} }, res);
    assert.equal(res.code, 403);
  }
});

test("admin catalog sends bounded pages and metadata only on the authenticated first page", async () => {
  await withEnv(
    {
      ...noStorage,
      ADMIN_USER_IDS: "naver:catalog-test-admin",
      AUTH_PROFILE_SIGNING_SECRET: "catalog-test-secret-only",
    },
    async () => {
      const headers = {
        "x-forwarded-for": "192.0.2.81",
        "x-matpick-admin-key": "naver:catalog-test-admin",
        "x-matpick-admin-token": createProfileSyncToken("catalog-test-admin"),
      };
      const first = response();
      await handler(
        {
          method: "GET",
          headers,
          query: { includeCatalog: "1", cursor: "0" },
        },
        first
      );
      assert.equal(first.code, 200);
      assert.deepEqual(first.body.edits, []);
      assert.equal(first.body.configured, false);
      assert.equal(first.body.catalog.pageSize, 800);
      assert.equal(first.body.catalog.totalCount, dataset.restaurants.length);
      assert.equal(first.body.catalog.restaurants.length, 800);
      assert.equal(first.body.catalog.nextCursor, "800");
      assert.deepEqual(first.body.catalog.sources, dataset.sources);
      assert.deepEqual(
        first.body.catalog.restaurants[0].menus,
        dataset.restaurants[0].menus
      );
      assert.ok(Buffer.byteLength(JSON.stringify(first.body)) < 3_500_000);

      const restaurantIds = first.body.catalog.restaurants.map(
        restaurant => restaurant.id
      );
      const sourceLinkIds = first.body.catalog.sourceLinks.map(link => link.id);
      let cursor = first.body.catalog.nextCursor;
      while (cursor != null) {
        const continuation = response();
        await handler(
          {
            method: "GET",
            headers,
            query: { includeCatalog: "1", cursor },
          },
          continuation
        );
        assert.equal(continuation.code, 200);
        assert.equal("edits" in continuation.body, false);
        assert.equal("configured" in continuation.body, false);
        assert.equal("sources" in continuation.body.catalog, false);
        const pageIds = new Set(
          continuation.body.catalog.restaurants.map(restaurant => restaurant.id)
        );
        assert.ok(
          continuation.body.catalog.sourceLinks.every(link =>
            pageIds.has(link.restaurantId)
          )
        );
        assert.ok(
          Buffer.byteLength(JSON.stringify(continuation.body)) < 4_000_000
        );
        restaurantIds.push(
          ...continuation.body.catalog.restaurants.map(
            restaurant => restaurant.id
          )
        );
        sourceLinkIds.push(
          ...continuation.body.catalog.sourceLinks.map(link => link.id)
        );
        cursor = continuation.body.catalog.nextCursor;
      }
      assert.deepEqual(
        restaurantIds,
        dataset.restaurants.map(restaurant => restaurant.id)
      );
      assert.equal(new Set(restaurantIds).size, dataset.restaurants.length);
      assert.equal(sourceLinkIds.length, dataset.sourceLinks.length);
      assert.deepEqual(
        new Set(sourceLinkIds),
        new Set(dataset.sourceLinks.map(link => link.id))
      );
    }
  );
});

test("admin catalog client bounds continuation concurrency and keeps page order", async () => {
  const requested = [];
  let active = 0;
  let peakActive = 0;
  const fetcher = async url => {
    const cursor = Number(
      new URL(url, "https://matpick.test").searchParams.get("cursor")
    );
    requested.push(cursor);
    active += 1;
    peakActive = Math.max(peakActive, active);
    if (cursor)
      await new Promise(resolve => setTimeout(resolve, 7 - cursor / 2));
    active -= 1;
    const restaurants = [cursor, cursor + 1]
      .filter(id => id < 10)
      .map(id => ({ id: `r${id}`, name: `식당 ${id}`, menus: [] }));
    return {
      ok: true,
      json: async () => ({
        ...(cursor === 0 ? { edits: [], configured: true } : {}),
        catalog: {
          restaurants,
          ...(cursor === 0 ? { sources: [{ id: "tv", name: "방송" }] } : {}),
          sourceLinks: restaurants.map(restaurant => ({
            id: `l-${restaurant.id}`,
            restaurantId: restaurant.id,
            sourceId: "tv",
          })),
          pageSize: 2,
          totalCount: 10,
          nextCursor: cursor + 2 < 10 ? String(cursor + 2) : null,
        },
      }),
    };
  };
  const result = await catalogClient.fetchAdminRestaurantCatalog({
    headers: {},
    fetcher,
  });
  assert.deepEqual(
    [...requested].sort((a, b) => a - b),
    [0, 2, 4, 6, 8]
  );
  assert.equal(peakActive, 3);
  assert.deepEqual(
    result.catalog.restaurants.map(restaurant => restaurant.id),
    Array.from({ length: 10 }, (_, index) => `r${index}`)
  );
  assert.equal(result.catalog.sourceLinks.length, 10);

  const index = catalogClient.indexAdminCatalogSources(
    result.catalog.sources,
    result.catalog.sourceLinks
  );
  assert.deepEqual(
    index.linksByRestaurant.get("r3").map(link => link.id),
    ["l-r3"]
  );
  assert.deepEqual(
    index.sourcesByRestaurant.get("r3").map(source => source.id),
    ["tv"]
  );
});

test("admin catalog client keeps the linked-cursor fallback for rolling deploys", async () => {
  const requested = [];
  const fetcher = async url => {
    const cursor = new URL(url, "https://matpick.test").searchParams.get(
      "cursor"
    );
    requested.push(cursor);
    const page = cursor === "0" ? 0 : 1;
    return {
      ok: true,
      json: async () => ({
        ...(page === 0 ? { edits: [], configured: true } : {}),
        catalog: {
          restaurants: [{ id: `legacy-${page}`, menus: [] }],
          ...(page === 0 ? { sources: [] } : {}),
          sourceLinks: [],
          nextCursor: page === 0 ? "legacy-next" : null,
        },
      }),
    };
  };
  const result = await catalogClient.fetchAdminRestaurantCatalog({
    headers: {},
    fetcher,
  });
  assert.deepEqual(requested, ["0", "legacy-next"]);
  assert.deepEqual(
    result.catalog.restaurants.map(restaurant => restaurant.id),
    ["legacy-0", "legacy-1"]
  );
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
    {
      sourceLinks: [{ sourceId: "unknown", sourceUrl: "javascript:alert(1)" }],
    },
    null,
    [],
  ]) {
    assert.throws(() => validateChanges(changes, "r_test"), { status: 400 });
  }
});

test("broadcast source edits are normalized and restricted to known sources", () => {
  const known = new Set(["wednesday-gourmet"]);
  const changes = validateChanges(
    {
      sourceLinks: [
        {
          sourceId: "wednesday-gourmet",
          label: " EP.173 ",
          sourceUrl: "https://example.com/episode/173",
          broadcastDate: "2026-09-28",
          ordinal: 173,
          episodeSeries: "정규편",
          episodeNumber: 173,
          episodePart: "1",
          season: 2,
        },
      ],
    },
    "r_test",
    known
  );
  assert.deepEqual(changes.sourceLinks, [
    {
      id: "admin:r_test:1",
      restaurantId: "r_test",
      sourceId: "wednesday-gourmet",
      label: "EP.173",
      note: "",
      sourceUrl: "https://example.com/episode/173",
      broadcastDate: "2026-09-28",
      ordinal: 173,
      episodeSeries: "정규편",
      episodeNumber: 173,
      episodePart: "1",
      season: 2,
    },
  ]);
  assert.throws(
    () =>
      validateChanges(
        { sourceLinks: [{ sourceId: "not-known" }] },
        "r_test",
        known
      ),
    { status: 400 }
  );
});

function newRestaurantChanges(overrides = {}) {
  return {
    name: "새 맛픽식당",
    region: "서울 마포구",
    address: "서울 마포구 월드컵북로 1",
    category: "한식",
    lat: 37.56,
    lng: 126.9,
    operationState: "operating",
    menus: [{ name: "국밥", price: "10,000원", isSignature: true }],
    sourceLinks: [
      {
        sourceId: "popular-restaurants",
        label: "2026 인기맛집",
      },
    ],
    ...overrides,
  };
}

test("new restaurants require a geocoded map confirmation, topic episode and menu", () => {
  const sourceIds = new Set(["popular-restaurants"]);
  assert.throws(
    () =>
      validateNewRestaurant(
        newRestaurantChanges(),
        "pending_test",
        sourceIds,
        false
      ),
    { status: 400 }
  );
  for (const patch of [
    { menus: [] },
    { sourceLinks: [] },
    { sourceLinks: [{ sourceId: "popular-restaurants", label: "" }] },
  ]) {
    assert.throws(
      () =>
        validateNewRestaurant(
          newRestaurantChanges(patch),
          "pending_test",
          sourceIds,
          true
        ),
      { status: 400 }
    );
  }
  const result = validateNewRestaurant(
    newRestaurantChanges(),
    "pending_test",
    sourceIds,
    true
  );
  assert.equal(result.locationVerifiedAt.length > 10, true);
  assert.equal(result.sourceLinks[0].label, "2026 인기맛집");
  assert.equal(result.menus[0].name, "국밥");
});

test("created restaurant edits join public detail, topic, nearby and client catalogs", () => {
  const edit = {
    restaurantId: "admin_public_test",
    revision: 1,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    deletedAt: null,
    changes: {
      ...newRestaurantChanges(),
      imageUrl: "",
      representativeMenu: "국밥",
      menus: [{ id: "menu-1", name: "국밥", price: "10,000원" }],
      sourceLinks: [
        {
          id: "admin:admin_public_test:1",
          restaurantId: "admin_public_test",
          sourceId: "popular-restaurants",
          label: "2026 인기맛집",
        },
      ],
    },
  };
  const detail = queryCatalog(
    { view: "detail", id: edit.restaurantId },
    [edit],
    []
  );
  assert.equal(detail.status, 200);
  assert.equal(detail.body.restaurant.name, "새 맛픽식당");
  assert.equal(detail.body.sourceLinks[0].sourceId, "popular-restaurants");

  for (const query of [
    { view: "list", type: "source", value: "popular-restaurants" },
    { view: "list", type: "nearby", lat: "37.56", lng: "126.9" },
    { view: "list", type: "search", q: "새 맛픽식당" },
  ]) {
    const result = queryCatalog(query, [edit], []);
    assert.equal(result.status, 200);
    assert.ok(
      result.body.restaurants.some(
        restaurant => restaurant.id === edit.restaurantId
      )
    );
  }
  assert.equal(
    client.applyRestaurantEdits([], [edit])[0].id,
    edit.restaurantId
  );
  assert.deepEqual(
    client.applyRestaurantEdits([], [{ ...edit, deletedAt: "2026-10-01" }]),
    []
  );
});

test("restaurant creation is atomically idempotent and rejects another request for the same identity", async () => {
  await withEnv(
    {
      ...noStorage,
      KV_REST_API_URL: "https://redis-create.test.invalid",
      KV_REST_API_TOKEN: "test-only",
    },
    async () => {
      const originalFetch = globalThis.fetch;
      let requestValue = null;
      let identity = null;
      let historyWrites = 0;
      globalThis.fetch = async (_url, options) => {
        const command = JSON.parse(options.body);
        assert.equal(command[0], "EVAL");
        assert.match(command[1], /redis\.call\('GET', KEYS\[4\]\)/);
        assert.match(command[1], /HEXISTS', KEYS\[3\]/);
        if (requestValue && command[6].endsWith("same-request-1234")) {
          return { ok: true, json: async () => ({ result: requestValue }) };
        }
        if (identity === command[10]) {
          return { ok: true, json: async () => ({ result: "__duplicate__" }) };
        }
        identity = command[10];
        requestValue = command[8];
        historyWrites++;
        return { ok: true, json: async () => ({ result: requestValue }) };
      };
      try {
        const changes = validateNewRestaurant(
          newRestaurantChanges(),
          "pending_test",
          new Set(["popular-restaurants"]),
          true
        );
        const first = await createRestaurant({
          changes,
          actor: "naver:operator",
          requestId: "same-request-1234",
          identity: "새맛픽식당:서울마포구월드컵북로1",
        });
        const retried = await createRestaurant({
          changes,
          actor: "naver:operator",
          requestId: "same-request-1234",
          identity: "새맛픽식당:서울마포구월드컵북로1",
        });
        assert.equal(retried.restaurantId, first.restaurantId);
        assert.equal(historyWrites, 1);
        assert.ok(
          first.changes.sourceLinks[0].restaurantId.startsWith("admin_")
        );
        await assert.rejects(
          createRestaurant({
            changes,
            actor: "naver:operator",
            requestId: "other-request-1234",
            identity: "새맛픽식당:서울마포구월드컵북로1",
          }),
          { status: 409 }
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  );
});

test("admin create API requires signed auth, reuses request IDs and compares effective edited identities", async () => {
  await withEnv(
    {
      ...noStorage,
      KV_REST_API_URL: "https://redis-create-api.test.invalid",
      KV_REST_API_TOKEN: "test-only",
      ADMIN_USER_IDS: "naver:create-api-admin",
      AUTH_PROFILE_SIGNING_SECRET: "create-api-secret-only",
    },
    async () => {
      const originalFetch = globalThis.fetch;
      const stored = new Map();
      const requests = new Map();
      const identities = new Set();
      globalThis.fetch = async (_url, options = {}) => {
        if (!options.body)
          return { ok: true, json: async () => ({ result: 1 }) };
        const command = JSON.parse(options.body);
        if (command[0] === "HVALS")
          return {
            ok: true,
            json: async () => ({ result: [...stored.values()] }),
          };
        if (command[0] === "EVAL" && command[2] === 4) {
          if (requests.has(command[6]))
            return {
              ok: true,
              json: async () => ({ result: requests.get(command[6]) }),
            };
          if (identities.has(command[10]))
            return {
              ok: true,
              json: async () => ({ result: "__duplicate__" }),
            };
          stored.set(command[7], command[8]);
          requests.set(command[6], command[8]);
          identities.add(command[10]);
          return { ok: true, json: async () => ({ result: command[8] }) };
        }
        throw new Error(`Unexpected command ${command[0]}`);
      };
      const headers = {
        "x-forwarded-for": "192.0.2.120",
        "x-matpick-admin-key": "naver:create-api-admin",
        "x-matpick-admin-token": createProfileSyncToken("create-api-admin"),
      };
      const body = {
        action: "create",
        requestId: "api-create-request-1234",
        locationValidated: true,
        changes: newRestaurantChanges(),
      };
      try {
        const first = response();
        await handler({ method: "POST", headers, body }, first);
        assert.equal(first.code, 201);
        assert.ok(first.body.edit.restaurantId.startsWith("admin_"));
        const retry = response();
        await handler({ method: "POST", headers, body }, retry);
        assert.equal(retry.code, 200);
        assert.equal(
          retry.body.edit.restaurantId,
          first.body.edit.restaurantId
        );

        const duplicate = response();
        await handler(
          {
            method: "POST",
            headers,
            body: { ...body, requestId: "api-create-request-5678" },
          },
          duplicate
        );
        assert.equal(duplicate.code, 409);

        const original = dataset.restaurants[0];
        stored.set(
          original.id,
          JSON.stringify({
            restaurantId: original.id,
            revision: 1,
            updatedAt: "2026-10-01T00:00:00.000Z",
            deletedAt: null,
            changes: {
              name: "관리자 수정 상호",
              address: "서울 중구 관리자수정로 10",
            },
          })
        );
        const editedDuplicate = response();
        await handler(
          {
            method: "POST",
            headers,
            body: {
              ...body,
              requestId: "api-create-request-9012",
              changes: newRestaurantChanges({
                name: "관리자 수정 상호",
                address: "서울 중구 관리자수정로 10",
              }),
            },
          },
          editedDuplicate
        );
        assert.equal(editedDuplicate.code, 409);
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  );
});
test("address and coordinate edits invalidate the previous location audit", () => {
  const changes = validateChanges(
    { address: "서울특별시 중구 세종대로 110", lat: 37.56631, lng: 126.97794 },
    "r_test"
  );
  assert.equal(changes.lat, 37.56631);
  assert.equal(changes.lng, 126.97794);
  assert.equal(changes.locationVerifiedAt, "");
  assert.deepEqual(changes.locationSourceUrls, []);
  assert.ok(
    !(
      "locationVerifiedAt" in
      validateChanges({ phone: "02-000-0000" }, "r_test")
    )
  );
});

test("public overlays preserve originals; deleted restaurants only remain in the admin catalog", () => {
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
  const deleted = { ...edit, deletedAt: "2026-09-26T00:00:00.000Z" };
  assert.deepEqual(client.applyRestaurantEdits(base, [deleted]), []);
  assert.equal(
    client.applyRestaurantEdits(base, [deleted], { includeDeleted: true })[0]
      .name,
    "수정 상호"
  );
  assert.deepEqual(
    client.applyRestaurantEdits(base, [{ ...deleted, deletedAt: null }]),
    updated
  );
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
        assert.equal(publicRes.code, 404);
        assert.ok(!JSON.stringify(publicRes.body).includes("저장 식당"));
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
        const deleted = await saveEdit({
          restaurantId: "r_test",
          expectedRevision: 3,
          changes: { name: "ignored" },
          action: "delete",
          actor: "operator",
        });
        assert.ok(deleted.deletedAt);
        assert.deepEqual(deleted.changes, reset.changes);
        for (const action of ["save", "reset"]) {
          await assert.rejects(
            saveEdit({
              restaurantId: "r_test",
              expectedRevision: 4,
              changes: {},
              action,
              actor: "operator",
            }),
            { status: 409 }
          );
        }
        await assert.rejects(
          saveEdit({
            restaurantId: "r_test",
            expectedRevision: 3,
            changes: {},
            action: "restore",
            actor: "operator",
          }),
          { status: 409 }
        );
        const restored = await saveEdit({
          restaurantId: "r_test",
          expectedRevision: 4,
          changes: {},
          action: "restore",
          actor: "operator",
        });
        assert.equal(restored.deletedAt, null);
        assert.equal(restored.revision, 5);
        assert.deepEqual(restored.changes, reset.changes);
        const priced = await saveEdit({
          restaurantId: "r_test",
          expectedRevision: 5,
          changes: {
            menus: [{ name: "수육", price: "35,000원" }],
            address: "서울 마포구",
          },
          actor: "operator",
        });
        const trashed = await saveEdit({
          restaurantId: "r_test",
          expectedRevision: 6,
          changes: {},
          action: "delete",
          actor: "operator",
        });
        const recovered = await saveEdit({
          restaurantId: "r_test",
          expectedRevision: 7,
          changes: { menus: [] },
          action: "restore",
          actor: "operator",
        });
        assert.deepEqual(trashed.changes, priced.changes);
        assert.deepEqual(recovered.changes, priced.changes);
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  );
});
