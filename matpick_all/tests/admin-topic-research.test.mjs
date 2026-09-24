import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const handler = require("../../api/restaurants/index.js");
const { createProfileSyncToken } = require("../../api/auth/_profileStore.js");
function response() {
  return {
    code: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(c) {
      this.code = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
}
test("research queue is private, paginated and filtered; individual evidence is fetched on demand", async () => {
  const names = [
    "ADMIN_USER_IDS",
    "AUTH_PROFILE_SIGNING_SECRET",
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ];
  const before = Object.fromEntries(names.map(k => [k, process.env[k]]));
  try {
    names.forEach(k => delete process.env[k]);
    process.env.ADMIN_USER_IDS = "naver:topic-test";
    process.env.AUTH_PROFILE_SIGNING_SECRET = "local-test-secret-only";
    const call = async (query = {}, headers = {}, method = "GET") => {
      const res = response();
      await handler(
        { method, query: { scope: "topic-research", ...query }, headers },
        res
      );
      return res;
    };
    assert.equal((await call()).code, 403);
    assert.equal(
      (await call({}, { "x-matpick-admin-key": "naver:topic-test" })).code,
      403
    );
    const headers = {
      "x-matpick-admin-key": "naver:topic-test",
      "x-matpick-admin-token": createProfileSyncToken("topic-test"),
    };
    assert.equal(
      (
        await call(
          {},
          { ...headers, origin: "https://evil.invalid", host: "matpick.co.kr" }
        )
      ).code,
      403
    );
    assert.equal((await call({}, headers, "POST")).code, 405);
    const all = await call({ status: "all", limit: "12" }, headers);
    assert.equal(all.code, 200);
    assert.equal(all.body.summary.candidateRows, 22117);
    assert.equal(all.body.total, all.body.summary.candidateGroups);
    assert.equal(all.body.total + all.body.summary.duplicateRows, 22117);
    assert.ok(all.body.summary.duplicateRows > 0);
    assert.equal(all.body.rows.length, 12);
    assert.equal(all.headers["Cache-Control"], "no-store");
    assert.equal(all.body.rows[0].evidence, undefined);
    const next = await call({ status: "all", limit: "12", page: "2" }, headers);
    assert.ok(
      !next.body.rows.some(r => all.body.rows.some(a => a.id === r.id))
    );
    const pending = await call({}, headers);
    assert.equal(pending.body.total, all.body.summary.pendingCandidateRows);
    assert.ok(
      pending.body.rows.every(
        r => !["published", "excluded"].includes(r.publication.reason)
      )
    );
    const removed = await call({ status: "excluded" }, headers);
    assert.equal(removed.body.total, all.body.summary.excludedGroups);
    const dudley = await call({ topic: "9" }, headers);
    assert.equal(
      dudley.body.total,
      all.body.summary.topics.find(t => t.rank === 9).pendingRows
    );
    assert.ok(
      dudley.body.rows.every(
        r =>
          r.publication.reason !== "source_review" ||
          r.publication.pendingRanks.includes(9)
      )
    );
    const chef = await call(
      { topic: "10", status: "published", q: "윤서울" },
      headers
    );
    assert.equal(chef.body.total, 1);
    const detail = await call({ id: chef.body.rows[0].id }, headers);
    assert.equal(detail.body.row.manualEvidence[0].chefName, "김도윤");
    assert.ok(detail.body.row.evidence.length);
    assert.equal((await call({ topic: "999" }, headers)).code, 400);
    assert.equal((await call({ id: "missing" }, headers)).code, 404);
    assert.equal(
      (await call({ q: "절대없는검색문구__", status: "all" }, headers)).body
        .total,
      0
    );
    assert.ok(
      (await call({ limit: "100000", page: "999999" }, headers)).body.rows
        .length <= 100
    );
  } finally {
    for (const k of names) {
      if (before[k] === undefined) delete process.env[k];
      else process.env[k] = before[k];
    }
  }
});
