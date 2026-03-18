const REVIEW_KEY_PREFIX = "matpick:reviews:restaurant:";
const MAX_REVIEW_COUNT = 200;

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

async function appendRemoteReview(restaurantId, review) {
  const normalizedReview = normalizeReview(review);
  if (!normalizedReview) {
    throw new Error("Invalid review payload");
  }

  const current = await readRemoteReviews(restaurantId);
  const next = [normalizedReview, ...current.filter((entry) => entry.id !== normalizedReview.id)];
  await writeRemoteReviews(restaurantId, next);
  return normalizedReview;
}

module.exports = {
  appendRemoteReview,
  readRemoteReviews,
};
