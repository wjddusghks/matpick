import test from "node:test";
import assert from "node:assert/strict";
import { loadAppModules } from "../scripts/load-public-data.mjs";

const [store, reviews] = await loadAppModules([
  "/src/lib/restaurantReviewData.ts",
  "/src/lib/reviews.ts",
]);
const sample = {
  id: "one",
  user: "방문자",
  date: "2026.09.20",
  stars: 4,
  text: "방문 후기",
  photos: [],
  createdAt: 1,
};

test("fresh reviews replace cached duplicates without losing existing visitor photos", () => {
  const result = store.mergeRestaurantReviews(
    [
      {
        ...sample,
        text: "수정한 후기",
        photos: ["https://example.com/visit.jpg", "data:image/jpeg;base64,AA"],
        restaurantId: "restaurant-one",
      },
    ],
    [sample, { ...sample, id: "two", createdAt: 2 }]
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].id, "two");
  assert.equal(result[1].text, "수정한 후기");
  assert.equal(result[1].photos.length, 2);
  assert.equal(result[1].restaurantId, "restaurant-one");
});

test("editorial seed reviews and invalid scores never become public visitor ratings", () => {
  const result = store.mergeRestaurantReviews([
    sample,
    null,
    {},
    { ...sample, id: "seed", user: "맛픽 가이드" },
    { ...sample, id: "invalid", stars: NaN },
    { ...sample, id: "zero", stars: 0 },
    { ...sample, id: "too-high", stars: 6 },
    { ...sample, id: "partial", photos: undefined },
  ]);
  assert.deepEqual(
    result.map(item => item.id),
    ["one", "partial"]
  );
  assert.equal(reviews.summarizeReviews(result).average, 4);
  assert.equal(
    reviews.summarizeReviews(store.mergeRestaurantReviews([])).count,
    0
  );
});

test("legacy device storage remains restaurant-specific and tolerates malformed data", () => {
  const values = new Map();
  globalThis.window = {
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  };
  try {
    store.storeRestaurantReviews("first", [sample]);
    assert.equal(store.readRestaurantReviews("first").length, 1);
    assert.deepEqual(store.readRestaurantReviews("second"), []);
    values.set("matpick_reviews_first", '{"not":"an array"}');
    assert.deepEqual(store.readRestaurantReviews("first"), []);
    values.set("matpick_reviews_first", "invalid JSON");
    assert.deepEqual(store.readRestaurantReviews("first"), []);
    globalThis.window.localStorage.setItem = () => {
      throw new Error("storage unavailable");
    };
    assert.doesNotThrow(() => store.storeRestaurantReviews("first", [sample]));
  } finally {
    delete globalThis.window;
  }
});
