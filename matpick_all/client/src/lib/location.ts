export const LOCATION_COORDS_KEY = "matpick_location_coords";
export const LOCATION_UPDATED_EVENT = "matpick:location-updated";
export const LOCATION_STALE_MS = 10 * 60 * 1000;
export const LOCATION_TARGET_ACCURACY_METERS = 80;
export const LOCATION_MAX_ACCURACY_METERS = 500;
export const LOCATION_REQUEST_TIMEOUT_MS = 18_000;
const LOCATION_ACCEPTABLE_FIX_SETTLE_MS = 3_500;

export interface StoredLocation {
  lat: number;
  lng: number;
  accuracy: number;
  positionTimestamp: number;
  updatedAt: number;
}

export type LocationRequestErrorCode =
  | "unsupported"
  | "permission-denied"
  | "unavailable"
  | "timeout"
  | "inaccurate"
  | "aborted";

export class LocationRequestError extends Error {
  readonly code: LocationRequestErrorCode;

  constructor(code: LocationRequestErrorCode, message: string) {
    super(message);
    this.name = "LocationRequestError";
    this.code = code;
  }
}

type PointLike = {
  lat: number;
  lng: number;
};

type RequestBestCurrentLocationOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  targetAccuracyMeters?: number;
  maximumAccuracyMeters?: number;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function isFiniteCoordinate(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function isStoredLocation(value: Partial<StoredLocation>): value is StoredLocation {
  return (
    typeof value.lat === "number" &&
    typeof value.lng === "number" &&
    isFiniteCoordinate(value.lat, value.lng) &&
    typeof value.accuracy === "number" &&
    Number.isFinite(value.accuracy) &&
    value.accuracy >= 0 &&
    value.accuracy <= LOCATION_MAX_ACCURACY_METERS &&
    typeof value.positionTimestamp === "number" &&
    Number.isFinite(value.positionTimestamp) &&
    typeof value.updatedAt === "number" &&
    Number.isFinite(value.updatedAt)
  );
}

function fromGeolocationPosition(position: GeolocationPosition): StoredLocation | null {
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  const accuracy = position.coords.accuracy;

  if (
    !isFiniteCoordinate(lat, lng) ||
    !Number.isFinite(accuracy) ||
    accuracy < 0
  ) {
    return null;
  }

  return {
    lat,
    lng,
    accuracy,
    positionTimestamp:
      Number.isFinite(position.timestamp) && position.timestamp > 0
        ? position.timestamp
        : Date.now(),
    updatedAt: Date.now(),
  };
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
    if (!isStoredLocation(parsed) || Date.now() - parsed.updatedAt > LOCATION_STALE_MS) {
      window.localStorage.removeItem(LOCATION_COORDS_KEY);
      return null;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(LOCATION_COORDS_KEY);
    return null;
  }
}

export function saveStoredLocation(location: StoredLocation) {
  if (!isBrowser() || !isStoredLocation(location)) {
    return;
  }

  window.localStorage.setItem(LOCATION_COORDS_KEY, JSON.stringify(location));
  window.dispatchEvent(new CustomEvent(LOCATION_UPDATED_EVENT, { detail: location }));
}

export function clearStoredLocation() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(LOCATION_COORDS_KEY);
  window.dispatchEvent(new CustomEvent(LOCATION_UPDATED_EVENT, { detail: null }));
}

export function requestBestCurrentLocation({
  signal,
  timeoutMs = LOCATION_REQUEST_TIMEOUT_MS,
  targetAccuracyMeters = LOCATION_TARGET_ACCURACY_METERS,
  maximumAccuracyMeters = LOCATION_MAX_ACCURACY_METERS,
}: RequestBestCurrentLocationOptions = {}): Promise<StoredLocation> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return Promise.reject(
      new LocationRequestError("unsupported", "Geolocation is not supported.")
    );
  }

  if (signal?.aborted) {
    return Promise.reject(new LocationRequestError("aborted", "Location request aborted."));
  }

  const effectiveTimeout = Math.max(1_000, timeoutMs);
  const targetAccuracy = Math.max(0, targetAccuracyMeters);
  const maximumAccuracy = Math.max(targetAccuracy, maximumAccuracyMeters);

  return new Promise<StoredLocation>((resolve, reject) => {
    let bestLocation: StoredLocation | null = null;
    let watchId: number | null = null;
    let acceptableFixTimeoutId: number | null = null;
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      if (acceptableFixTimeoutId != null) {
        window.clearTimeout(acceptableFixTimeoutId);
      }
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId);
      }
      signal?.removeEventListener("abort", handleAbort);
    };

    const finish = (location: StoredLocation | null, errorCode?: LocationRequestErrorCode) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();

      if (location) {
        resolve(location);
        return;
      }

      reject(
        new LocationRequestError(
          errorCode ?? "unavailable",
          errorCode === "inaccurate"
            ? "The reported location was not accurate enough."
            : "The current location could not be determined."
        )
      );
    };

    const finishWithBest = (fallbackCode: LocationRequestErrorCode) => {
      if (bestLocation && bestLocation.accuracy <= maximumAccuracy) {
        finish(bestLocation);
        return;
      }

      finish(null, bestLocation ? "inaccurate" : fallbackCode);
    };

    function handleAbort() {
      finish(null, "aborted");
    }

    const timeoutId = window.setTimeout(() => {
      finishWithBest("timeout");
    }, effectiveTimeout);

    signal?.addEventListener("abort", handleAbort, { once: true });

    try {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const candidate = fromGeolocationPosition(position);
          if (!candidate) {
            return;
          }

          if (!bestLocation || candidate.accuracy < bestLocation.accuracy) {
            bestLocation = candidate;
          }

          if (candidate.accuracy <= targetAccuracy) {
            finish(candidate);
            return;
          }

          if (
            candidate.accuracy <= maximumAccuracy &&
            acceptableFixTimeoutId == null
          ) {
            acceptableFixTimeoutId = window.setTimeout(() => {
              finishWithBest("inaccurate");
            }, LOCATION_ACCEPTABLE_FIX_SETTLE_MS);
          }
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            finish(null, "permission-denied");
            return;
          }

          if (error.code === error.TIMEOUT) {
            finishWithBest("timeout");
          }
        },
        {
          enableHighAccuracy: true,
          timeout: effectiveTimeout,
          maximumAge: 0,
        }
      );
    } catch {
      finish(null, "unavailable");
    }
  });
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
