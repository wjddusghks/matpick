import { useCallback, useEffect, useRef, useState } from "react";
import { getRestaurantMenuSummary, type Restaurant } from "@/data";
import type { StoredLocation } from "@/lib/location";

interface NaverMapProps {
  restaurants: Restaurant[];
  selectedId: string | null;
  currentLocation: StoredLocation | null;
  nearestRestaurantId: string | null;
  onMarkerClick: (id: string) => void;
}

const NAVER_MAPS_CLIENT_ID = import.meta.env.VITE_NAVER_MAP_CLIENT_ID?.trim() ?? "";
const NAVER_MAPS_SCRIPT_ID = "matpick-naver-maps-sdk";
const SEOUL_CENTER = { lat: 37.5665, lng: 126.978 };

function isNaverMapsReady(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as Window & { naver?: typeof naver }).naver !== "undefined" &&
    (window as Window & { naver?: typeof naver }).naver?.maps != null &&
    typeof (window as Window & { naver?: typeof naver }).naver?.maps.Map === "function"
  );
}

function waitForNaverMaps(timeout = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isNaverMapsReady()) {
      resolve();
      return;
    }

    const start = Date.now();
    const interval = window.setInterval(() => {
      if (isNaverMapsReady()) {
        window.clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeout) {
        window.clearInterval(interval);
        reject(new Error("Naver Maps SDK load timed out."));
      }
    }, 100);
  });
}

