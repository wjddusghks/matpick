const PROFILE_KEY_PREFIX = "matpick:auth-profile:";

function getKvConfig() {
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

  if (!url || !token) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ""),
    token,
  };
}

function getProfileKey(userId) {
  return `${PROFILE_KEY_PREFIX}${userId}`;
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
  });

  if (!response.ok) {
    throw new Error(`Profile store request failed: ${response.status}`);
  }

  const payload = await response.json();
  if (payload?.error) throw new Error("Storage command failed");
  return payload;
}

function normalizeStoredProfile(values) {
  if (
    !Array.isArray(values) ||
    values.length < 3 ||
    values.every((value) => value == null)
  ) {
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

module.exports = {
  readRemoteProfile,
  writeRemoteProfile,
};
