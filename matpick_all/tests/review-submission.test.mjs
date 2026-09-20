import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadAppModules } from "../scripts/load-public-data.mjs";
const require = createRequire(import.meta.url);
const {
  createMemberReview,
} = require("../../api/reviews/_reviewSubmission.js");
const { appendRemoteReview } = require("../../api/reviews/_reviewStore.js");
const [drafts] = await loadAppModules(["/src/lib/reviewDraft.ts"]);
const input = {
  restaurantId: "r_example",
  userId: "test-account",
  profile: { nickname: "방문회원", consentAcceptedAt: 1 },
  review: { stars: 4, text: "국수가 깔끔하고 대기가 짧았어요.", visited: true },
  now: 1789898400000,
};

test("author, identity and date come from the authenticated profile and server", () => {
  const saved = createMemberReview({
    ...input,
    review: {
      ...input.review,
      id: "stolen-id",
      user: "사칭",
      createdAt: 1,
      date: "2099.01.01",
    },
  });
  assert.equal(saved.user, "방문회원");
  assert.equal(saved.createdAt, input.now);
  assert.notEqual(saved.id, "stolen-id");
  assert.equal(
    saved.id,
    createMemberReview({ ...input, now: input.now + 100 }).id
  );
  assert.notEqual(
    saved.id,
    createMemberReview({ ...input, userId: "different-account" }).id
  );
  assert.notEqual(
    saved.id,
    createMemberReview({ ...input, restaurantId: "r_other" }).id
  );
  assert.ok(!JSON.stringify(saved).includes(input.userId));
});
test("blank, fractional, oversized and unconfirmed reviews are rejected", () => {
  for (const patch of [
    { text: " " },
    { stars: 0 },
    { stars: 5.1 },
    { text: "a".repeat(2001) },
    { visited: false },
  ]) {
    assert.throws(
      () =>
        createMemberReview({ ...input, review: { ...input.review, ...patch } }),
      { status: 400 }
    );
  }
  assert.throws(() => createMemberReview({ ...input, profile: null }), {
    status: 401,
  });
});
test("missing shared storage never reports a successful public post", async () => {
  const names = [
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ];
  const old = names.map(name => process.env[name]);
  names.forEach(name => delete process.env[name]);
  try {
    await assert.rejects(
      appendRemoteReview("r_example", createMemberReview(input)),
      { status: 503 }
    );
  } finally {
    names.forEach((name, i) => {
      if (old[i] !== undefined) process.env[name] = old[i];
    });
  }
});
test("draft survives login navigation, expires and never crosses restaurants", () => {
  const storage = new Map();
  globalThis.sessionStorage = {
    getItem: key => storage.get(key),
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  };
  try {
    const draft = {
      text: "직접 다녀온 후기",
      stars: 3,
      visited: true,
      updatedAt: Date.now(),
    };
    drafts.saveReviewDraft("one", draft);
    assert.deepEqual(drafts.readReviewDraft("one"), draft);
    assert.equal(drafts.readReviewDraft("two").text, "");
    assert.equal(
      drafts.reviewReturnPath("one"),
      "/restaurant/one?writeReview=1#detail-reviews-title"
    );
    drafts.saveReviewDraft("one", {
      ...draft,
      updatedAt: Date.now() - 86400001,
    });
    assert.equal(drafts.readReviewDraft("one").text, "");
    drafts.clearReviewDraft("one");
    assert.equal(storage.size, 0);
  } finally {
    delete globalThis.sessionStorage;
  }
});
