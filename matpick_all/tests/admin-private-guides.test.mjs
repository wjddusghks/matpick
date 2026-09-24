import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const handler = require("../../api/restaurants/index.js");
const { createProfileSyncToken } = require("../../api/auth/_profileStore.js");

test("regional guide catalog requires an allowlisted administrator and a matching signed session", async () => {
  const catalog = require("../../api/admin/_privateGuideCatalog.json");
  const originalRestaurants = catalog.restaurants;
  catalog.restaurants = [{ id: "private-guide:synthetic-auth-check", name: "권한 테스트 전용 가상식당", privateGuideIds: ["seoul"] }];
  const before = { ADMIN_USER_IDS: process.env.ADMIN_USER_IDS, AUTH_PROFILE_SIGNING_SECRET: process.env.AUTH_PROFILE_SIGNING_SECRET };
  try {
    process.env.ADMIN_USER_IDS = "naver:guide-admin";
    process.env.AUTH_PROFILE_SIGNING_SECRET = "test-only-private-guide-secret";
    const call = async (headers = {}, method = "GET") => {
      const res = { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
      await handler({ method, query: { scope: "private-guides" }, headers }, res);
      return res;
    };
    const admin = { "x-matpick-admin-key": "naver:guide-admin", "x-matpick-admin-token": createProfileSyncToken("guide-admin") };
    for (const headers of [{}, { "x-matpick-admin-key": "naver:guide-admin" }, { ...admin, "x-matpick-admin-token": createProfileSyncToken("ordinary-user") }, { "x-matpick-admin-key": "naver:ordinary-user", "x-matpick-admin-token": createProfileSyncToken("ordinary-user") }, { ...admin, origin: "https://evil.invalid", host: "matpick.co.kr" }]) {
      const result = await call(headers);
      assert.equal(result.code, 403);
      assert.equal(result.body.regions, undefined);
      assert.equal(result.body.restaurants, undefined);
      assert.equal(result.headers["Cache-Control"], "no-store");
    }
    assert.equal((await call(admin, "POST")).code, 405);
    const result = await call(admin);
    assert.equal(result.code, 200);
    assert.equal(result.body.regions.length, 6);
    assert.equal(new Set(result.body.regions.map(r => r.id)).size, 6);
    assert.ok(result.body.regions.every(r => !r.url));
    assert.ok(Array.isArray(result.body.restaurants));
    assert.equal(result.body.restaurants[0].id, "private-guide:synthetic-auth-check");
    assert.ok(result.body.expiresAt > Date.now() && result.body.expiresAt <= Date.now() + 300000);
    const publicData = await readFile(new URL("../client/src/data/generated/public-dataset.json", import.meta.url), "utf8");
    for (const restaurant of result.body.restaurants) assert.ok(!publicData.includes(restaurant.id));
    assert.ok(!publicData.includes('"privateGuideIds"'));
  } finally {
    catalog.restaurants = originalRestaurants;
    for (const [key, value] of Object.entries(before)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
});
