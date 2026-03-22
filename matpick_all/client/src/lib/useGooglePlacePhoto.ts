import { useEffect, useRef, useState } from "react";

type GooglePlacePhotoAttribution = {
  displayName?: string;
  uri?: string;
};

export type GooglePlacePhotoPayload = {
  imageUrl: string;
  attributions: GooglePlacePhotoAttribution[];
};

const PHOTO_CACHE_PREFIX = "matpick_google_place_photo:";
const googlePlacePhotoCache = new Map<string, GooglePlacePhotoPayload | null>();
const googlePlacePhotoRequests = new Map<string, Promise<GooglePlacePhotoPayload | null>>();

function getStorageKey(placeId: string) {
  return `${PHOTO_CACHE_PREFIX}${placeId}`;
}

function readSessionPhoto(placeId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(getStorageKey(placeId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as GooglePlacePhotoPayload;
    if (!parsed?.imageUrl) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeSessionPhoto(placeId: string, payload: GooglePlacePhotoPayload | null) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (!payload?.imageUrl) {
      window.sessionStorage.removeItem(getStorageKey(placeId));
      return;
    }

    window.sessionStorage.setItem(getStorageKey(placeId), JSON.stringify(payload));
  } catch {
    // Ignore storage quota or privacy mode failures.
  }
}

function getCachedPhoto(placeId: string) {
  if (googlePlacePhotoCache.has(placeId)) {
    return googlePlacePhotoCache.get(placeId) ?? null;
  }

  const sessionPhoto = readSessionPhoto(placeId);
  if (sessionPhoto) {
    googlePlacePhotoCache.set(placeId, sessionPhoto);
    return sessionPhoto;
  }

  return undefined;
}

async function requestGooglePlacePhoto(placeId: string) {
  const cached = getCachedPhoto(placeId);
  if (cached !== undefined) {
    return cached;
  }

  const inFlight = googlePlacePhotoRequests.get(placeId);
  if (inFlight) {
    return inFlight;
  }

  const request = fetch(`/api/places/photo?placeId=${encodeURIComponent(placeId)}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to load Google place photo");
      }

      return response.json() as Promise<GooglePlacePhotoPayload>;
    })
    .then((payload) => {
      const nextValue = payload?.imageUrl ? payload : null;
      googlePlacePhotoCache.set(placeId, nextValue);
      writeSessionPhoto(placeId, nextValue);
      return nextValue;
    })
    .catch(() => {
      googlePlacePhotoCache.set(placeId, null);
      return null;
    })
    .finally(() => {
      googlePlacePhotoRequests.delete(placeId);
    });

  googlePlacePhotoRequests.set(placeId, request);
  return request;
}

export function useCardVisibility<T extends HTMLElement>() {
  const elementRef = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = elementRef.current;
    if (!node || isVisible) {
      return;
    }

    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "240px 0px",
        threshold: 0.05,
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isVisible]);

  return { ref: elementRef, isVisible };
}

export function useGooglePlacePhoto(placeId?: string | null, enabled = true) {
  const normalizedPlaceId = placeId?.trim() || "";
  const [photo, setPhoto] = useState<GooglePlacePhotoPayload | null>(() => {
    if (!normalizedPlaceId) {
      return null;
    }

    return getCachedPhoto(normalizedPlaceId) ?? null;
  });

  useEffect(() => {
    if (!normalizedPlaceId) {
      setPhoto(null);
      return;
    }

    setPhoto(getCachedPhoto(normalizedPlaceId) ?? null);
  }, [normalizedPlaceId]);

  useEffect(() => {
    if (!enabled || !normalizedPlaceId) {
      return;
    }

    const cached = getCachedPhoto(normalizedPlaceId);
    if (cached !== undefined) {
      setPhoto(cached);
      return;
    }

    let ignore = false;

    void requestGooglePlacePhoto(normalizedPlaceId).then((payload) => {
      if (!ignore) {
        setPhoto(payload);
      }
    });

    return () => {
      ignore = true;
    };
  }, [enabled, normalizedPlaceId]);

  return photo;
}
