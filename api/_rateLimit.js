const RATE_LIMIT_PREFIX = "matpick:rate-limit:";
const FALLBACK_STORE = globalThis.__MATPICK_RATE_LIMIT_STORE__ || new Map();
const { logSecurityEvent, maskValue } = require("./_securityLog");

if (!globalThis.__MATPICK_RATE_LIMIT_STORE__) {
  globalThis.__MATPICK_RATE_LIMIT_STORE__ = FALLBACK_STORE;
}

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

function getClientIp(req) {
  const forwardedFor =
    req.headers?.["x-forwarded-for"] || req.headers?.["X-Forwarded-For"] || "";
  const realIp = req.headers?.["x-real-ip"] || req.headers?.["X-Real-Ip"] || "";
  const vercelForwardedFor =
    req.headers?.["x-vercel-forwarded-for"] ||
    req.headers?.["X-Vercel-Forwarded-For"] ||
    "";
  const candidate = String(forwardedFor || vercelForwardedFor || realIp || "")
    .split(",")
    .map((value) => value.trim())
    .find(Boolean);

  return candidate || "unknown";
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
    throw new Error(`Rate limit store request failed: ${response.status}`);
  }

  return response.json();
}

function getFallbackKey(bucket, subject) {
  return `${bucket}:${subject}`;
}

function consumeFallback(bucket, subject, windowSec) {
  const key = getFallbackKey(bucket, subject);
  const now = Date.now();
  const expiresAt = now + windowSec * 1000;
  const current = FALLBACK_STORE.get(key);

  if (!current || current.expiresAt <= now) {
    const next = { count: 1, expiresAt };
    FALLBACK_STORE.set(key, next);
    return next;
  }

  current.count += 1;
  return current;
}

async function consumeRateLimit(bucket, subject, windowSec) {
  const config = getKvConfig();
  if (!config) {
    return consumeFallback(bucket, subject, windowSec);
  }

  const key = `${RATE_LIMIT_PREFIX}${bucket}:${subject}`;
  const countPayload = await requestRedis(["INCR", key]);
  const count = Number(countPayload?.result || 0);

  if (count === 1) {
    await requestRedis(["EXPIRE", key, String(windowSec)]);
  }

  return {
    count,
    expiresAt: Date.now() + windowSec * 1000,
  };
}

async function checkRateLimit(options) {
  const bucket = String(options.bucket || "default");
  const limit = Math.max(1, Number(options.limit) || 60);
  const windowSec = Math.max(1, Number(options.windowSec) || 60);
  const subject = String(options.subject || "unknown");
  const state = await consumeRateLimit(bucket, subject, windowSec);

  return {
    allowed: state.count <= limit,
    count: state.count,
    limit,
    windowSec,
    remaining: Math.max(0, limit - state.count),
  };
}

async function enforceRateLimit(req, res, options) {
  const subject = String(options.subject || getClientIp(req));
  const message = options.message || "Too many requests. Please try again later.";
  const state = await checkRateLimit({
    ...options,
    subject,
  });

  res.setHeader("X-RateLimit-Limit", String(state.limit));
  res.setHeader("X-RateLimit-Remaining", String(state.remaining));
  res.setHeader("X-RateLimit-Window", String(state.windowSec));

  if (!state.allowed) {
    logSecurityEvent("warn", "rate-limit-blocked", {
      bucket: String(options.bucket || "default"),
      subject: maskValue(subject),
      limit: state.limit,
      windowSec: state.windowSec,
      count: state.count,
    });
    res.setHeader("Retry-After", String(state.windowSec));
    res.status(429).json({ error: message });
    return false;
  }

  return true;
}

module.exports = {
  checkRateLimit,
  enforceRateLimit,
  getClientIp,
};
