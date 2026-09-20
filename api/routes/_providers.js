function isKoreanPoint(point) {
  return (
    point &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= 32 &&
    point.lat <= 39.5 &&
    point.lng >= 124 &&
    point.lng <= 132
  );
}
function validMetric(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function parseDriving(data) {
  if (data?.code !== 0)
    return {
      status: [1, 2, 3, 4, 5].includes(data?.code) ? "no_route" : "unavailable",
    };
  const summary = data.route?.trafast?.[0]?.summary;
  if (
    !summary ||
    !validMetric(summary.distance) ||
    !validMetric(summary.duration)
  )
    return { status: "unavailable" };
  return {
    status: "ok",
    distanceMeters: summary.distance,
    durationMinutes: Math.ceil(summary.duration / 60000),
    provider: "NAVER Maps",
  };
}
function getRouteConfig(env = process.env) {
  return {
    id: env.NAVER_MAP_API_KEY_ID || env.VITE_NAVER_MAP_KEY_ID || "",
    secret: env.NAVER_MAP_API_KEY || env.NAVER_MAP_CLIENT_SECRET || "",
  };
}
async function getTravelTimes(origin, destination, config, fetcher = fetch) {
  // Preserve this field for already-open clients; no transit provider is called.
  const transit = { status: "not_configured" };
  if (!isKoreanPoint(origin) || !isKoreanPoint(destination))
    return { driving: { status: "unsupported" }, transit };
  if (!config.id || !config.secret)
    return { driving: { status: "not_configured" }, transit };
  try {
    const url = new URL(
      "https://maps.apigw.ntruss.com/map-direction/v1/driving",
    );
    url.search = new URLSearchParams({
      start: origin.lng + "," + origin.lat,
      goal: destination.lng + "," + destination.lat,
      option: "trafast",
    }).toString();
    const response = await fetcher(url, {
      headers: {
        "x-ncp-apigw-api-key-id": config.id,
        "x-ncp-apigw-api-key": config.secret,
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok && response.status !== 400)
      throw new Error("Route provider unavailable");
    return { driving: parseDriving(await response.json()), transit };
  } catch {
    return { driving: { status: "unavailable" }, transit };
  }
}
module.exports = {
  isKoreanPoint,
  parseDriving,
  getRouteConfig,
  getTravelTimes,
};
