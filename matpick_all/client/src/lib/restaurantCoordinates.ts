import type { Restaurant } from "@/data";

const RESTAURANT_COORDS_CACHE_KEY = "matpick_restaurant_coords_cache_v1";

type CachedRestaurantCoordinate = {
  restaurantId: string;
  address: string;
  lat: number;
  lng: number;
  updatedAt: number;
};

type RestaurantCoordsCache = Record<string, CachedRestaurantCoordinate>;

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeAddress(address: string) {
  return address.replace(/\s+/g, " ").trim();
}

export function loadRestaurantCoordinateCache(): RestaurantCoordsCache {
  if (!isBrowser()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(RESTAURANT_COORDS_CACHE_KEY);
    if (!raw) {
      return {};
    }

    return JSON.parse(raw) as RestaurantCoordsCache;
  } catch {
    return {};
  }
}

export function saveRestaurantCoordinate(
  restaurant: Pick<Restaurant, "id" | "address">,
  coords: { lat: number; lng: number }
) {
  if (!isBrowser()) {
    return;
  }

  const cache = loadRestaurantCoordinateCache();
  cache[restaurant.id] = {
    restaurantId: restaurant.id,
    address: normalizeAddress(restaurant.address),
    lat: coords.lat,
    lng: coords.lng,
    updatedAt: Date.now(),
  };
  window.localStorage.setItem(RESTAURANT_COORDS_CACHE_KEY, JSON.stringify(cache));
}

export function getCachedRestaurantCoordinate(restaurant: Pick<Restaurant, "id" | "address">) {
  const cache = loadRestaurantCoordinateCache();
  const cached = cache[restaurant.id];
  if (!cached) {
    return null;
  }

  if (cached.address !== normalizeAddress(restaurant.address)) {
    return null;
  }

  return {
    lat: cached.lat,
    lng: cached.lng,
  };
}
