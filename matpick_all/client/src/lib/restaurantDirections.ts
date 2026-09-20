import type { Restaurant } from "@/data/types";

export function getRestaurantDirectionsUrl(
  restaurant: Restaurant,
  origin?: { lat: number; lng: number } | null
) {
  const params = new URLSearchParams({
    menu: "route",
    pathType: "0",
    elat: String(restaurant.lat),
    elng: String(restaurant.lng),
    etext: restaurant.name,
  });
  if (
    origin &&
    Number.isFinite(origin.lat) &&
    Number.isFinite(origin.lng) &&
    Math.abs(origin.lat) <= 90 &&
    Math.abs(origin.lng) <= 180
  ) {
    params.set("slat", String(origin.lat));
    params.set("slng", String(origin.lng));
    params.set("stext", "현재 위치");
  }
  // NAVER redirects this coordinate link to its current car-directions page.
  return `https://map.naver.com/index.nhn?${params}`;
}
