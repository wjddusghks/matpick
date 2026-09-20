const crypto = require("node:crypto");
const CACHE_SECONDS = 300;
function config() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Shared route budget unavailable");
  return { url: url.replace(/\/$/, ""), token };
}
async function redis(command, fetcher = fetch) {
  const c = config();
  const r = await fetcher(c.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(4000),
  });
  if (!r.ok) throw new Error("Route budget store unavailable");
  const data = await r.json();
  if (data.error || !Object.hasOwn(data, "result"))
    throw new Error("Invalid route budget response");
  return data.result;
}
function limit(value, fallback) {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error("Invalid route budget");
  return Math.min(n, fallback);
}
function keys(now = new Date()) {
  const date = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
  return [
    `matpick:route-budget:day:${date}`,
    `matpick:route-budget:month:${date.slice(0, 7)}`,
  ];
}
// Admission is atomic across every worker; Redis failure never falls back to local counters.
const ADMIT = `local d=tonumber(redis.call('GET',KEYS[1]) or '0'); local m=tonumber(redis.call('GET',KEYS[2]) or '0'); if d>=tonumber(ARGV[1]) or m>=tonumber(ARGV[2]) then return 0 end; redis.call('INCR',KEYS[1]); redis.call('EXPIRE',KEYS[1],172800); redis.call('INCR',KEYS[2]); redis.call('EXPIRE',KEYS[2],2764800); return 1`;
async function reserveRouteCall(fetcher = fetch, now = new Date()) {
  const result = await redis(
    [
      "EVAL",
      ADMIT,
      2,
      ...keys(now),
      limit(process.env.ROUTE_DAILY_REQUEST_LIMIT, 100),
      limit(process.env.ROUTE_MONTHLY_REQUEST_LIMIT, 1000),
    ],
    fetcher,
  );
  if (result !== 0 && result !== 1) throw new Error("Invalid budget admission");
  return result === 1;
}
function cacheKey(origin, destination) {
  return (
    "matpick:route-cache:" +
    crypto
      .createHash("sha256")
      .update(
        `${origin.lat},${origin.lng}|${destination.id}|${destination.lat},${destination.lng}`,
      )
      .digest("hex")
  );
}
async function readRouteCache(origin, destination, fetcher = fetch) {
  const v = await redis(["GET", cacheKey(origin, destination)], fetcher);
  if (!v) return null;
  try {
    const p = JSON.parse(v);
    const age = Date.now() - p?.checkedAt;
    return p?.driving?.status === "ok" &&
      Number.isFinite(p.driving.distanceMeters) &&
      p.driving.distanceMeters >= 0 &&
      Number.isFinite(p.driving.durationMinutes) &&
      p.driving.durationMinutes >= 0 &&
      Number.isFinite(p.checkedAt) &&
      age >= 0 &&
      age < CACHE_SECONDS * 1000
      ? p
      : null;
  } catch {
    return null;
  }
}
async function writeRouteCache(origin, destination, value, fetcher = fetch) {
  if (value.driving?.status !== "ok") return;
  await redis(
    [
      "SET",
      cacheKey(origin, destination),
      JSON.stringify(value),
      "EX",
      CACHE_SECONDS,
    ],
    fetcher,
  );
}
module.exports = {
  reserveRouteCall,
  readRouteCache,
  writeRouteCache,
  keys,
  limit,
};
