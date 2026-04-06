const crypto = require("node:crypto");

const PROFILE_KEY_PREFIX = "matpick:auth-profile:";
const SYNC_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const ALLOW_LEGACY_SYNC_TOKEN = process.env.AUTH_ALLOW_LEGACY_SYNC_TOKEN !== "0";

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

function getSigningSecret() {
  return (
    process.env.AUTH_PROFILE_SIGNING_SECRET ||
    process.env.NAVER_LOGIN_CLIENT_SECRET ||
    process.env.KAKAO_CLIENT_SECRET ||
    ""
  );
}

function getProfileKey(userId) {
  return `${PROFILE_KEY_PREFIX}${userId}`;
}

function createLegacyProfileSyncToken(userId) {
  const secret = getSigningSecret();
  if (!secret || !userId) {
    return "";
  }

  return crypto.createHmac("sha256", secret).update(String(userId)).digest("hex");
}

function signSyncPayload(encodedPayload) {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function isSafeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
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
    throw new Error(`Profile store request failed: ${response.status}`);
  }

  return response.json();
}

function normalizeStoredProfile(values) {
  if (!Array.isArray(values) || values.length < 3 || values.every((value) => value == null)) {
    return null;
  }

  const [nickname, consentAcceptedAt, allowLocationPersonalization] = values;
  if (!nickname || !consentAcceptedAt) {
    return null;
  }

  return {
    nickname: String(nickname),
    consentAcceptedAt: Number(consentAcceptedAt),
    allowLocationPersonalization: String(allowLocationPersonalization) === "1",
  };
}

async function readRemoteProfile(userId) {
  const config = getKvConfig();
  if (!config || !userId) {
    return null;
  }

  const payload = await requestRedis([
    "HMGET",
    getProfileKey(userId),
    "nickname",
    "consentAcceptedAt",
    "allowLocationPersonalization",
  ]);

  return normalizeStoredProfile(payload?.result);
}

async function writeRemoteProfile(userId, profile) {
  const config = getKvConfig();
  if (!config || !userId || !profile?.nickname || !profile?.consentAcceptedAt) {
    return false;
  }

  await requestRedis([
    "HSET",
    getProfileKey(userId),
    "nickname",
    profile.nickname,
    "consentAcceptedAt",
    String(profile.consentAcceptedAt),
    "allowLocationPersonalization",
    profile.allowLocationPersonalization ? "1" : "0",
    "updatedAt",
    String(Date.now()),
  ]);

  return true;
}

function createProfileSyncToken(userId, options = {}) {
  const secret = getSigningSecret();
  if (!secret || !userId) {
    return "";
  }

  const ttlSeconds = Math.max(
    60,
    Number.isFinite(options.ttlSeconds) ? Number(options.ttlSeconds) : SYNC_TOKEN_TTL_SECONDS
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 2,
    uid: String(userId),
    iat: now,
    exp: now + ttlSeconds,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signSyncPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

function validateProfileSyncToken(userId, token) {
  const secret = getSigningSecret();
  if (!secret || !userId || !token) {
    return { valid: false, version: null, reason: "missing" };
  }

  const stringToken = String(token).trim();
  const [encodedPayload, signature] = stringToken.split(".");

  if (encodedPayload && signature) {
    const expectedSignature = signSyncPayload(encodedPayload);
    if (!isSafeEqual(expectedSignature, signature)) {
      return { valid: false, version: "v2", reason: "bad-signature" };
    }

    try {
      const payload = JSON.parse(
        Buffer.from(encodedPayload, "base64url").toString("utf8")
      );
      const now = Math.floor(Date.now() / 1000);

      if (payload?.uid !== String(userId)) {
        return { valid: false, version: "v2", reason: "wrong-user" };
      }

      if (!Number.isFinite(payload?.exp)) {
        return { valid: false, version: "v2", reason: "missing-exp" };
      }

      if (Number(payload.exp) <= now) {
        return { valid: false, version: "v2", reason: "expired" };
      }

      return {
        valid: true,
        version: "v2",
        reason: "ok",
        issuedAt: Number(payload?.iat || 0) || null,
        expiresAt: Number(payload.exp),
      };
    } catch {
      return { valid: false, version: "v2", reason: "invalid-payload" };
    }
  }

  if (!ALLOW_LEGACY_SYNC_TOKEN) {
    return { valid: false, version: "legacy", reason: "legacy-disabled" };
  }

  // Temporary compatibility path so already logged-in users are not logged out immediately.
  const legacyExpected = createLegacyProfileSyncToken(userId);
  const valid = isSafeEqual(legacyExpected, stringToken);
  return {
    valid,
    version: "legacy",
    reason: valid ? "ok" : "bad-legacy-token",
  };
}

function isValidProfileSyncToken(userId, token) {
  return validateProfileSyncToken(userId, token).valid;
}

module.exports = {
  createProfileSyncToken,
  isValidProfileSyncToken,
  validateProfileSyncToken,
  readRemoteProfile,
  writeRemoteProfile,
};
