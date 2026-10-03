const crypto = require("node:crypto");

const ANALYTICS_PREFIX = "matpick:analytics";
const ACTIVATION_STATE_TTL_SECONDS = 60 * 60 * 24 * 45;
const FALLBACK_STORE = globalThis.__MATPICK_ANALYTICS_STORE__ || new Map();

if (!globalThis.__MATPICK_ANALYTICS_STORE__) {
  globalThis.__MATPICK_ANALYTICS_STORE__ = FALLBACK_STORE;
}

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
    throw new Error(`Analytics store request failed: ${response.status}`);
  }

  return response.json();
}

function getKoreaDay(timestamp = Date.now()) {
  return new Date(timestamp + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getDayKeys(day) {
  const keyPrefix = `${ANALYTICS_PREFIX}:day:${day}`;
  return {
    counts: `${keyPrefix}:counts`,
    visitors: `${keyPrefix}:visitors`,
    sessions: `${keyPrefix}:sessions`,
    paths: `${keyPrefix}:paths`,
    searches: `${keyPrefix}:searches`,
    events: `${keyPrefix}:events`,
    clicks: `${keyPrefix}:clicks`,
    campaigns: `${keyPrefix}:campaigns`,
    campaignActivations: `${keyPrefix}:campaign-activations`,
    geography: `${keyPrefix}:geography`,
    countries: `${keyPrefix}:countries`,
  };
}

function getAllKeys() {
  const keyPrefix = `${ANALYTICS_PREFIX}:all`;
  return {
    counts: `${keyPrefix}:counts`,
    visitors: `${keyPrefix}:visitors`,
    sessions: `${keyPrefix}:sessions`,
    paths: `${keyPrefix}:paths`,
    searches: `${keyPrefix}:searches`,
    events: `${keyPrefix}:events`,
    clicks: `${keyPrefix}:clicks`,
    campaigns: `${keyPrefix}:campaigns`,
    campaignActivations: `${keyPrefix}:campaign-activations`,
    geography: `${keyPrefix}:geography`,
    countries: `${keyPrefix}:countries`,
  };
}

function normalizeSummaryOptions(options) {
  if (typeof options === "string") {
    return {
      day: options || getKoreaDay(),
      scope: "today",
    };
  }

  const scope = options?.scope === "all" ? "all" : "today";
  const day =
    typeof options?.day === "string" && options.day.trim()
      ? options.day.trim()
      : getKoreaDay();
  return { day, scope };
}

function getSummaryKeys(scope, day) {
  return scope === "all" ? getAllKeys() : getDayKeys(day);
}

function hashIdentity(value) {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex")
    .slice(0, 32);
}

function sanitizeText(value, fallback = "", maxLength = 160) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, maxLength);
}

