const POST_KEY = "matpick:community:posts";
const SUGGESTION_KEY = "matpick:community:suggestions";
const COMMENT_KEY_PREFIX = "matpick:community:comments:";
const MAX_POSTS = 500;
const MAX_SUGGESTIONS = 500;
const MAX_COMMENTS = 300;

function getKvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

  if (!url || !token) {
    return null;
  }

  return { url: url.replace(/\/$/, ""), token };
}

function getMemoryStore() {
  globalThis.__matpickCommunityStore ??= new Map();
  return globalThis.__matpickCommunityStore;
}

async function requestRedis(command) {
  const config = getKvConfig();
  if (!config) {
    return null;
  }

  const endpoint = `${config.url}/${command
    .map((part) => encodeURIComponent(String(part)))
    .join("/")}`;
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${config.token}` },
  });

  if (!response.ok) {
    throw new Error(`Community store request failed: ${response.status}`);
  }

  return response.json();
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizePlaceTag(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const kind = value.kind === "suggestion" ? "suggestion" : "official";
  const id = cleanText(value.id, 160);
  const name = cleanText(value.name, 100);
  if (!id || !name) {
    return null;
  }

  return {
    kind,
    id,
    name,
    address: cleanText(value.address, 240),
    category: cleanText(value.category, 80),
    region: cleanText(value.region, 80),
  };
}

function normalizeSuggestion(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const id = cleanText(value.id, 80);
  const userId = cleanText(value.userId, 200);
  const name = cleanText(value.name, 100);
  const address = cleanText(value.address, 240);
  const createdAt = Number(value.createdAt);
  if (!id || !userId || !name || !address) {
    return null;
  }

  return {
    id,
    userId,
    authorName: cleanText(value.authorName, 40) || "맛픽 회원",
    name,
    address,
    region: cleanText(value.region, 80),
    category: cleanText(value.category, 80),
    mapUrl: cleanText(value.mapUrl, 600),
    reason: cleanText(value.reason, 1500),
    status: ["pending", "published", "merged", "rejected"].includes(value.status)
      ? value.status
      : "pending",
    mergedRestaurantId: cleanText(value.mergedRestaurantId, 160),
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : createdAt,
  };
}

function normalizePost(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const id = cleanText(value.id, 80);
  const userId = cleanText(value.userId, 200);
  const title = cleanText(value.title, 100);
  const body = cleanText(value.body, 5000);
  const createdAt = Number(value.createdAt);
  if (!id || !userId || !title || !body) {
    return null;
  }

  const placeTags = Array.isArray(value.placeTags)
    ? value.placeTags.map(normalizePlaceTag).filter(Boolean).slice(0, 3)
    : [];

  return {
    id,
    userId,
    authorName: cleanText(value.authorName, 40) || "맛픽 회원",
    title,
    body,
    category: ["recommendation", "question", "discussion", "review", "information"].includes(
      value.category
    )
      ? value.category
      : "discussion",
    placeTags,
    commentCount: Math.max(0, Number(value.commentCount) || 0),
    status: value.status === "hidden" ? "hidden" : "published",
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : createdAt,
  };
}

function normalizeComment(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const id = cleanText(value.id, 80);
  const postId = cleanText(value.postId, 80);
  const userId = cleanText(value.userId, 200);
  const body = cleanText(value.body, 1000);
  const createdAt = Number(value.createdAt);
  if (!id || !postId || !userId || !body) {
    return null;
  }

  return {
    id,
    postId,
    userId,
    authorName: cleanText(value.authorName, 40) || "맛픽 회원",
    body,
    status: value.status === "hidden" ? "hidden" : "published",
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
  };
}

function parseCollection(payload, normalizer, limit) {
  if (!payload) {
    return [];
  }

  try {
    const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizer)
      .filter(Boolean)
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, limit);
  } catch {
    return [];
  }
}

async function readCollection(key, normalizer, limit) {
  if (!getKvConfig()) {
    return parseCollection(getMemoryStore().get(key), normalizer, limit);
  }

  const payload = await requestRedis(["GET", key]);
  return parseCollection(payload?.result, normalizer, limit);
}

async function writeCollection(key, values, normalizer, limit) {
  const normalized = parseCollection(values, normalizer, limit);
  if (!getKvConfig()) {
    getMemoryStore().set(key, normalized);
    return;
  }

  await requestRedis(["SET", key, JSON.stringify(normalized)]);
}

async function readPosts() {
  return readCollection(POST_KEY, normalizePost, MAX_POSTS);
}

async function savePosts(posts) {
  return writeCollection(POST_KEY, posts, normalizePost, MAX_POSTS);
}

async function appendPost(post) {
  const normalized = normalizePost(post);
  if (!normalized) {
    throw new Error("Invalid community post");
  }

  const current = await readPosts();
  await savePosts([normalized, ...current.filter((item) => item.id !== normalized.id)]);
  return normalized;
}

async function readSuggestions() {
  return readCollection(SUGGESTION_KEY, normalizeSuggestion, MAX_SUGGESTIONS);
}

async function appendSuggestion(suggestion) {
  const normalized = normalizeSuggestion(suggestion);
  if (!normalized) {
    throw new Error("Invalid restaurant suggestion");
  }

  const current = await readSuggestions();
  await writeCollection(
    SUGGESTION_KEY,
    [normalized, ...current.filter((item) => item.id !== normalized.id)],
    normalizeSuggestion,
    MAX_SUGGESTIONS
  );
  return normalized;
}

function getCommentKey(postId) {
  return `${COMMENT_KEY_PREFIX}${postId}`;
}

async function readPostComments(postId) {
  return readCollection(getCommentKey(postId), normalizeComment, MAX_COMMENTS);
}

async function appendPostComment(postId, comment) {
  const normalized = normalizeComment(comment);
  if (!normalized) {
    throw new Error("Invalid community comment");
  }

  const current = await readPostComments(postId);
  await writeCollection(
    getCommentKey(postId),
    [normalized, ...current.filter((item) => item.id !== normalized.id)],
    normalizeComment,
    MAX_COMMENTS
  );

  const posts = await readPosts();
  const nextPosts = posts.map((post) =>
    post.id === postId
      ? { ...post, commentCount: post.commentCount + 1, updatedAt: Date.now() }
      : post
  );
  await savePosts(nextPosts);
  return normalized;
}

module.exports = {
  appendPost,
  appendPostComment,
  appendSuggestion,
  readPostComments,
  readPosts,
  readSuggestions,
};
