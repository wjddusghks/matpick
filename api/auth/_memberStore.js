const MEMBER_KEY_PREFIX = "matpick:members:user:";
const MEMBER_INDEX_KEY = "matpick:members:index";
const MEMBER_DAY_PREFIX = "matpick:members:day:";
const FALLBACK_STORE = globalThis.__MATPICK_MEMBER_STORE__ || {
  members: new Map(),
  days: new Map(),
};

if (!globalThis.__MATPICK_MEMBER_STORE__) {
  globalThis.__MATPICK_MEMBER_STORE__ = FALLBACK_STORE;
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
    throw new Error(`Member store request failed: ${response.status}`);
  }

  return response.json();
}

function getKoreaDay(timestamp = Date.now()) {
  return new Date(timestamp + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getMemberKey(userId) {
  return `${MEMBER_KEY_PREFIX}${userId}`;
}

function getDayKeys(day) {
  const prefix = `${MEMBER_DAY_PREFIX}${day}`;
  return {
    counts: `${prefix}:counts`,
    activeUsers: `${prefix}:active-users`,
  };
}

function inferProvider(userId) {
  const value = String(userId || "");
  if (value.startsWith("kakao_")) {
    return "kakao";
  }
  if (value.startsWith("naver_")) {
    return "naver";
  }
  return "unknown";
}

function sanitizeText(value, fallback = "", maxLength = 240) {
  if (value == null) {
    return fallback;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, maxLength);
}

function storeText(value, maxLength = 240) {
  return sanitizeText(value, "", maxLength) || "__empty__";
}

function readText(value, fallback = "", maxLength = 240) {
  const text = sanitizeText(value, fallback, maxLength);
  return text === "__empty__" ? "" : text;
}

function normalizeBoolean(value) {
  return value === true || value === "1" || value === "true";
}

function normalizeTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
}

function hashToObject(values) {
  if (!Array.isArray(values)) {
    return values && typeof values === "object" ? values : {};
  }

  const output = {};
  for (let index = 0; index < values.length; index += 2) {
    output[String(values[index])] = values[index + 1];
  }
  return output;
}

function normalizeMember(input) {
  const raw = hashToObject(input);
  const id = sanitizeText(raw.id);
  if (!id) {
    return null;
  }

  const firstSeenAt = normalizeTimestamp(raw.firstSeenAt);
  const signupCompletedAt = normalizeTimestamp(raw.signupCompletedAt);
  const lastLoginAt = normalizeTimestamp(raw.lastLoginAt);

  return {
    id,
    provider: sanitizeText(raw.provider, inferProvider(id), 24),
    name: sanitizeText(raw.name, "이름 없음", 80),
    email: readText(raw.email, "", 160),
    nickname: readText(raw.nickname, "", 40),
    profileImage: readText(raw.profileImage, "", 400),
    firstSeenAt,
    firstSeenDay: readText(raw.firstSeenDay, firstSeenAt ? getKoreaDay(firstSeenAt) : "", 16),
    signupCompletedAt,
    signupCompletedDay: readText(
      raw.signupCompletedDay,
      signupCompletedAt ? getKoreaDay(signupCompletedAt) : "",
      16
    ),
    lastLoginAt,
    lastLoginDay: readText(raw.lastLoginDay, lastLoginAt ? getKoreaDay(lastLoginAt) : "", 16),
    loginCount: Number(raw.loginCount || 0) || 0,
    allowLocationPersonalization: normalizeBoolean(raw.allowLocationPersonalization),
  };
}

function ensureFallbackDay(day) {
  const existing = FALLBACK_STORE.days.get(day);
  if (existing) {
    return existing;
  }

  const next = {
    firstSeen: 0,
    completed: 0,
    logins: 0,
    activeUsers: new Set(),
  };
  FALLBACK_STORE.days.set(day, next);
  return next;
}

async function expireDayKeys(keys) {
  await Promise.all(
    Object.values(keys).map((key) => requestRedis(["EXPIRE", key, String(60 * 60 * 24 * 180)]))
  );
}

async function recordFallbackAuthMember(user) {
  const now = Date.now();
  const day = getKoreaDay(now);
  const id = sanitizeText(user.id);
  if (!id) {
    return false;
  }

  const current = FALLBACK_STORE.members.get(id);
  const isNew = !current;
  const next = {
    ...(current || {}),
    id,
    provider: sanitizeText(user.provider, inferProvider(id), 24),
    name: sanitizeText(user.name, current?.name || "이름 없음", 80),
    email: sanitizeText(user.email, current?.email || "", 160),
    profileImage: sanitizeText(user.profileImage, current?.profileImage || "", 400),
    nickname: sanitizeText(user.nickname, current?.nickname || "", 40),
    firstSeenAt: current?.firstSeenAt || now,
    firstSeenDay: current?.firstSeenDay || day,
    lastLoginAt: now,
    lastLoginDay: day,
    loginCount: Number(current?.loginCount || 0) + 1,
    signupCompletedAt: current?.signupCompletedAt || user.consentAcceptedAt || 0,
    signupCompletedDay:
      current?.signupCompletedDay ||
      (user.consentAcceptedAt ? getKoreaDay(user.consentAcceptedAt) : ""),
    allowLocationPersonalization: Boolean(
      user.allowLocationPersonalization ?? current?.allowLocationPersonalization
    ),
  };

  FALLBACK_STORE.members.set(id, next);
  const dayStore = ensureFallbackDay(day);
  dayStore.logins += 1;
  dayStore.activeUsers.add(id);
  if (isNew) {
    dayStore.firstSeen += 1;
  }
  return true;
}

async function recordKvAuthMember(user) {
  const now = Date.now();
  const day = getKoreaDay(now);
  const id = sanitizeText(user.id);
  if (!id) {
    return false;
  }

  const key = getMemberKey(id);
  const existingPayload = await requestRedis(["HMGET", key, "firstSeenAt", "signupCompletedAt"]);
  const [existingFirstSeenAt, existingSignupCompletedAt] = Array.isArray(
    existingPayload?.result
  )
    ? existingPayload.result
    : [];
  const isNew = !existingFirstSeenAt;
  const signupCompletedAt =
    normalizeTimestamp(existingSignupCompletedAt) || normalizeTimestamp(user.consentAcceptedAt);
  const signupCompletedDay = signupCompletedAt ? getKoreaDay(signupCompletedAt) : "";
  const dayKeys = getDayKeys(day);

  await Promise.all([
    requestRedis(["SADD", MEMBER_INDEX_KEY, id]),
    requestRedis([
      "HSET",
      key,
      "id",
      id,
      "provider",
      sanitizeText(user.provider, inferProvider(id), 24),
      "name",
      sanitizeText(user.name, "이름 없음", 80),
      "email",
      storeText(user.email, 160),
      "profileImage",
      storeText(user.profileImage, 400),
      "nickname",
      storeText(user.nickname, 40),
      "firstSeenAt",
      String(existingFirstSeenAt || now),
      "firstSeenDay",
      existingFirstSeenAt ? getKoreaDay(Number(existingFirstSeenAt)) : day,
      "lastLoginAt",
      String(now),
      "lastLoginDay",
      day,
      "signupCompletedAt",
      signupCompletedAt ? String(signupCompletedAt) : "0",
      "signupCompletedDay",
      storeText(signupCompletedDay, 16),
      "allowLocationPersonalization",
      user.allowLocationPersonalization ? "1" : "0",
    ]),
    requestRedis(["HINCRBY", key, "loginCount", "1"]),
    requestRedis(["HINCRBY", dayKeys.counts, "logins", "1"]),
    requestRedis(["SADD", dayKeys.activeUsers, id]),
    ...(isNew ? [requestRedis(["HINCRBY", dayKeys.counts, "firstSeen", "1"])] : []),
  ]);

  await expireDayKeys(dayKeys);
  return true;
}

async function recordAuthMember(user) {
  if (getKvConfig()) {
    return recordKvAuthMember(user);
  }

  return recordFallbackAuthMember(user);
}

async function recordFallbackMemberProfileCompletion(userId, profile) {
  const id = sanitizeText(userId);
  if (!id) {
    return false;
  }

  const current = FALLBACK_STORE.members.get(id) || {
    id,
    provider: inferProvider(id),
    name: "이름 없음",
    firstSeenAt: Date.now(),
    firstSeenDay: getKoreaDay(),
    loginCount: 0,
  };
  const completedAt = current.signupCompletedAt || profile.consentAcceptedAt || Date.now();
  const completedDay = getKoreaDay(completedAt);
  const wasCompleted = Boolean(current.signupCompletedAt);

  FALLBACK_STORE.members.set(id, {
    ...current,
    nickname: sanitizeText(profile.nickname, current.nickname || "", 40),
    signupCompletedAt: completedAt,
    signupCompletedDay: completedDay,
    allowLocationPersonalization: Boolean(profile.allowLocationPersonalization),
  });

  if (!wasCompleted) {
    ensureFallbackDay(completedDay).completed += 1;
  }

  return true;
}

async function recordKvMemberProfileCompletion(userId, profile) {
  const id = sanitizeText(userId);
  if (!id) {
    return false;
  }

  const key = getMemberKey(id);
  const payload = await requestRedis(["HMGET", key, "signupCompletedAt", "firstSeenAt"]);
  const [existingSignupCompletedAt, existingFirstSeenAt] = Array.isArray(payload?.result)
    ? payload.result
    : [];
  const wasCompleted = normalizeTimestamp(existingSignupCompletedAt) > 0;
  const completedAt =
    normalizeTimestamp(existingSignupCompletedAt) ||
    normalizeTimestamp(profile.consentAcceptedAt) ||
    Date.now();
  const completedDay = getKoreaDay(completedAt);
  const firstSeenAt = normalizeTimestamp(existingFirstSeenAt) || completedAt;
  const firstSeenDay = getKoreaDay(firstSeenAt);
  const dayKeys = getDayKeys(completedDay);

  await Promise.all([
    requestRedis(["SADD", MEMBER_INDEX_KEY, id]),
    requestRedis([
      "HSET",
      key,
      "id",
      id,
      "provider",
      inferProvider(id),
      "firstSeenAt",
      String(firstSeenAt),
      "firstSeenDay",
      firstSeenDay,
      "nickname",
      storeText(profile.nickname, 40),
      "signupCompletedAt",
      String(completedAt),
      "signupCompletedDay",
      completedDay,
      "allowLocationPersonalization",
      profile.allowLocationPersonalization ? "1" : "0",
    ]),
    ...(wasCompleted
      ? []
      : [requestRedis(["HINCRBY", dayKeys.counts, "completed", "1"])]),
  ]);

  await expireDayKeys(dayKeys);
  return true;
}

async function recordMemberProfileCompletion(userId, profile) {
  if (getKvConfig()) {
    return recordKvMemberProfileCompletion(userId, profile);
  }

  return recordFallbackMemberProfileCompletion(userId, profile);
}

function countMembers(members, today) {
  return members.reduce(
    (summary, member) => {
      summary.totalMembers += 1;
      if (member.signupCompletedAt) {
        summary.completedMembers += 1;
      }
      if (member.provider === "naver") {
        summary.naverMembers += 1;
      }
      if (member.provider === "kakao") {
        summary.kakaoMembers += 1;
      }
      if (member.firstSeenDay === today) {
        summary.firstSeenToday += 1;
      }
      if (member.signupCompletedDay === today) {
        summary.completedToday += 1;
      }
      if (member.lastLoginDay === today) {
        summary.activeToday += 1;
      }
      return summary;
    },
    {
      totalMembers: 0,
      completedMembers: 0,
      naverMembers: 0,
      kakaoMembers: 0,
      firstSeenToday: 0,
      completedToday: 0,
      activeToday: 0,
      loginsToday: 0,
    }
  );
}

async function readFallbackMembersDashboard() {
  const today = getKoreaDay();
  const members = Array.from(FALLBACK_STORE.members.values())
    .map(normalizeMember)
    .filter(Boolean)
    .sort((left, right) => (right.firstSeenAt || 0) - (left.firstSeenAt || 0));
  const summary = countMembers(members, today);
  const day = ensureFallbackDay(today);
  summary.loginsToday = day.logins;
  summary.activeToday = day.activeUsers.size;

  return {
    day: today,
    storage: "memory",
    summary,
    members,
  };
}

async function readKvMembersDashboard() {
  const today = getKoreaDay();
  const memberIdsPayload = await requestRedis(["SMEMBERS", MEMBER_INDEX_KEY]);
  const memberIds = Array.isArray(memberIdsPayload?.result) ? memberIdsPayload.result : [];
  const rawMembers = await Promise.all(
    memberIds.slice(0, 500).map(async (id) => {
      const payload = await requestRedis(["HGETALL", getMemberKey(id)]);
      return normalizeMember(payload?.result);
    })
  );
  const members = rawMembers
    .filter(Boolean)
    .sort((left, right) => (right.firstSeenAt || 0) - (left.firstSeenAt || 0));
  const summary = countMembers(members, today);
  const dayKeys = getDayKeys(today);
  const [dayCountsPayload, activeTodayPayload] = await Promise.all([
    requestRedis(["HGETALL", dayKeys.counts]),
    requestRedis(["SCARD", dayKeys.activeUsers]),
  ]);
  const dayCounts = hashToObject(dayCountsPayload?.result);
  summary.firstSeenToday = Number(dayCounts.firstSeen || summary.firstSeenToday || 0);
  summary.completedToday = Number(dayCounts.completed || summary.completedToday || 0);
  summary.loginsToday = Number(dayCounts.logins || 0);
  summary.activeToday = Number(activeTodayPayload?.result || summary.activeToday || 0);

  return {
    day: today,
    storage: "kv",
    summary,
    members,
  };
}

async function readMembersDashboard() {
  if (getKvConfig()) {
    return readKvMembersDashboard();
  }

  return readFallbackMembersDashboard();
}

module.exports = {
  readMembersDashboard,
  recordAuthMember,
  recordMemberProfileCompletion,
};
