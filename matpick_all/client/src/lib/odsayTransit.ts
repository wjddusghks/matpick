import type { TravelModeResult } from "./travelTimes";

export function parseOdsayTransit(data: any): TravelModeResult {
  if (data?.error) {
    const error = Array.isArray(data.error) ? data.error[0] : data.error;
    return {
      status: ["3", "4", "5", "6", "-98", "-99"].includes(String(error?.code))
        ? "no_route"
        : "unavailable",
    };
  }
  // Intercity summaries exclude the journey to/from terminals.
  if (data?.result?.searchType !== 0) return { status: "unsupported" };
  if (!Array.isArray(data.result.path) || !data.result.path.length)
    return { status: "no_route" };
  const options = data.result.path
    .map((path: any) => path?.info)
    .filter(
      (info: any) =>
        info &&
        typeof info.totalDistance === "number" &&
        Number.isFinite(info.totalDistance) &&
        info.totalDistance >= 0 &&
        typeof info.totalTime === "number" &&
        Number.isFinite(info.totalTime) &&
        info.totalTime >= 0
    );
  options.sort(
    (a: any, b: any) =>
      a.totalTime - b.totalTime || a.totalDistance - b.totalDistance
  );
  if (!options.length) return { status: "unavailable" };
  return {
    status: "ok",
    distanceMeters: options[0].totalDistance,
    durationMinutes: Math.ceil(options[0].totalTime),
    provider: "ODsay",
  };
}

export async function getOdsayWebTransit(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  key: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch
): Promise<TravelModeResult> {
  if (!key) return { status: "not_configured" };
  // This is a domain-restricted Web key, never an ODsay Server key.
  const params = new URLSearchParams({
    apiKey: key,
    SX: String(origin.lng),
    SY: String(origin.lat),
    EX: String(destination.lng),
    EY: String(destination.lat),
    OPT: "0",
    SearchType: "0",
    SearchPathType: "0",
    output: "json",
  });
  try {
    const response = await fetcher(
      `https://api.odsay.com/v1/api/searchPubTransPathT?${params}`,
      { signal, referrerPolicy: "strict-origin-when-cross-origin" }
    );
    if (!response.ok) return { status: "unavailable" };
    return parseOdsayTransit(await response.json());
  } catch {
    return { status: "unavailable" };
  }
}
