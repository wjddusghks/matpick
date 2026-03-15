export interface StoredRestaurantRating {
  stars: number;
  updatedAt: number;
}

type StoredRestaurantRatingsMap = Record<string, StoredRestaurantRating>;

function getStorageKey(userId: string) {
  return `matpick_restaurant_ratings_${userId}`;
}

export function sanitizeRestaurantRating(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(5, Math.max(1, Math.round(value)));
}

export function readUserRestaurantRatings(userId: string): StoredRestaurantRatingsMap {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    return raw ? (JSON.parse(raw) as StoredRestaurantRatingsMap) : {};
  } catch {
    return {};
  }
}

export function getUserRestaurantRating(userId: string, restaurantId: string) {
  const ratings = readUserRestaurantRatings(userId);
  return ratings[restaurantId] ?? null;
}

export function saveUserRestaurantRating(userId: string, restaurantId: string, stars: number) {
  if (typeof window === "undefined") {
    return;
  }

  const ratings = readUserRestaurantRatings(userId);
  ratings[restaurantId] = {
    stars: sanitizeRestaurantRating(stars),
    updatedAt: Date.now(),
  };

  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(ratings));
}
