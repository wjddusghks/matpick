const crypto = require("node:crypto");
const { normalizeAgeProfile } = require("./_ageProfile");

const SESSION_COOKIE = "__Host-matpick_session";
const OAUTH_COOKIE = "__Host-matpick_oauth";
const SESSION_KEY_PREFIX = "matpick:session:";
const OAUTH_KEY_PREFIX = "matpick:oauth:";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const OAUTH_TTL_SECONDS = 60 * 10;

class SessionStoreUnavailableError extends Error {
  constructor(message = "Session storage is unavailable") {
    super(message);
    this.name = "SessionStoreUnavailableError";
    this.status = 503;
  }
}

function getRedisConfig() {
  const candidates = [
    [process.env.KV_REST_API_URL, process.env.KV_REST_API_TOKEN],
    [process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN],
  ];
  const normalized = candidates.map(([url, token]) => [
    String(url || "").trim(),
    String(token || "").trim(),
  ]);
  const configured = normalized.filter(([url, token]) => url || token);
  if (configured.some(([url, token]) => !url || !token)) {
    throw new SessionStoreUnavailableError();
  }
  if (!configured.length) return null;

  const [rawUrl, token] = configured[0];
  try {
    const url = new URL(String(rawUrl));
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error("Invalid Redis REST URL");
    }
    return { url: url.href.replace(/\/$/, ""), token };
  } catch {
    throw new SessionStoreUnavailableError();
  }
}

async function requestRedis(command) {
  const config = getRedisConfig();
  if (!config) throw new SessionStoreUnavailableError();
  let response;
  try {
    response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new SessionStoreUnavailableError();
  }
  if (!response.ok) throw new SessionStoreUnavailableError();
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new SessionStoreUnavailableError();
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    !Object.prototype.hasOwnProperty.call(payload, "result") ||
    payload.error
  ) {
    throw new SessionStoreUnavailableError();
  }
  return payload?.result;
}

function requireSetResult(result) {
  if (result !== "OK") throw new SessionStoreUnavailableError();
}

function requireDeleteResult(result) {
  if (!Number.isInteger(result) || result < 0) {
    throw new SessionStoreUnavailableError();
  }
}

function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function key(prefix, token) {
  const digest = crypto.createHash("sha256").update(token).digest("hex");
  return `${prefix}${digest}`;
}

function parseCookies(req) {
  const value = Array.isArray(req.headers?.cookie)
    ? req.headers.cookie[0]
    : req.headers?.cookie || "";
  const cookies = {};
  for (const item of String(value).split(";")) {
    const index = item.indexOf("=");
    if (index < 1) continue;
    const name = item.slice(0, index).trim();
    const raw = item.slice(index + 1).trim();
    try {
      cookies[name] = decodeURIComponent(raw);
    } catch {
      cookies[name] = "";
    }
  }
  return cookies;
}

function isOpaqueToken(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{40,64}$/.test(value);
}

function appendSetCookie(res, value) {
  const previous =
    typeof res.getHeader === "function" ? res.getHeader("Set-Cookie") : null;
  const values = previous
    ? Array.isArray(previous)
      ? [...previous, value]
      : [previous, value]
    : [value];
  res.setHeader("Set-Cookie", values);
}

function setCookie(res, name, value, maxAge) {
  appendSetCookie(
    res,
    `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`,
  );
}

function clearCookie(res, name) {
  setCookie(res, name, "", 0);
}

function publicUser(user) {
  if (!user?.id || !user?.provider) return null;
  return {
    id: String(user.id),
    name: String(user.name || ""),
    email: String(user.email || ""),
    profileImage: String(user.profileImage || ""),
    provider: String(user.provider),
    nickname: String(user.nickname || ""),
    consentAcceptedAt: Number(user.consentAcceptedAt) || undefined,
    allowLocationPersonalization: Boolean(user.allowLocationPersonalization),
    ageProfile: normalizeAgeProfile(user.ageProfile),
  };
}