function sanitizePath(value) {
  const path = sanitizeText(value, "/", 2000).split(/[?#]/, 1)[0];
  if (!path.startsWith("/")) {
    return "/";
  }

  return path.slice(0, 220) || "/";
}

function sanitizeEventName(value) {
  return sanitizeText(value, "unknown", 80).replace(/[^\w:.-]+/g, "_");
}

function sanitizeProvider(value) {
  const provider = sanitizeText(value, "unknown", 40).toLowerCase();
  if (["adsense", "adfit", "kakao", "coupang"].includes(provider)) {
    return provider === "kakao" ? "adfit" : provider;
  }

  return "unknown";
}

function normalizeDuration(value) {
  const durationMs = Number(value);
  if (!Number.isFinite(durationMs) || durationMs < 1000) {
    return 0;
  }

  return Math.min(Math.round(durationMs), 30 * 60 * 1000);
}

function normalizeCountryCode(value) {
  const countryCode = sanitizeText(value, "", 2).toUpperCase();
  return /^[A-Z]{2}$/.test(countryCode) && countryCode !== "XX"
    ? countryCode
    : "";
}

function normalizeEvent(input, context = {}) {
  const type = sanitizeEventName(input?.type);
  const path = sanitizePath(input?.path);
  const visitorId = sanitizeText(input?.visitorId, "", 120);
  const sessionId = sanitizeText(input?.sessionId, "", 120);
  const provider = sanitizeProvider(input?.provider);
  const name = sanitizeEventName(input?.name || input?.eventName || type);
  const query = sanitizeText(input?.query, "", 80).toLowerCase();
  const targetLabel = sanitizeText(
    input?.targetLabel || input?.label || input?.href,
    "",
    140,
  );
  const durationMs = normalizeDuration(input?.durationMs);
  const restaurantIdCandidate = sanitizeText(input?.restaurantId, "", 120);
  const restaurantId = /^[a-zA-Z0-9_:-]{1,120}$/.test(restaurantIdCandidate)
    ? restaurantIdCandidate
    : "";

  return {
    type,
    path,
    visitorId,
    sessionId,
    provider,
    name,
    query,
    targetLabel,
    durationMs,
    restaurantId,
    campaign: campaignFromPath(input?.campaignPath) || campaignFromPath(input?.path),
    countryCode: normalizeCountryCode(context.countryCode),
  };
}

// Only campaign slugs are aggregated, never arbitrary query strings or identities.
function campaignFromPath(path) {
  if (typeof path !== "string" || !path.startsWith("/") || path.length > 2000)
    return "";
  const params = new URL(path, "https://matpick.co.kr").searchParams;
  const slug = (key) => {
    const value = (params.get(key) || "").toLowerCase();
    return /^[a-z0-9_-]{1,80}$/.test(value) ? value : "";
  };
  const source = slug("utm_source");
  if (
    ![
      "instagram",
      "threads",
      "pinterest",
      "naver",
      "naver_blog",
      "kakao",
    ].includes(source)
  )
    return "";
  return [
    source,
    slug("utm_medium") || "social",
    slug("utm_campaign") || "unspecified",
    slug("utm_content") || "unspecified",
  ].join(" / ");
}

function ensureFallbackBucket(bucket) {
  const existing = FALLBACK_STORE.get(bucket);
  if (existing) {
    return existing;
  }

  const next = {
    counts: new Map(),
    visitors: new Set(),
    sessions: new Set(),
    paths: new Map(),
    searches: new Map(),
    events: new Map(),
    clicks: new Map(),
    campaigns: new Map(),
    campaignActivations: new Map(),
    activatedSessions: new Set(),
    sessionRestaurantViews: new Map(),
    geography: new Map(),
    countries: new Map(),
  };
  FALLBACK_STORE.set(bucket, next);
  return next;
}

function incrementMap(map, field, amount = 1) {
  map.set(field, Number(map.get(field) || 0) + amount);
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

function numberFromHash(hash, field) {
  const value = Number(hash?.[field]);
  return Number.isFinite(value) ? value : 0;
}

function entriesFromHash(hash, limit = 8) {
  return Object.entries(hashToObject(hash))
    .map(([label, value]) => ({
      label,
      count: Number(value) || 0,
    }))
    .filter((entry) => entry.count > 0)
    .sort(
      (left, right) =>
        right.count - left.count || left.label.localeCompare(right.label),
    )
    .slice(0, limit);
}

function entriesFromPathHash(hash, limit = 8) {
  const merged = new Map();
  for (const [label, value] of Object.entries(hashToObject(hash))) {
    const count = Number(value) || 0;
    if (count > 0) {
      incrementMap(merged, sanitizePath(label), count);
    }
  }

  return entriesFromHash(Object.fromEntries(merged.entries()), limit);
}

async function expireDayKeys(keys) {
  await Promise.all(
    Object.values(keys).map((key) =>
      requestRedis(["EXPIRE", key, String(60 * 60 * 24 * 45)]),
    ),
  );
}

function applyFallbackEvent(store, event) {
  if (event.visitorId) {
    const visitorHash = hashIdentity(event.visitorId);
    const isNewVisitor = !store.visitors.has(visitorHash);
    store.visitors.add(visitorHash);
    if (isNewVisitor) {
      store.geography ||= new Map();
      store.countries ||= new Map();
      const bucket = event.countryCode
        ? event.countryCode === "KR"
          ? "domestic"
          : "foreign"
        : "unknown";
      incrementMap(store.geography, bucket);
      if (event.countryCode) {
        incrementMap(store.countries, event.countryCode);
      }
    }
  }
  if (event.type === "session_start" && event.sessionId) {
    const isNew = !store.sessions.has(hashIdentity(event.sessionId));
    store.sessions.add(hashIdentity(event.sessionId));
    if (isNew && event.campaign) {
      store.campaigns ||= new Map();
      incrementMap(store.campaigns, event.campaign);
    }
  }

  if (event.type === "page_view") {
    incrementMap(store.counts, "pageViews");
    incrementMap(store.paths, event.path);
  }

  if (event.type === "duration" && event.durationMs > 0) {
    incrementMap(store.counts, "durationMs", event.durationMs);
    incrementMap(store.counts, "durationSamples");
  }

  if (event.type === "map_click") {
    incrementMap(store.counts, "mapClicks");
    incrementMap(store.clicks, event.targetLabel || event.path);
  }

  if (event.type === "search" && event.query) {
    incrementMap(store.counts, "searches");
    incrementMap(store.searches, event.query);
  }

  if (event.type === "marketing_event") {
    incrementMap(store.events, event.name);

    if (event.sessionId && event.campaign) {
      const sessionHash = hashIdentity(event.sessionId);
      let activated = event.name === "directions_click";

      if (event.name === "restaurant_view" && event.restaurantId) {
        store.sessionRestaurantViews ||= new Map();
        const viewedRestaurants = store.sessionRestaurantViews.get(sessionHash) || new Set();
        viewedRestaurants.add(hashIdentity(event.restaurantId));
        store.sessionRestaurantViews.set(sessionHash, viewedRestaurants);
        activated = viewedRestaurants.size >= 2;
      }

      store.activatedSessions ||= new Set();
      store.campaignActivations ||= new Map();
      if (activated && !store.activatedSessions.has(sessionHash)) {
        store.activatedSessions.add(sessionHash);
        incrementMap(store.campaignActivations, event.campaign);
      }
    }
  }

  if (event.type === "ad_impression") {
    incrementMap(store.counts, "adImpressions");
    incrementMap(store.counts, `${event.provider}Impressions`);
  }

  if (event.type === "ad_click") {
    incrementMap(store.counts, "adClicks");
    incrementMap(store.counts, `${event.provider}Clicks`);
    incrementMap(
      store.clicks,
      `${event.provider}:${event.targetLabel || event.path}`,
    );
  }
}

async function recordFallbackEvent(day, event) {
  applyFallbackEvent(ensureFallbackBucket(day), event);
  applyFallbackEvent(ensureFallbackBucket("all"), event);
}

async function recordKvEventForKeys(keys, event) {
  const commands = [];

  if (event.visitorId) {
    const geographyBucket = event.countryCode
      ? event.countryCode === "KR"
        ? "domestic"
        : "foreign"
      : "unknown";
    // The first event for a pseudonymous visitor assigns exactly one geography
    // bucket. Only the country code supplied by the server is retained; raw IPs
    // are never passed to or stored by the analytics store.
    commands.push([
      "EVAL",
      "local added = redis.call('SADD', KEYS[1], ARGV[1]); if added == 1 then redis.call('HINCRBY', KEYS[2], ARGV[2], 1); if ARGV[3] ~= '' then redis.call('HINCRBY', KEYS[3], ARGV[3], 1); end; end; return added",
      "3",
      keys.visitors,
      keys.geography,
      keys.countries,
      hashIdentity(event.visitorId),
      geographyBucket,
      event.countryCode,
    ]);
  }
  if (event.type === "session_start" && event.sessionId) {
    // Redis handles concurrent retries atomically: one attributed arrival per session.
    commands.push([
      "EVAL",
      "local added = redis.call('SADD', KEYS[1], ARGV[1]); if added == 1 and ARGV[2] ~= '' then redis.call('HINCRBY', KEYS[2], ARGV[2], 1); end; return added",
      "2",
      keys.sessions,
      keys.campaigns,
      hashIdentity(event.sessionId),
      event.campaign,
    ]);
  }

  if (event.type === "page_view") {
    commands.push(["HINCRBY", keys.counts, "pageViews", "1"]);
    commands.push(["HINCRBY", keys.paths, event.path, "1"]);
  }

  if (event.type === "duration" && event.durationMs > 0) {
    commands.push([
      "HINCRBY",
      keys.counts,
      "durationMs",
      String(event.durationMs),
    ]);
    commands.push(["HINCRBY", keys.counts, "durationSamples", "1"]);
  }

  if (event.type === "map_click") {
    commands.push(["HINCRBY", keys.counts, "mapClicks", "1"]);
    commands.push([
      "HINCRBY",
      keys.clicks,
      event.targetLabel || event.path,
      "1",
    ]);
  }

  if (event.type === "search" && event.query) {
    commands.push(["HINCRBY", keys.counts, "searches", "1"]);
    commands.push(["HINCRBY", keys.searches, event.query, "1"]);
  }

  if (event.type === "marketing_event") {
    commands.push(["HINCRBY", keys.events, event.name, "1"]);

    if (event.sessionId && event.campaign) {
      const sessionHash = hashIdentity(event.sessionId);
      const activationSessionPrefix = keys.campaignActivations.replace(/:campaign-activations$/, ":activation-session");
      const activationMarker = `${activationSessionPrefix}:${sessionHash}:activated`;

      if (event.name === "directions_click") {
        commands.push([
          "EVAL",
          "local first = redis.call('SET', KEYS[1], '1', 'NX', 'EX', ARGV[2]); if first then redis.call('HINCRBY', KEYS[2], ARGV[1], 1); return 1; end; return 0",
          "2",
          activationMarker,
          keys.campaignActivations,
          event.campaign,
          String(ACTIVATION_STATE_TTL_SECONDS),
        ]);
      } else if (event.name === "restaurant_view" && event.restaurantId) {
        const viewedRestaurants = `${activationSessionPrefix}:${sessionHash}:restaurants`;
        commands.push([
          "EVAL",
          "redis.call('SADD', KEYS[1], ARGV[1]); redis.call('EXPIRE', KEYS[1], ARGV[3]); if redis.call('SCARD', KEYS[1]) < 2 then return 0; end; local first = redis.call('SET', KEYS[2], '1', 'NX', 'EX', ARGV[3]); if first then redis.call('HINCRBY', KEYS[3], ARGV[2], 1); return 1; end; return 0",
          "3",
          viewedRestaurants,
          activationMarker,
          keys.campaignActivations,
          hashIdentity(event.restaurantId),
          event.campaign,
          String(ACTIVATION_STATE_TTL_SECONDS),
        ]);
      }
    }
  }

  if (event.type === "ad_impression") {
    commands.push(["HINCRBY", keys.counts, "adImpressions", "1"]);
    commands.push([
      "HINCRBY",
      keys.counts,
      `${event.provider}Impressions`,
      "1",
    ]);
  }

  if (event.type === "ad_click") {
    commands.push(["HINCRBY", keys.counts, "adClicks", "1"]);
    commands.push(["HINCRBY", keys.counts, `${event.provider}Clicks`, "1"]);
    commands.push([
      "HINCRBY",
      keys.clicks,
      `${event.provider}:${event.targetLabel || event.path}`,
      "1",
    ]);
  }

  if (commands.length === 0) {
    return;
  }

  await Promise.all(commands.map((command) => requestRedis(command)));
  return commands.length;
}

async function recordKvEvent(day, event) {
  const dayKeys = getDayKeys(day);
  const allKeys = getAllKeys();
  const [dayCommandCount] = await Promise.all([
    recordKvEventForKeys(dayKeys, event),
    recordKvEventForKeys(allKeys, event),
  ]);

  if (dayCommandCount > 0) {
    await expireDayKeys(dayKeys);
  }
}

async function recordAnalyticsEvent(input, context = {}) {
  const day = getKoreaDay();
  const event = normalizeEvent(input, context);

  if (getKvConfig()) {
    await recordKvEvent(day, event);
    return { day, storage: "kv" };
  }

  await recordFallbackEvent(day, event);
  return { day, storage: "memory" };
}

async function readFallbackSummary(options) {
  const { day, scope } = normalizeSummaryOptions(options);
  const store = ensureFallbackBucket(scope === "all" ? "all" : day);
  const counts = Object.fromEntries(store.counts.entries());
  const durationMs = Number(counts.durationMs || 0);
  const durationSamples = Number(counts.durationSamples || 0);
  const geography = Object.fromEntries(
    (store.geography || new Map()).entries(),
  );
  const geographyTracked =
    Number(geography.domestic || 0) +
    Number(geography.foreign || 0) +
    Number(geography.unknown || 0);

  return {
    day,
    scope,
    storage: "memory",
    counts: {
      visitors: store.visitors.size,
      sessions: store.sessions.size,
      pageViews: Number(counts.pageViews || 0),
      avgDurationSeconds:
        durationSamples > 0
          ? Math.round(durationMs / durationSamples / 1000)
          : 0,
      mapClicks: Number(counts.mapClicks || 0),
      searches: Number(counts.searches || 0),
      adImpressions: Number(counts.adImpressions || 0),
      adClicks: Number(counts.adClicks || 0),
      coupangImpressions: Number(counts.coupangImpressions || 0),
      coupangClicks: Number(counts.coupangClicks || 0),
      adfitImpressions: Number(counts.adfitImpressions || 0),
      adfitClicks: Number(counts.adfitClicks || 0),
      adsenseImpressions: Number(counts.adsenseImpressions || 0),
      adsenseClicks: Number(counts.adsenseClicks || 0),
    },
    visitorGeography: {
      tracked: geographyTracked,
      domestic: Number(geography.domestic || 0),
      foreign: Number(geography.foreign || 0),
      unknown: Number(geography.unknown || 0),
      historicalUnclassified: Math.max(
        0,
        store.visitors.size - geographyTracked,
      ),
    },
    topPages: entriesFromPathHash(Object.fromEntries(store.paths.entries())),
    topSearches: entriesFromHash(Object.fromEntries(store.searches.entries())),
    topEvents: entriesFromHash(Object.fromEntries(store.events.entries())),
    topClicks: entriesFromHash(Object.fromEntries(store.clicks.entries())),
    topCampaigns: entriesFromHash(
      Object.fromEntries((store.campaigns || new Map()).entries()),
      20,
    ),
    topActivatedCampaigns: entriesFromHash(
      Object.fromEntries((store.campaignActivations || new Map()).entries()),
      20,
    ),
    topCountries: entriesFromHash(
      Object.fromEntries((store.countries || new Map()).entries()),
      12,
    ),
  };
}

async function readKvSummary(options) {
  const { day, scope } = normalizeSummaryOptions(options);
  const keys = getSummaryKeys(scope, day);
  const [
    countsPayload,
    visitorPayload,
    sessionPayload,
    pathsPayload,
    searchesPayload,
    eventsPayload,
    clicksPayload,
    campaignsPayload,
    campaignActivationsPayload,
    geographyPayload,
    countriesPayload,
  ] = await Promise.all([
    requestRedis(["HGETALL", keys.counts]),
    requestRedis(["SCARD", keys.visitors]),
    requestRedis(["SCARD", keys.sessions]),
    requestRedis(["HGETALL", keys.paths]),
    requestRedis(["HGETALL", keys.searches]),
    requestRedis(["HGETALL", keys.events]),
    requestRedis(["HGETALL", keys.clicks]),
    requestRedis(["HGETALL", keys.campaigns]),
    requestRedis(["HGETALL", keys.campaignActivations]),
    requestRedis(["HGETALL", keys.geography]),
    requestRedis(["HGETALL", keys.countries]),
  ]);

  const countsHash = hashToObject(countsPayload?.result);
  const durationMs = numberFromHash(countsHash, "durationMs");
  const durationSamples = numberFromHash(countsHash, "durationSamples");
  const visitorCount = Number(visitorPayload?.result || 0);
  const geographyHash = hashToObject(geographyPayload?.result);
  const geographyTracked =
    numberFromHash(geographyHash, "domestic") +
    numberFromHash(geographyHash, "foreign") +
    numberFromHash(geographyHash, "unknown");

  return {
    day,
    scope,
    storage: "kv",
    counts: {
      visitors: visitorCount,
      sessions: Number(sessionPayload?.result || 0),
      pageViews: numberFromHash(countsHash, "pageViews"),
      avgDurationSeconds:
        durationSamples > 0
          ? Math.round(durationMs / durationSamples / 1000)
          : 0,
      mapClicks: numberFromHash(countsHash, "mapClicks"),
      searches: numberFromHash(countsHash, "searches"),
      adImpressions: numberFromHash(countsHash, "adImpressions"),
      adClicks: numberFromHash(countsHash, "adClicks"),
      coupangImpressions: numberFromHash(countsHash, "coupangImpressions"),
      coupangClicks: numberFromHash(countsHash, "coupangClicks"),
      adfitImpressions: numberFromHash(countsHash, "adfitImpressions"),
      adfitClicks: numberFromHash(countsHash, "adfitClicks"),
      adsenseImpressions: numberFromHash(countsHash, "adsenseImpressions"),
      adsenseClicks: numberFromHash(countsHash, "adsenseClicks"),
    },
    visitorGeography: {
      tracked: geographyTracked,
      domestic: numberFromHash(geographyHash, "domestic"),
      foreign: numberFromHash(geographyHash, "foreign"),
      unknown: numberFromHash(geographyHash, "unknown"),
      historicalUnclassified: Math.max(0, visitorCount - geographyTracked),
    },
    topPages: entriesFromPathHash(pathsPayload?.result),
    topSearches: entriesFromHash(searchesPayload?.result),
    topEvents: entriesFromHash(eventsPayload?.result),
    topClicks: entriesFromHash(clicksPayload?.result),
    topCampaigns: entriesFromHash(campaignsPayload?.result, 20),
    topActivatedCampaigns: entriesFromHash(campaignActivationsPayload?.result, 20),
    topCountries: entriesFromHash(countriesPayload?.result, 12),
  };
}

async function readAnalyticsSummary(
  options = { day: getKoreaDay(), scope: "today" },
) {
  if (getKvConfig()) {
    return readKvSummary(options);
  }

  return readFallbackSummary(options);
}

module.exports = {
  getKoreaDay,
  readAnalyticsSummary,
  recordAnalyticsEvent,
};
