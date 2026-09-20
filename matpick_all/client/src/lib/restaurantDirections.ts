import type { Restaurant } from "@/data/types";

export function getRestaurantDirectionsUrl(
  restaurant: Restaurant,
  origin?: { lat: number; lng: number } | null,
  mode: "car" | "traffic" = "car"
) {
  if (
    origin &&
    Number.isFinite(origin.lat) &&
    Number.isFinite(origin.lng) &&
    Math.abs(origin.lat) <= 90 &&
    Math.abs(origin.lng) <= 180
  ) {
    return `https://map.kakao.com/link/by/${mode}/${encodeURIComponent("현재 위치")},${origin.lat},${origin.lng}/${encodeURIComponent(restaurant.name)},${restaurant.lat},${restaurant.lng}`;
  }
  // Coordinate-based destination avoids ambiguous same-name branches.
  return `https://map.kakao.com/link/to/${encodeURIComponent(restaurant.name)},${restaurant.lat},${restaurant.lng}`;
}
