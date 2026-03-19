const REVIEW_KEY_PREFIX = "matpick:reviews:restaurant:";
const REVIEW_FEED_KEY = "matpick:reviews:feed";
const MAX_REVIEW_COUNT = 200;
const MAX_FEED_COUNT = 240;

function getKvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

  if (!url || !token) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ""),
    token,
  };
}

async function requestRedis(command) {
  const config = getKvConfig();
  if (!config) {
    return null;
  }

  const endpoint = `${config.url}/${command.map((part) => encodeURIComponent(String(part))).join("/")}`;
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Review store request failed: ${response.status}`);
  }

  return response.json();
}

function getReviewKey(restaurantId) {
  return `${REVIEW_KEY_PREFIX}${restaurantId}`;
}

function normalizeReview(review) {
  if (!review || typeof review !== "object") {
    return null;
  }

  const id = typeof review.id === "string" ? review.id.trim() : "";
  const user = typeof review.user === "string" ? review.user.trim() : "";
  const date = typeof review.date === "string" ? review.date.trim() : "";
  const stars = Number(review.stars);
  const text = typeof review.text === "string" ? review.text.trim() : "";
  const createdAt = Number(review.createdAt);
  const restaurantId =
    typeof review.restaurantId === "string" ? review.restaurantId.trim() : "";
  const photos = Array.isArray(review.photos)
    ? review.photos.filter((photo) => typeof photo === "string" && photo.trim().length > 0)
    : [];

  if (!id || !user || !date || !Number.isFinite(stars) || stars < 1 || stars > 5) {
    return null;
  }

  return {
    id,
    user,
    date,
    stars,
    text,
    photos,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    ...(restaurantId ? { restaurantId } : {}),
  };
}

function normalizeReviews(payload) {
  if (!payload) {
    return [];
  }

  try {
    const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeReview)
      .filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_REVIEW_COUNT);
  } catch {
    return [];
  }
}

async function readRemoteReviews(restaurantId) {
  const config = getKvConfig();
  if (!config || !restaurantId) {
    return [];
  }

  const payload = await requestRedis(["GET", getReviewKey(restaurantId)]);
  return normalizeReviews(payload?.result);
}

async function writeRemoteReviews(restaurantId, reviews) {
  const config = getKvConfig();
  if (!config || !restaurantId) {
    return false;
  }

  const normalized = normalizeReviews(reviews);
  await requestRedis(["SET", getReviewKey(restaurantId), JSON.stringify(normalized)]);
  return true;
}

function normalizeFeedReviews(payload) {
  return normalizeReviews(payload).filter((review) => typeof review.restaurantId === "string");
}

async function readStoredReviewFeed() {
  const config = getKvConfig();
  if (!config) {
    return [];
  }

  const payload = await requestRedis(["GET", REVIEW_FEED_KEY]);
  return normalizeFeedReviews(payload?.result).slice(0, MAX_FEED_COUNT);
}

async function writeReviewFeed(reviews) {
  const config = getKvConfig();
  if (!config) {
    return false;
  }

  const normalized = normalizeFeedReviews(reviews).slice(0, MAX_FEED_COUNT);
  await requestRedis(["SET", REVIEW_FEED_KEY, JSON.stringify(normalized)]);
  return true;
}

async function rebuildReviewFeed() {
  const config = getKvConfig();
  if (!config) {
    return [];
  }

  const keyPayload = await requestRedis(["KEYS", `${REVIEW_KEY_PREFIX}*`]);
  const keys = Array.isArray(keyPayload?.result) ? keyPayload.result : [];

  if (keys.length === 0) {
    return [];
  }

  const collected = await Promise.all(
    keys.map(async (key) => {
      const restaurantId = String(key).replace(REVIEW_KEY_PREFIX, "");
      const reviews = await readRemoteReviews(restaurantId);
      return reviews.map((review) => ({
        ...review,
        restaurantId,
      }));
    })
  );

  const flattened = collected
    .flat()
    .sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0))
    .slice(0, MAX_FEED_COUNT);

  if (flattened.length > 0) {
    await writeReviewFeed(flattened);
  }

  return flattened;
}

async function readReviewFeed(limit = 80) {
  const cached = await readStoredReviewFeed();
  if (cached.length > 0) {
    return cached.slice(0, limit);
  }

  const rebuilt = await rebuildReviewFeed();
  return rebuilt.slice(0, limit);
}

async function appendRemoteReview(restaurantId, review) {
  const normalizedReview = normalizeReview(review);
  if (!normalizedReview) {
    throw new Error("Invalid review payload");
  }

  const current = await readRemoteReviews(restaurantId);
  const next = [normalizedReview, ...current.filter((entry) => entry.id !== normalizedReview.id)];
  await writeRemoteReviews(restaurantId, next);

  const feedItem = {
    ...normalizedReview,
    restaurantId,
  };
  const currentFeed = await readStoredReviewFeed();

  if (currentFeed.length > 0) {
    await writeReviewFeed([feedItem, ...currentFeed.filter((entry) => entry.id !== feedItem.id)]);
  } else {
    const rebuiltFeed = await rebuildReviewFeed();
    await writeReviewFeed([feedItem, ...rebuiltFeed.filter((entry) => entry.id !== feedItem.id)]);
  }

  return normalizedReview;
}

module.exports = {
  appendRemoteReview,
  readRemoteReviews,
  readReviewFeed,
};
