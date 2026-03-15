export const LOCATION_COORDS_KEY = "matpick_location_coords";
export const LOCATION_UPDATED_EVENT = "matpick:location-updated";
export const LOCATION_STALE_MS = 10 * 60 * 1000;

export interface StoredLocation {
  lat: number;
  lng: number;
  updatedAt: number;
}

type PointLike = {
  lat: number;
  lng: number;
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function loadStoredLocation(): StoredLocation | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LOCATION_COORDS_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredLocation>;
    if (
      typeof parsed.lat !== "number" ||
      typeof parsed.lng !== "number" ||
      typeof parsed.updatedAt !== "number"
    ) {
      return null;
    }

    const location = {
      lat: parsed.lat,
      lng: parsed.lng,
      updatedAt: parsed.updatedAt,
    };

    if (Date.now() - location.updatedAt > LOCATION_STALE_MS) {
      return null;
    }

    return location;
  } catch {
    return null;
  }
}

export function saveStoredLocation(location: Omit<StoredLocation, "updatedAt"> | StoredLocation) {
  if (!isBrowser()) {
    return;
  }

  const payload: StoredLocation = {
    lat: location.lat,
    lng: location.lng,
    updatedAt: "updatedAt" in location ? location.updatedAt : Date.now(),
  };

  window.localStorage.setItem(LOCATION_COORDS_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent(LOCATION_UPDATED_EVENT, { detail: payload }));
}

export function clearStoredLocation() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(LOCATION_COORDS_KEY);
  window.dispatchEvent(new CustomEvent(LOCATION_UPDATED_EVENT, { detail: null }));
}

export function getDistanceInMeters(from: PointLike, to: PointLike) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const startLat = toRadians(from.lat);
  const endLat = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) *
      Math.sin(dLng / 2) *
      Math.cos(startLat) *
      Math.cos(endLat);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}
