import type { Restaurant } from "@/data/types";
import { getDistanceInMeters } from "./location";
import {
  hasUsableCoordinates,
  isRestaurantRecommendable,
} from "./restaurantEligibility";

export function findNearbyRecommendations(
  restaurants: Restaurant[],
  origin: { lat: number; lng: number }
) {
  const sorted = restaurants
    .filter(
      restaurant =>
        !restaurant.isOverseas &&
        hasUsableCoordinates(restaurant) &&
        isRestaurantRecommendable(restaurant)
    )
    .map(restaurant => ({
      restaurant,
      distance: getDistanceInMeters(origin, restaurant),
    }))
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        a.restaurant.id.localeCompare(b.restaurant.id)
    );
  const radius = [1000, 3000, 5000, 10000, 30000].find(
    meters => sorted.filter(entry => entry.distance <= meters).length >= 3
  );
  const chosen = radius
    ? sorted.filter(entry => entry.distance <= radius).slice(0, 100)
    : sorted.slice(0, 3);
  return {
    restaurants: chosen.map(entry => entry.restaurant),
    radiusMeters:
      radius ?? Math.ceil((chosen.at(-1)?.distance ?? 0) / 1000) * 1000,
    expanded: (radius ?? Infinity) > 1000 && chosen.length > 0,
  };
}
