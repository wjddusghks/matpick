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
function parseTransit(data) {
  if (data?.error) {
    const error = Array.isArray(data.error) ? data.error[0] : data.error;
    return {
      status: ["3", "4", "5", "6", "-98", "-99"].includes(String(error?.code))
        ? "no_route"
        : "unavailable",
    };
  }
  // Intercity results omit access/egress legs. Never present terminal-to-terminal
  // duration as a full journey from the user's location to the restaurant.
  if (data?.result?.searchType !== 0) return { status: "unsupported" };
  const paths = data.result.path;
  if (!Array.isArray(paths) || !paths.length) return { status: "no_route" };
  const options = paths
    .map((path) => path.info)
    .filter(
      (info) =>
        info && validMetric(info.totalDistance) && validMetric(info.totalTime),
    );
  options.sort(
    (a, b) => a.totalTime - b.totalTime || a.totalDistance - b.totalDistance,
  );
  if (!options.length) return { status: "unavailable" };
  return {
    status: "ok",
    distanceMeters: options[0].totalDistance,
    durationMinutes: Math.ceil(options[0].totalTime),
    provider: "ODsay",
  };
}
function getRouteConfig(env = process.env) {
  const id = env.NAVER_MAP_API_KEY_ID || env.VITE_NAVER_MAP_KEY_ID || "";
  const secret = env.NAVER_MAP_API_KEY || env.NAVER_MAP_CLIENT_SECRET || "";
  return { id, secret, transitKey: env.ODSAY_API_KEY || "" };
}
async function readJson(url, options, fetcher) {
  const response = await fetcher(url, {
    ...options,
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error("Route provider unavailable");
  return response.json();
}
async function getTravelTimes(origin, destination, config, fetcher = fetch) {
  if (!isKoreanPoint(origin) || !isKoreanPoint(destination))
    return {
      driving: { status: "unsupported" },
      transit: { status: "unsupported" },
    };
  const driving = async () => {
    if (!config.id || !config.secret) return { status: "not_configured" };
    const url = new URL(
      "https://maps.apigw.ntruss.com/map-direction/v1/driving",
    );
    url.search = new URLSearchParams({
      start: `${origin.lng},${origin.lat}`,
      goal: `${destination.lng},${destination.lat}`,
      option: "trafast",
    }).toString();
    return parseDriving(
      await readJson(
        url,
        {
          headers: {
            "x-ncp-apigw-api-key-id": config.id,
            "x-ncp-apigw-api-key": config.secret,
          },
        },
        fetcher,
      ),
    );
  };
  const transit = async () => {
    if (!config.transitKey) return { status: "not_configured" };
    const body = new URLSearchParams({
      apiKey: config.transitKey,
      SX: String(origin.lng),
      SY: String(origin.lat),
      EX: String(destination.lng),
      EY: String(destination.lat),
      OPT: "0",
      SearchType: "0",
      SearchPathType: "0",
      output: "json",
    });
    return parseTransit(
      await readJson(
        "https://api.odsay.com/v1/api/searchPubTransPathT",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        },
        fetcher,
      ),
    );
  };
  const results = await Promise.allSettled([driving(), transit()]);
  return {
    driving:
      results[0].status === "fulfilled"
        ? results[0].value
        : { status: "unavailable" },
    transit:
      results[1].status === "fulfilled"
        ? results[1].value
        : { status: "unavailable" },
  };
}
module.exports = {
  isKoreanPoint,
  parseDriving,
  parseTransit,
  getRouteConfig,
  getTravelTimes,
};