async function createSession(req, res, user) {
  const safeUser = publicUser(user);
  if (!safeUser) throw new Error("Invalid session user");
  const previousToken = parseCookies(req)[SESSION_COOKIE];
  if (isOpaqueToken(previousToken)) {
    const deleted = await requestRedis([
      "DEL",
      key(SESSION_KEY_PREFIX, previousToken),
    ]);
    requireDeleteResult(deleted);
  }
  const token = randomToken();
  const now = Date.now();
  const session = {
    version: 1,
    user: safeUser,
    createdAt: now,
    expiresAt: now + SESSION_TTL_SECONDS * 1000,
  };
  const result = await requestRedis([
    "SET",
    key(SESSION_KEY_PREFIX, token),
    JSON.stringify(session),
    "EX",
    SESSION_TTL_SECONDS,
  ]);
  requireSetResult(result);
  setCookie(res, SESSION_COOKIE, token, SESSION_TTL_SECONDS);
  return session;
}

async function readSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!isOpaqueToken(token)) return null;
  const stored = await requestRedis(["GET", key(SESSION_KEY_PREFIX, token)]);
  if (stored === null) return null;
  if (typeof stored !== "string") throw new SessionStoreUnavailableError();
  try {
    const session = JSON.parse(stored);
    if (
      session?.version !== 1 ||
      !publicUser(session.user) ||
      !Number.isFinite(session.expiresAt) ||
      session.expiresAt <= Date.now()
    ) {
      throw new SessionStoreUnavailableError();
    }
    return { ...session, user: publicUser(session.user) };
  } catch (error) {
    if (error instanceof SessionStoreUnavailableError) throw error;
    throw new SessionStoreUnavailableError();
  }
}

async function revokeSession(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (isOpaqueToken(token)) {
    const result = await requestRedis(["DEL", key(SESSION_KEY_PREFIX, token)]);
    requireDeleteResult(result);
  }
  clearCookie(res, SESSION_COOKIE);
}

async function createOAuthTransaction(res, transaction) {
  const cookieToken = randomToken();
  const state = randomToken();
  const result = await requestRedis([
    "SET",
    key(OAUTH_KEY_PREFIX, cookieToken),
    JSON.stringify({
      version: 1,
      state,
      provider: transaction.provider,
      redirectUri: transaction.redirectUri,
      createdAt: Date.now(),
    }),
    "EX",
    OAUTH_TTL_SECONDS,
  ]);
  requireSetResult(result);
  setCookie(res, OAUTH_COOKIE, cookieToken, OAUTH_TTL_SECONDS);
  return state;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function consumeOAuthTransaction(req, res, { provider, state }) {
  const cookieToken = parseCookies(req)[OAUTH_COOKIE];
  clearCookie(res, OAUTH_COOKIE);
  if (!isOpaqueToken(cookieToken)) return null;
  const redisKey = key(OAUTH_KEY_PREFIX, cookieToken);
  const stored = await requestRedis(["GETDEL", redisKey]);
  if (stored === null) return null;
  if (typeof stored !== "string") throw new SessionStoreUnavailableError();
  try {
    const transaction = JSON.parse(stored);
    const createdAt = Number(transaction?.createdAt);
    const now = Date.now();
    if (
      transaction?.version !== 1 ||
      transaction.provider !== provider ||
      !safeEqual(transaction.state, state) ||
      !Number.isFinite(createdAt) ||
      createdAt > now ||
      now - createdAt > OAUTH_TTL_SECONDS * 1000
    ) {
      return null;
    }
    return transaction;
  } catch (error) {
    if (error instanceof SyntaxError) throw new SessionStoreUnavailableError();
    return null;
  }
}

module.exports = {
  OAUTH_COOKIE,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  SessionStoreUnavailableError,
  consumeOAuthTransaction,
  createOAuthTransaction,
  createSession,
  publicUser,
  readSession,
  revokeSession,
};
