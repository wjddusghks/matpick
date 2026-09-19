import type { Restaurant } from "@/data/types";

export function getRestaurantDirectionsUrl(restaurant: Restaurant) {
  // Coordinate-based destination avoids ambiguous same-name branches.
  return `https://map.kakao.com/link/to/${encodeURIComponent(restaurant.name)},${restaurant.lat},${restaurant.lng}`;
}
