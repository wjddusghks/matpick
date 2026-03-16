const crypto = require("node:crypto");

const PROFILE_KEY_PREFIX = "matpick:auth-profile:";

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

function createProfileSyncToken(userId) {
  const secret = getSigningSecret();
  if (!secret || !userId) {
    return "";
  }

  return crypto.createHmac("sha256", secret).update(String(userId)).digest("hex");
}

function isValidProfileSyncToken(userId, token) {
  const secret = getSigningSecret();
  if (!secret || !userId || !token) {
    return false;
  }

  const expected = createProfileSyncToken(userId);

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(token)));
  } catch {
    return false;
  }
}

module.exports = {
  createProfileSyncToken,
  isValidProfileSyncToken,
  readRemoteProfile,
  writeRemoteProfile,
};
