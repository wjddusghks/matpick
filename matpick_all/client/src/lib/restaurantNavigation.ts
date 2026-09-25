import type { Restaurant } from "@/data/types";

export function restaurantDetailPath(restaurant: Pick<Restaurant, "id">) {
  return `/restaurant/${encodeURIComponent(restaurant.id)}`;
}
