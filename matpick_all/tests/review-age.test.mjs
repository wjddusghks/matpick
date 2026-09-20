import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  deriveAgeProfile,
  normalizeAgeProfile,
  publicReviewAge,
} = require("../../api/auth/_ageProfile.js");
const {
  createProfileSyncToken,
  validateProfileSyncToken,
} = require("../../api/auth/_profileStore.js");
const {
  createMemberReview,
} = require("../../api/reviews/_reviewSubmission.js");
const {
  appendRemoteReview,
  readRemoteReviews,
  readReviewFeed,
} = require("../../api/reviews/_reviewStore.js");
const now = Date.parse("2026-09-20T00:00:00Z");
test("birth date uses the birthday boundary in Korea and is never retained", () => {
  const before = deriveAgeProfile(
    "naver",
    { birthyear: "1996", birthday: "09-21" },
    now
  );
  const after = deriveAgeProfile(
    "naver",
    { birthyear: "1996", birthday: "09-20" },
    now
  );
  assert.equal(before.group, "20s");
  assert.equal(after.group, "30s");
  assert.deepEqual(Object.keys(after).sort(), ["basis", "checkedAt", "group"]);
  assert.equal(
    deriveAgeProfile("naver", { birthyear: "2007", birthday: "09-20" }, now),
    null
  );
  assert.equal(
    deriveAgeProfile("naver", { birthyear: "1996", birthday: "02-31" }, now),
    null
  );
  assert.equal(
    deriveAgeProfile(
      "kakao",
      { birthyear: "1996", birthday: "0920", birthday_type: "LUNAR" },
      now
    ),
    null
  );
});
test("provider age ranges preserve their basis, consent and uncertainty", () => {
  assert.equal(
    deriveAgeProfile("kakao", { age_range: "20~29" }, now).basis,
    "kakao_range"
  );
  assert.equal(deriveAgeProfile("naver", { age: "30-39" }, now).group, "30s");
  assert.equal(deriveAgeProfile("naver", { age: "60-" }, now).group, "60plus");
  for (const profile of [
    {},
    { age_range: "20~29", age_range_needs_agreement: true },
    { age_range: "20~29", has_age_range: false },
    { age_range: "20~29", is_age_range_valid: false },
    { age_range: "15~19" },
    { age_range: "20~39" },
  ])
    assert.equal(deriveAgeProfile("kakao", profile, now), null);
  assert.equal(
    normalizeAgeProfile(
      { group: "20s", basis: "kakao_range", checkedAt: now },
      now + 31 * 86400000
    ),
    null
  );
});
test("signed age cannot be changed by a client; existing tokens remain valid", () => {
  const old = process.env.AUTH_PROFILE_SIGNING_SECRET;
  process.env.AUTH_PROFILE_SIGNING_SECRET = "test-only-secret";
  try {
    const age = { group: "20s", basis: "kakao_range", checkedAt: Date.now() };
    const token = createProfileSyncToken("test-user", {
      ageProfile: { ...age, birthday: "0101" },
    });
    assert.deepEqual(
      validateProfileSyncToken("test-user", token).ageProfile,
      age
    );
    const [payload, sig] = token.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url"));
    assert.ok(!JSON.stringify(decoded).includes("birthday"));
    decoded.age.group = "30s";
    assert.equal(
      validateProfileSyncToken(
        "test-user",
        `${Buffer.from(JSON.stringify(decoded)).toString("base64url")}.${sig}`
      ).valid,
      false
    );
    assert.equal(validateProfileSyncToken("someone-else", token).valid, false);
    assert.equal(
      validateProfileSyncToken("test-user", createProfileSyncToken("test-user"))
        .valid,
      true
    );
  } finally {
    if (old === undefined) delete process.env.AUTH_PROFILE_SIGNING_SECRET;
    else process.env.AUTH_PROFILE_SIGNING_SECRET = old;
  }
});
test("review age is opt-in and a replacement without consent removes it", () => {
  const input = {
    restaurantId: "r_test",
    userId: "test-user",
    profile: { nickname: "방문회원", consentAcceptedAt: 1 },
    review: { stars: 4, text: "직접 방문한 후기입니다.", visited: true },
    ageProfile: { group: "30s", basis: "naver_range", checkedAt: now },
    now,
  };
  assert.deepEqual(publicReviewAge(createMemberReview(input)), {});
  const saved = createMemberReview({
    ...input,
    review: {
      ...input.review,
      showAgeGroup: true,
      ageGroup: "20s",
      birthyear: "2000",
    },
  });
  assert.equal(saved.ageGroup, "30s");
  assert.ok(!JSON.stringify(saved).includes("birthyear"));
  assert.equal(publicReviewAge(saved).ageGroup, "30s");
  assert.deepEqual(
    publicReviewAge({ ...saved, ageConsentVersion: undefined }),
    {}
  );
  const replaced = createMemberReview(input);
  assert.equal(replaced.id, saved.id);
  assert.deepEqual(publicReviewAge(replaced), {});
  assert.equal(
    createMemberReview({
      ...input,
      ageProfile: null,
      review: { ...input.review, showAgeGroup: true, ageGroup: "20s" },
    }).ageGroup,
    undefined
  );
});

test("age consent survives shared-store serialization and withdrawal clears detail and feed", async () => {
  const previousFetch = globalThis.fetch;
  const keys = ["KV_REST_API_URL", "KV_REST_API_TOKEN"];
  const old = keys.map(k => process.env[k]);
  process.env.KV_REST_API_URL = "https://review-store.test";
  process.env.KV_REST_API_TOKEN = "test-only";
  const records = new Map();
  globalThis.fetch = async (_url, options) => {
    const command = JSON.parse(options.body);
    if (command[0] === "GET")
      return {
        ok: true,
        json: async () => ({ result: records.get(command[1]) || null }),
      };
    assert.equal(command[0], "EVAL");
    // Simulate the store transaction boundary, including JSON serialization.
    for (const [key, value] of [
      [command[3], command[5]],
      [command[4], command[6]],
    ]) {
      const item = JSON.parse(value),
        existing = JSON.parse(records.get(key) || "[]");
      records.set(
        key,
        JSON.stringify([item, ...existing.filter(r => r.id !== item.id)])
      );
    }
    return { ok: true, json: async () => ({ result: 1 }) };
  };
  try {
    const input = {
      restaurantId: "r_age",
      userId: "age-user",
      profile: { nickname: "회원", consentAcceptedAt: 1 },
      review: {
        stars: 4,
        text: "방문한 식당 후기",
        visited: true,
        showAgeGroup: true,
      },
      ageProfile: { group: "20s", basis: "kakao_range", checkedAt: now },
      now,
    };
    await appendRemoteReview("r_age", createMemberReview(input));
    assert.equal((await readRemoteReviews("r_age"))[0].ageGroup, "20s");
    assert.equal((await readReviewFeed())[0].ageGroup, "20s");
    await appendRemoteReview(
      "r_age",
      createMemberReview({
        ...input,
        review: { ...input.review, showAgeGroup: false },
      })
    );
    for (const rows of [
      await readRemoteReviews("r_age"),
      await readReviewFeed(),
    ]) {
      assert.equal(rows.length, 1);
      assert.equal(rows[0].ageGroup, undefined);
    }
  } finally {
    globalThis.fetch = previousFetch;
    keys.forEach((k, i) => {
      if (old[i] === undefined) delete process.env[k];
      else process.env[k] = old[i];
    });
  }
});
