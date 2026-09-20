export type TravelModeResult =
  | {
      status: "ok";
      distanceMeters: number;
      durationMinutes: number;
      provider: string;
    }
  | { status: "not_configured" | "no_route" | "unsupported" | "unavailable" };
export type RestaurantTravelTimes = {
  driving: TravelModeResult;
  transit: TravelModeResult;
};
export function formatTravelTime(minutes: number, english = false) {
  const rounded = Math.max(1, Math.ceil(minutes));
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return hours
    ? `${hours}${english ? "h" : "시간"}${remainder ? ` ${remainder}${english ? "m" : "분"}` : ""}`
    : `${rounded}${english ? " min" : "분"}`;
}
export function formatRouteDistance(meters: number) {
  return meters < 1000
    ? `${Math.round(meters)}m`
    : `${(meters / 1000).toFixed(1)}km`;
}
export function isValidTravelMode(value: unknown): value is TravelModeResult {
  if (!value || typeof value !== "object" || !("status" in value)) return false;
  if (value.status !== "ok")
    return [
      "not_configured",
      "no_route",
      "unsupported",
      "unavailable",
    ].includes(String(value.status));
  return (
    "distanceMeters" in value &&
    typeof value.distanceMeters === "number" &&
    Number.isFinite(value.distanceMeters) &&
    value.distanceMeters >= 0 &&
    "durationMinutes" in value &&
    typeof value.durationMinutes === "number" &&
    Number.isFinite(value.durationMinutes) &&
    value.durationMinutes >= 0 &&
    "provider" in value &&
    typeof value.provider === "string"
  );
}