function ensureNaverMapsSdk(clientId: string, timeout = 15000): Promise<void> {
  if (!clientId) {
    return Promise.reject(
      new Error("VITE_NAVER_MAP_CLIENT_ID is missing.")
    );
  }

  if (isNaverMapsReady()) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const handleReady = () => {
      waitForNaverMaps(timeout).then(resolve).catch(reject);
    };

    const handleError = () => {
      reject(
        new Error(
          "Failed to load the Naver Maps SDK. Check the client ID and allowed domains."
        )
      );
    };

    const existingScript = document.getElementById(
      NAVER_MAPS_SCRIPT_ID
    ) as HTMLScriptElement | null;

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        handleReady();
        return;
      }

      existingScript.addEventListener("load", handleReady, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = NAVER_MAPS_SCRIPT_ID;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${encodeURIComponent(clientId)}&submodules=geocoder`;
    script.async = true;
    script.dataset.loaded = "false";
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        handleReady();
      },
      { once: true }
    );
    script.addEventListener("error", handleError, { once: true });
    document.head.appendChild(script);
  });
}

function createMarkerIcon({
  isSelected,
  isNearest,
}: {
  isSelected: boolean;
  isNearest: boolean;
}) {
  const color = isSelected ? "#FD7979" : isNearest ? "#f59e0b" : "#FF8A8A";
  const size = isSelected ? 36 : isNearest ? 32 : 28;
  const strokeColor = "#fff";
  const strokeWidth = isSelected ? 2.5 : 1.8;
  const height = Math.round(size * 1.35);
  const label = isNearest ? "Near" : "Pick";

  return {
    content: `
      <div style="cursor:pointer;transform:translate(-50%,-100%);">
        <svg width="${size}" height="${height}" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 24 14 24s14-13.5 14-24C28 6.268 21.732 0 14 0z" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
          <circle cx="14" cy="13" r="5.5" fill="white" opacity="0.95"/>
          <text x="14" y="16" text-anchor="middle" font-size="${isNearest ? 5.5 : 6.2}" font-weight="700" fill="${color}" font-family="sans-serif">${label}</text>
        </svg>
      </div>
    `,
    anchor: new naver.maps.Point(size / 2, height),
  };
}

function createCurrentLocationIcon() {
  return {
    content: `
      <div style="position:relative;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;pointer-events:none;">
        <div style="margin-bottom:8px;padding:6px 10px;border-radius:9999px;background:rgba(17,24,39,0.88);color:white;font-size:12px;font-weight:700;line-height:1;letter-spacing:-0.02em;box-shadow:0 10px 24px rgba(17,24,39,0.22);white-space:nowrap;">
          내 위치
        </div>
        <div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;inset:0;border-radius:9999px;background:rgba(37,99,235,0.18);"></div>
          <div style="position:absolute;inset:5px;border-radius:9999px;background:rgba(37,99,235,0.22);"></div>
          <div style="position:relative;width:18px;height:18px;border-radius:9999px;background:#2563eb;border:3px solid rgba(255,255,255,0.98);box-shadow:0 8px 20px rgba(37,99,235,0.28);"></div>
        </div>
      </div>
    `,
    anchor: new naver.maps.Point(17, 42),
  };
}

function createInfoContent(restaurant: Restaurant) {
  const menuSummary = getRestaurantMenuSummary(restaurant);

  return `
    <div style="
      padding: 14px 16px;
      min-width: 220px;
      max-width: 280px;
      font-family: 'Noto Sans KR', sans-serif;
      line-height: 1.5;
    ">
      <div style="font-size:15px;font-weight:700;color:#FD7979;margin-bottom:4px;">${restaurant.name}</div>
      ${restaurant.category ? `<span style="display:inline-block;font-size:11px;color:#888;background:#FEEAC9;padding:1px 6px;border-radius:4px;margin-bottom:6px;">${restaurant.category}</span>` : ""}
      <div style="font-size:12px;color:#666;margin-bottom:4px;">${restaurant.address || restaurant.region || ""}</div>
      ${menuSummary ? `<div style="font-size:12px;color:#999;margin-bottom:8px;">${menuSummary}</div>` : ""}
      <a href="/restaurant/${restaurant.id}" style="
        display:inline-block;
        font-size:12px;
        color:#FD7979;
        font-weight:600;
        text-decoration:none;
        border-bottom:1px solid #FDACAC;
        padding-bottom:1px;
      ">View details</a>
    </div>
  `;
}

function getBoundsFromPoints(points: Array<{ lat: number; lng: number }>) {
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;

  points.forEach((point) => {
    if (point.lat < minLat) minLat = point.lat;
    if (point.lat > maxLat) maxLat = point.lat;
    if (point.lng < minLng) minLng = point.lng;
    if (point.lng > maxLng) maxLng = point.lng;
  });

  return new naver.maps.LatLngBounds(
    new naver.maps.LatLng(minLat, minLng),
    new naver.maps.LatLng(maxLat, maxLng)
  );
}

export default function NaverMap({
  restaurants,
  selectedId,
  currentLocation,
  nearestRestaurantId,
  onMarkerClick,
}: NaverMapProps) {
  const mapRef = useRef<naver.maps.Map | null>(null);
  const markersRef = useRef<Map<string, naver.maps.Marker>>(new Map());
  const currentLocationMarkerRef = useRef<naver.maps.Marker | null>(null);
  const infoWindowRef = useRef<naver.maps.InfoWindow | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listenersRef = useRef<any[]>([]);
  const [sdkReady, setSdkReady] = useState(isNaverMapsReady());
  const [sdkError, setSdkError] = useState<string | null>(null);

  const clearMarkerListeners = useCallback(() => {
    listenersRef.current.forEach((listener) => {
      try {
        naver.maps.Event.removeListener(listener);
      } catch {
        // noop
      }
    });
    listenersRef.current = [];
  }, []);

  useEffect(() => {
    if (sdkReady) return;

    let cancelled = false;
    ensureNaverMapsSdk(NAVER_MAPS_CLIENT_ID, 15000)
      .then(() => {
        if (!cancelled) {
          setSdkReady(true);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setSdkError(error.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sdkReady]);

  useEffect(() => {
    if (!sdkReady || !containerRef.current || mapRef.current) {
      return;
    }

    try {
      const map = new naver.maps.Map(containerRef.current, {
        center: new naver.maps.LatLng(SEOUL_CENTER.lat, SEOUL_CENTER.lng),
        zoom: 7,
        zoomControl: true,
        zoomControlOptions: {
          position: naver.maps.Position.TOP_RIGHT,
          style: naver.maps.ZoomControlStyle.SMALL,
        },
        mapTypeControl: false,
        scaleControl: true,
        logoControl: true,
        mapDataControl: true,
      });

      mapRef.current = map;
      infoWindowRef.current = new naver.maps.InfoWindow({
        maxWidth: 300,
        backgroundColor: "#fff",
        borderColor: "#FFCDC9",
        borderWidth: 1,
        anchorSize: new naver.maps.Size(12, 12),
        anchorSkew: true,
        anchorColor: "#fff",
        disableAnchor: false,
      });

      window.setTimeout(() => {
        (map as any).autoResize?.();
        map.setCenter(new naver.maps.LatLng(SEOUL_CENTER.lat, SEOUL_CENTER.lng));
      }, 100);
    } catch (error) {
      console.error("Failed to initialize Naver Map:", error);
      setSdkError("Map initialization failed.");
    }

    return () => {
      clearMarkerListeners();
      markersRef.current.forEach((marker) => {
        try {
          marker.setMap(null);
        } catch {
          // noop
        }
      });
      markersRef.current.clear();

      if (currentLocationMarkerRef.current) {
        try {
          currentLocationMarkerRef.current.setMap(null);
        } catch {
          // noop
        }
        currentLocationMarkerRef.current = null;
      }

      if (mapRef.current) {
        try {
          (mapRef.current as any).destroy?.();
        } catch {
          // noop
        }
        mapRef.current = null;
      }
    };
  }, [clearMarkerListeners, sdkReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sdkReady) {
      return;
    }

    clearMarkerListeners();

    markersRef.current.forEach((marker) => {
      try {
        marker.setMap(null);
      } catch {
        // noop
      }
    });
    markersRef.current.clear();

    if (infoWindowRef.current) {
      try {
        infoWindowRef.current.close();
      } catch {
        // noop
      }
    }

    if (currentLocationMarkerRef.current) {
      try {
        currentLocationMarkerRef.current.setMap(null);
      } catch {
        // noop
      }
      currentLocationMarkerRef.current = null;
    }

    const validRestaurants = restaurants.filter(
      (restaurant) =>
        restaurant.lat != null &&
        restaurant.lng != null &&
        restaurant.lat !== 0 &&
        restaurant.lng !== 0
    );

    if (currentLocation) {
      currentLocationMarkerRef.current = new naver.maps.Marker({
        position: new naver.maps.LatLng(currentLocation.lat, currentLocation.lng),
        map,
        title: "Current location",
        icon: createCurrentLocationIcon(),
        zIndex: 300,
      });
    }

    validRestaurants.forEach((restaurant) => {
      const position = new naver.maps.LatLng(restaurant.lat, restaurant.lng);
      const isSelected = restaurant.id === selectedId;
      const isNearest = restaurant.id === nearestRestaurantId && selectedId == null;

      const marker = new naver.maps.Marker({
        position,
        map,
        title: restaurant.name,
        icon: createMarkerIcon({ isSelected, isNearest }),
        zIndex: isSelected ? 200 : isNearest ? 150 : 1,
        clickable: true,
      });

      const listener = naver.maps.Event.addListener(marker, "click", () => {
        onMarkerClick(restaurant.id);

        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(createInfoContent(restaurant));
          infoWindowRef.current.open(map, marker);
        }

        map.panTo(position, { duration: 300 });
      });

      listenersRef.current.push(listener);
      markersRef.current.set(restaurant.id, marker);
    });

    const selectedRestaurant = validRestaurants.find(
      (restaurant) => restaurant.id === selectedId
    );
    const nearestRestaurant = validRestaurants.find(
      (restaurant) => restaurant.id === nearestRestaurantId
    );

    if (selectedRestaurant) {
      map.setCenter(new naver.maps.LatLng(selectedRestaurant.lat, selectedRestaurant.lng));
      map.setZoom(16);
      return;
    }

    if (currentLocation && nearestRestaurant) {
      const bounds = getBoundsFromPoints([
        { lat: currentLocation.lat, lng: currentLocation.lng },
        { lat: nearestRestaurant.lat, lng: nearestRestaurant.lng },
      ]);
      map.fitBounds(bounds, { top: 120, right: 120, bottom: 120, left: 120 });
      return;
    }

    if (validRestaurants.length === 0) {
      if (currentLocation) {
        map.setCenter(new naver.maps.LatLng(currentLocation.lat, currentLocation.lng));
        map.setZoom(15);
      } else {
        map.setCenter(new naver.maps.LatLng(SEOUL_CENTER.lat, SEOUL_CENTER.lng));
        map.setZoom(12);
      }
      return;
    }

    if (validRestaurants.length === 1) {
      map.setCenter(new naver.maps.LatLng(validRestaurants[0].lat, validRestaurants[0].lng));
      map.setZoom(16);
      return;
    }

    const bounds = getBoundsFromPoints(
      validRestaurants.map((restaurant) => ({
        lat: restaurant.lat,
        lng: restaurant.lng,
      }))
    );
    map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
  }, [
    clearMarkerListeners,
    currentLocation,
    nearestRestaurantId,
    onMarkerClick,
    restaurants,
    sdkReady,
    selectedId,
  ]);

  useEffect(() => {
    if (!sdkReady || !mapRef.current) {
      return;
    }

    markersRef.current.forEach((marker, id) => {
      const isSelected = id === selectedId;
      const isNearest = id === nearestRestaurantId && selectedId == null;

      try {
        marker.setIcon(createMarkerIcon({ isSelected, isNearest }));
        (marker as any).setZIndex?.(isSelected ? 200 : isNearest ? 150 : 1);
      } catch {
        // noop
      }
    });

    if (selectedId && markersRef.current.has(selectedId)) {
      const marker = markersRef.current.get(selectedId);
      const restaurant = restaurants.find((item) => item.id === selectedId);

      if (marker && restaurant && mapRef.current) {
        mapRef.current.panTo(marker.getPosition(), { duration: 300 });
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(createInfoContent(restaurant));
          infoWindowRef.current.open(mapRef.current, marker);
        }
      }
    } else if (infoWindowRef.current) {
      try {
        infoWindowRef.current.close();
      } catch {
        // noop
      }
    }
  }, [nearestRestaurantId, restaurants, sdkReady, selectedId]);

  if (sdkError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-50">
        <div className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FEEAC9] to-[#FFCDC9]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FD7979" strokeWidth="1.5">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </div>
          <p className="mb-1 text-sm font-semibold text-gray-700">Failed to load map</p>
          <p className="text-xs text-gray-400">{sdkError}</p>
        </div>
      </div>
    );
  }

  if (!sdkReady) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-50">
        <div className="p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 animate-pulse items-center justify-center rounded-xl bg-gradient-to-br from-[#FEEAC9] to-[#FFCDC9]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FD7979" strokeWidth="1.5">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      id="naver-map-container"
      className="h-full w-full"
      style={{ minHeight: "400px" }}
    />
  );
}
