import type { Restaurant } from "@/data/types";

export interface PrivateGuideRestaurant extends Restaurant {
  publicRestaurantId?: string;
  privateGuideIds: string[];
}

export interface PrivateGuideCatalog {
  title: string;
  edition: string;
  checkedAt: string;
  status: string;
  expiresAt: number;
  regions: { id: string; name: string }[];
  restaurants: PrivateGuideRestaurant[];
}

const normalize = (text: string) =>
  text.toLowerCase().replace(/\s+/g, "").trim();
function sameBranch(a: Restaurant, b: Restaurant) {
  return (
    normalize(a.name) === normalize(b.name) &&
    normalize(a.address) === normalize(b.address) &&
    Math.abs(a.lat - b.lat) < 0.001 &&
    Math.abs(a.lng - b.lng) < 0.001
  );
}

/** Called only with the current authenticated catalog; never mutates the public dataset. */
export function mergePrivateRestaurants(
  publicRestaurants: Restaurant[],
  privateRestaurants: PrivateGuideRestaurant[]
): Restaurant[] {
  if (!privateRestaurants.length) return publicRestaurants;
  const result = [...publicRestaurants];
  for (const entry of privateRestaurants) {
    const index = result.findIndex(
      r =>
        (!entry.publicRestaurantId || r.id === entry.publicRestaurantId) &&
        sameBranch(r, entry)
    );
    if (index >= 0) {
      const existing = result[index];
      result[index] = {
        ...existing,
        privateGuideIds: Array.from(
          new Set([
            ...(existing.privateGuideIds ?? []),
            ...entry.privateGuideIds,
          ])
        ),
      };
    } else {
      // An explicit public ID that disagrees on branch/location needs review, not a new listing.
      if (
        entry.publicRestaurantId ||
        !entry.id.startsWith("private-guide:") ||
        result.some(r => r.id === entry.id)
      )
        continue;
      result.push({ ...entry, adminOnly: true });
    }
  }
  return result;
}

export function restaurantDetailPath(restaurant: Restaurant) {
  return `${restaurant.adminOnly ? "/admin/private-guides/restaurant" : "/restaurant"}/${encodeURIComponent(restaurant.id)}`;
}

/** Deferred UI work must not retain private records or annotations after logout. */
export function resolveCurrentResults(
  previous: Restaurant[],
  current: Map<string, Restaurant>,
  regionId?: string
) {
  return previous.flatMap(r => {
    const authorized = current.get(r.id);
    return authorized &&
      (!regionId || authorized.privateGuideIds?.includes(regionId))
      ? [authorized]
      : [];
  });
}
