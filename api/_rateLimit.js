const RATE_LIMIT_PREFIX = "matpick:rate-limit:";
const { createHash } = require("node:crypto");
const { isIP } = require("node:net");
const MAX_FALLBACK_ENTRIES = 10000;
function storageUnavailable() {
  return Object.assign(new Error("Rate limit storage is unavailable."), { statusCode: 503 });
}
function isDeployed() {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}
const FALLBACK_STORE = globalThis.__MATPICK_RATE_LIMIT_STORE__ || new Map();
const { logSecurityEvent, maskValue } = require("./_securityLog");

if (!globalThis.__MATPICK_RATE_LIMIT_STORE__) {
  globalThis.__MATPICK_RATE_LIMIT_STORE__ = FALLBACK_STORE;
}

function getKvConfig() {
  const candidates = [
    [process.env.KV_REST_API_URL, process.env.KV_REST_API_TOKEN],
    [process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN],
  ].map(pair => pair.map(value => String(value || "").trim()));
  if (candidates.some(([url, token]) => Boolean(url) !== Boolean(token))) throw storageUnavailable();
  const pair = candidates.find(([url, token]) => url && token);
  const [url, token] = pair || ["", ""];

  if (!url || !token) {
    if (isDeployed()) throw storageUnavailable();
    return null;
  }

  try {
    const endpoint = new URL(url);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password ||
        endpoint.search || endpoint.hash) throw storageUnavailable();
  } catch {
    throw storageUnavailable();
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
  // Vercel supplies its own forwarding header. Prefer it over the generic
  // header so a caller cannot choose a new rate-limit identity per request.
  const trusted = process.env.VERCEL === "1"
    ? vercelForwardedFor
    : (isDeployed() ? req.socket?.remoteAddress : (forwardedFor || realIp || req.socket?.remoteAddress)) || "";
  const candidate = String(trusted)
    .split(",")
    .map((value) => value.trim())
    .find(Boolean);

  if (!candidate || !isIP(candidate)) return "unknown";
  // Canonicalize IPv6 spelling so equivalent addresses share one counter.
  if (isIP(candidate) === 6) return new URL(`http://[${candidate}]/`).hostname.slice(1, -1);
  return candidate;
}

async function requestRedis(command) {
  const config = getKvConfig();
  if (!config) {
    return null;
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(5000),
    redirect: "error",
  });

  if (!response.ok) {
    throw new Error(`Rate limit store request failed: ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) throw new Error("Rate limit store command failed");
  return payload;
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
    if (FALLBACK_STORE.size >= MAX_FALLBACK_ENTRIES) {
      for (const [entryKey, entry] of FALLBACK_STORE) {
        if (entry.expiresAt <= now) FALLBACK_STORE.delete(entryKey);
      }
      // Do not evict active limits to make room for arbitrary new identities.
      if (FALLBACK_STORE.size >= MAX_FALLBACK_ENTRIES) {
        return { count: Number.MAX_SAFE_INTEGER, expiresAt };
      }
    }
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

  const identity = createHash("sha256").update(subject).digest("hex");
  const key = `${RATE_LIMIT_PREFIX}${bucket}:${identity}`;
  // Increment and expiry must be one operation; a crash after INCR must not
  // leave a permanent limit. Also repair keys created by the old implementation.
  const script = "local n=redis.call('INCR',KEYS[1]); if redis.call('TTL',KEYS[1])<0 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n";
  const countPayload = await requestRedis(["EVAL", script, 1, key, windowSec]);
  const count = Number(countPayload?.result);
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("Invalid rate limit state");

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
  let state;
  try {
    state = await checkRateLimit({ ...options, subject });
  } catch {
    return rejectUnavailable(res);
  }

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

async function enforceRateLimits(req, res, policies) {
  const subject = getClientIp(req);
  let checks;
  try {
    checks = await Promise.all(policies.map(async (policy) => ({
      policy,
      state: await checkRateLimit({ ...policy, subject: String(policy.subject || subject) }),
    })));
  } catch {
    return rejectUnavailable(res);
  }
  const blocked = checks.find(({ state }) => !state.allowed);
  const displayed = blocked || checks[0];

  if (displayed) {
    res.setHeader("X-RateLimit-Limit", String(displayed.state.limit));
    res.setHeader("X-RateLimit-Remaining", String(displayed.state.remaining));
    res.setHeader("X-RateLimit-Window", String(displayed.state.windowSec));
  }
  if (!blocked) return true;

  logSecurityEvent("warn", "rate-limit-blocked", {
    bucket: String(blocked.policy.bucket || "default"),
    subject: maskValue(String(blocked.policy.subject || subject)),
    limit: blocked.state.limit,
    windowSec: blocked.state.windowSec,
    count: blocked.state.count,
  });
  res.setHeader("Retry-After", String(blocked.state.windowSec));
  res.status(429).json({
    error: blocked.policy.message || "Too many requests. Please try again later.",
  });
  return false;
}

function rejectUnavailable(res) {
  // No credentials, raw provider errors, addresses or request bodies in logs.
  logSecurityEvent("error", "rate-limit-storage-unavailable");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Retry-After", "60");
  res.status(503).json({ error: "Service temporarily unavailable. Please try again later." });
  return false;
}

module.exports = {
  checkRateLimit,
  enforceRateLimit,
  enforceRateLimits,
  getClientIp,
};
