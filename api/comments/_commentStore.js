const COMMENT_KEY_PREFIX = "matpick:comments:restaurant:";
const { fetchWithTimeout, readJsonResponse } = require("../_safeFetch");
const MAX_COMMENT_COUNT = 200;

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

  const endpoint = `${config.url}/${command
    .map((part) => encodeURIComponent(String(part)))
    .join("/")}`;
  const response = await fetchWithTimeout(endpoint, {
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Comment store request failed: ${response.status}`);
  }

  return readJsonResponse(response);
}

function getCommentKey(restaurantId) {
  return `${COMMENT_KEY_PREFIX}${restaurantId}`;
}

function normalizeComment(comment) {
  if (!comment || typeof comment !== "object") {
    return null;
  }

  const id = typeof comment.id === "string" ? comment.id.trim().slice(0, 80) : "";
  const user = typeof comment.user === "string" ? comment.user.trim().slice(0, 40) : "";
  const date = typeof comment.date === "string" ? comment.date.trim().slice(0, 20) : "";
  const text = typeof comment.text === "string" ? comment.text.trim().slice(0, 500) : "";
  const createdAt = Number(comment.createdAt);

  if (!id || !user || !date || !text) {
    return null;
  }

  return {
    id,
    user,
    date,
    text,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
  };
}

function normalizeComments(payload) {
  if (!payload) {
    return [];
  }

  try {
    const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeComment)
      .filter(Boolean)
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, MAX_COMMENT_COUNT);
  } catch {
    return [];
  }
}

async function readRemoteComments(restaurantId) {
  const config = getKvConfig();
  if (!config || !restaurantId) {
    return [];
  }

  const payload = await requestRedis(["GET", getCommentKey(restaurantId)]);
  return normalizeComments(payload?.result);
}

async function writeRemoteComments(restaurantId, comments) {
  const config = getKvConfig();
  if (!config || !restaurantId) {
    return false;
  }

  await requestRedis([
    "SET",
    getCommentKey(restaurantId),
    JSON.stringify(normalizeComments(comments)),
  ]);
  return true;
}

async function appendRemoteComment(restaurantId, comment) {
  const normalizedComment = normalizeComment(comment);
  if (!normalizedComment) {
    throw new Error("Invalid comment payload");
  }

  const current = await readRemoteComments(restaurantId);
  const next = [
    normalizedComment,
    ...current.filter((entry) => entry.id !== normalizedComment.id),
  ];
  await writeRemoteComments(restaurantId, next);
  return normalizedComment;
}

module.exports = {
  appendRemoteComment,
  readRemoteComments,
};
