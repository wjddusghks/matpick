const { randomUUID } = require("node:crypto");

const ITEM_PREFIX = "matpick:feedback:v1:";
const INDEX_KEY = "matpick:feedback:v1:index";
const RETENTION_SECONDS = 90 * 24 * 60 * 60;
const PAGE_SIZE = 50;
const CATEGORIES = new Set(["improvement", "complaint", "other"]);
const STATUSES = new Set(["new", "reviewing", "resolved"]);

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

function getKvConfig() {
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

async function redis(command) {
  const config = getKvConfig();
  if (!config) fail("Feedback storage is unavailable.", 503);
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) fail("Feedback storage is unavailable.", 503);
  const payload = await response.json();
  if (payload?.error) fail("Feedback storage is unavailable.", 503);
  return payload?.result;
}

function validateFeedback(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("Invalid feedback.");
  if (input.website) fail("Unable to process this request.");
  if (
    typeof input.requestId !== "string" ||
    !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(input.requestId)
  )
    fail("Please reopen the feedback form.");
  if (!CATEGORIES.has(input.category)) fail("Choose a feedback category.");
  if (
    typeof input.message !== "string" ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(input.message)
  )
    fail("Check your message.");
  const message = input.message.trim();
  if (message.length < 20 || message.length > 2000)
    fail("Feedback must be 20–2,000 characters.");
  const language =
    input.language === "en" ? "en" : input.language === "ko" ? "ko" : null;
  if (!language) fail("Invalid language.");
  const pagePath =
    typeof input.pagePath === "string" ? input.pagePath.trim() : "";
  if (
    !/^\/[A-Za-z0-9/_\-.%]*$/.test(pagePath) ||
    pagePath.length > 300 ||
    pagePath.includes("?") ||
    pagePath.includes("#")
  )
    fail("Invalid page path.");
  if (input.consent !== true) fail("Consent is required.");
  return {
    requestId: input.requestId.toLowerCase(),
    category: input.category,
    message,
    language,
    pagePath,
  };
}

async function saveFeedback(input) {
  const now = Date.now();
  const item = {
    id: randomUUID(),
    ...input,
    status: "new",
    createdAt: now,
    updatedAt: now,
  };
  const key = `${ITEM_PREFIX}${input.requestId}`;
  const script = `
local existing = redis.call('GET', KEYS[1])
if existing then return existing end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3])
redis.call('ZADD', KEYS[2], ARGV[2], KEYS[1])
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', ARGV[4])
return ARGV[1]`;
  const result = await redis([
    "EVAL",
    script,
    2,
    key,
    INDEX_KEY,
    JSON.stringify(item),
    now,
    RETENTION_SECONDS,
    now - RETENTION_SECONDS * 1000,
  ]);
  if (!result) fail("Feedback was not saved.", 503);
  const stored = typeof result === "string" ? JSON.parse(result) : result;
  if (
    stored.requestId === input.requestId &&
    ["category", "message", "language", "pagePath"].some(
      (field) => stored[field] !== input[field],
    )
  )
    fail("This request was already used.", 409);
  return { id: stored.id, status: stored.status, createdAt: stored.createdAt };
}

async function listFeedback(page = 0) {
  const offset = page * PAGE_SIZE;
  const cutoff = Date.now() - RETENTION_SECONDS * 1000;
  await redis(["ZREMRANGEBYSCORE", INDEX_KEY, "-inf", cutoff]);
  const keys =
    (await redis(["ZREVRANGE", INDEX_KEY, offset, offset + PAGE_SIZE - 1])) ||
    [];
  const values = keys.length ? (await redis(["MGET", ...keys])) || [] : [];
  const items = values.flatMap((value) => {
    try {
      return value ? [JSON.parse(value)] : [];
    } catch {
      return [];
    }
  });
  const total = Number(await redis(["ZCARD", INDEX_KEY])) || 0;
  return { items, total, page, pageSize: PAGE_SIZE, retentionDays: 90 };
}

async function updateFeedback(requestId, status, adminId) {
  if (
    typeof requestId !== "string" ||
    !/^[a-f0-9-]{36}$/i.test(requestId) ||
    !STATUSES.has(status)
  )
    fail("Invalid status update.");
  const key = `${ITEM_PREFIX}${requestId.toLowerCase()}`;
  const script = `
local raw = redis.call('GET', KEYS[1])
if not raw then return nil end
local ttl = redis.call('PTTL', KEYS[1])
if ttl <= 0 then return nil end
local item = cjson.decode(raw)
item.status = ARGV[1]
item.updatedAt = tonumber(ARGV[2])
item.updatedBy = ARGV[3]
local encoded = cjson.encode(item)
redis.call('SET', KEYS[1], encoded, 'KEEPTTL')
return encoded`;
  const result = await redis([
    "EVAL",
    script,
    1,
    key,
    status,
    Date.now(),
    String(adminId || "").slice(0, 100),
  ]);
  if (!result) fail("Feedback was not found.", 404);
  return typeof result === "string" ? JSON.parse(result) : result;
}

module.exports = {
  validateFeedback,
  saveFeedback,
  listFeedback,
  updateFeedback,
  RETENTION_SECONDS,
  PAGE_SIZE,
};
