/*
 * NaverMap — 네이버 지도 컴포넌트
 * 식당 마커 표시, 클릭 시 정보창, 선택된 식당 하이라이트
 * Color Palette: #FEEAC9, #FFCDC9, #FDACAC, #FD7979
 *
 * 핵심 수정사항:
 * - naver.maps SDK 로딩 완료 대기 후 초기화
 * - HMR 시에도 안전하게 동작
 * - 마커 아이콘에서 naver.maps.Point 지연 생성
 */
import { useEffect, useRef, useState, useCallback } from "react";
import type { Restaurant } from "@/data";

interface NaverMapProps {
  restaurants: Restaurant[];
  selectedId: string | null;
  onMarkerClick: (id: string) => void;
}

const NAVER_MAPS_CLIENT_ID = import.meta.env.VITE_NAVER_MAP_CLIENT_ID?.trim() ?? "";
const NAVER_MAPS_SCRIPT_ID = "matpick-naver-maps-sdk";

/* naver.maps SDK 로딩 여부 확인 */
function isNaverMapsReady(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as any).naver !== "undefined" &&
    (window as any).naver.maps != null &&
    typeof (window as any).naver.maps.Map === "function"
  );
}

/* SDK 로딩 대기 (polling) */
function waitForNaverMaps(timeout = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isNaverMapsReady()) {
      resolve();
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      if (isNaverMapsReady()) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeout) {
        clearInterval(interval);
        reject(new Error("Naver Maps SDK 로딩 시간 초과"));
      }
    }, 100);
  });
}

function ensureNaverMapsSdk(clientId: string, timeout = 15000): Promise<void> {
  if (!clientId) {
    return Promise.reject(
      new Error("VITE_NAVER_MAP_CLIENT_ID가 설정되지 않았습니다.")
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
          "네이버 지도 SDK를 불러오지 못했습니다. Client ID와 허용 도메인을 확인해 주세요."
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

/* 커스텀 마커 아이콘 SVG — naver.maps.Point는 호출 시점에 생성 */
function createMarkerIcon(isSelected: boolean) {
  const color = isSelected ? "#FD7979" : "#FF8A8A";
  const size = isSelected ? 36 : 28;
  const strokeColor = "#fff";
  const strokeWidth = isSelected ? 2.5 : 1.5;
  const h = Math.round(size * 1.35);

  return {
    content: `
      <div style="cursor:pointer;transform:translate(-50%,-100%);">
        <svg width="${size}" height="${h}" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 24 14 24s14-13.5 14-24C28 6.268 21.732 0 14 0z" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
          <circle cx="14" cy="13" r="5.5" fill="white" opacity="0.9"/>
          <text x="14" y="16.5" text-anchor="middle" font-size="8" font-weight="bold" fill="${color}" font-family="sans-serif">🍽</text>
        </svg>
      </div>
    `,
    anchor: new naver.maps.Point(size / 2, h),
  };
}

/* 정보창 HTML */
function createInfoContent(restaurant: Restaurant) {
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
      ${restaurant.representativeMenu ? `<div style="font-size:12px;color:#999;margin-bottom:8px;">${restaurant.representativeMenu}</div>` : ""}
      <a href="/restaurant/${restaurant.id}" style="
        display:inline-block;
        font-size:12px;
        color:#FD7979;
        font-weight:600;
        text-decoration:none;
        border-bottom:1px solid #FDACAC;
        padding-bottom:1px;
      ">상세 보기 →</a>
    </div>
  `;
}

export default function NaverMap({ restaurants, selectedId, onMarkerClick }: NaverMapProps) {
  const mapRef = useRef<naver.maps.Map | null>(null);
  const markersRef = useRef<Map<string, naver.maps.Marker>>(new Map());
  const infoWindowRef = useRef<naver.maps.InfoWindow | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listenersRef = useRef<any[]>([]);
  const [sdkReady, setSdkReady] = useState(isNaverMapsReady());
  const [sdkError, setSdkError] = useState<string | null>(null);

  /* 1단계: SDK 로딩 대기 */
  useEffect(() => {
    if (sdkReady) return;
    let cancelled = false;
    ensureNaverMapsSdk(NAVER_MAPS_CLIENT_ID, 15000)
      .then(() => {
        if (!cancelled) setSdkReady(true);
      })
      .catch((err) => {
        if (!cancelled) setSdkError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [sdkReady]);

  /* 2단계: SDK 준비 후 지도 초기화 */
  useEffect(() => {
    if (!sdkReady || !containerRef.current) return;
    // 이미 초기화된 경우 스킵
    if (mapRef.current) return;

    try {
      const map = new naver.maps.Map(containerRef.current, {
        center: new naver.maps.LatLng(37.5665, 126.978), // 서울 중심
        zoom: 7, // 한국 전체가 보이는 줌 레벨
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

      // 지도 크기 재계산 (컨테이너가 flex로 크기 결정되는 경우 필요)
      setTimeout(() => {
        if (map) {
          // 지도 크기 재계산 (flex 컨테이너 대응)
          (map as any).autoResize?.();
          // 초기 중심 다시 설정 (크기 변경 후)
          map.setCenter(new naver.maps.LatLng(37.5665, 126.978));
        }
      }, 100);

    } catch (err) {
      console.error("네이버 지도 초기화 실패:", err);
      setSdkError("지도 초기화에 실패했습니다.");
    }

    return () => {
      // 컴포넌트 언마운트 시 정리
      listenersRef.current.forEach(l => {
        try { naver.maps.Event.removeListener(l); } catch {}
      });
      listenersRef.current = [];
      markersRef.current.forEach(m => {
        try { m.setMap(null); } catch {}
      });
      markersRef.current.clear();
      if (mapRef.current) {
        try { (mapRef.current as any).destroy?.(); } catch {}
        mapRef.current = null;
      }
    };
  }, [sdkReady]);

  /* 3단계: 마커 업데이트 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sdkReady) return;

    // 기존 마커 제거
    listenersRef.current.forEach(l => {
      try { naver.maps.Event.removeListener(l); } catch {}
    });
    listenersRef.current = [];
    markersRef.current.forEach(m => {
      try { m.setMap(null); } catch {}
    });
    markersRef.current.clear();

    // 정보창 닫기
    if (infoWindowRef.current) {
      try { infoWindowRef.current.close(); } catch {}
    }

    // 좌표가 있는 식당만 필터
    const validRestaurants = restaurants.filter(
      (r) => r.lat != null && r.lng != null && r.lat !== 0 && r.lng !== 0
    );

    if (validRestaurants.length === 0) {
      // 좌표가 없으면 서울 중심으로
      map.setCenter(new naver.maps.LatLng(37.5665, 126.978));
      map.setZoom(12);
      return;
    }

    // bounds 계산을 위한 좌표 수집
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;

    validRestaurants.forEach((restaurant) => {
      const lat = restaurant.lat;
      const lng = restaurant.lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;

      const position = new naver.maps.LatLng(lat, lng);
      const isSelected = restaurant.id === selectedId;

      const marker = new naver.maps.Marker({
        position,
        map,
        title: restaurant.name,
        icon: createMarkerIcon(isSelected),
        zIndex: isSelected ? 100 : 1,
        clickable: true,
      });

      // 클릭 이벤트
      const listener = naver.maps.Event.addListener(marker, "click", () => {
        onMarkerClick(restaurant.id);

        // 정보창 열기
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(createInfoContent(restaurant));
          infoWindowRef.current.open(map, marker);
        }

        // 지도 중심 이동
        map.panTo(position, { duration: 300 });
      });

      listenersRef.current.push(listener);
      markersRef.current.set(restaurant.id, marker);
    });

    // 모든 마커가 보이도록 bounds 조정
    if (validRestaurants.length === 1) {
      map.setCenter(new naver.maps.LatLng(validRestaurants[0].lat, validRestaurants[0].lng));
      map.setZoom(16);
    } else if (validRestaurants.length > 1) {
      const bounds = new naver.maps.LatLngBounds(
        new naver.maps.LatLng(minLat, minLng),
        new naver.maps.LatLng(maxLat, maxLng)
      );
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    }
  }, [restaurants, sdkReady, onMarkerClick]);

  /* 4단계: 선택된 마커 하이라이트 */
  useEffect(() => {
    if (!sdkReady || !mapRef.current) return;

    markersRef.current.forEach((marker, id) => {
      const isSelected = id === selectedId;
      try {
        marker.setIcon(createMarkerIcon(isSelected));
        (marker as any).setZIndex?.(isSelected ? 100 : 1);
      } catch {}
    });

    // 선택된 식당으로 지도 이동
    if (selectedId && markersRef.current.has(selectedId)) {
      const marker = markersRef.current.get(selectedId)!;
      const restaurant = restaurants.find((r) => r.id === selectedId);
      if (mapRef.current && restaurant) {
        mapRef.current.panTo(marker.getPosition(), { duration: 300 });
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(createInfoContent(restaurant));
          infoWindowRef.current.open(mapRef.current, marker);
        }
      }
    } else {
      // 선택 해제 시 정보창 닫기
      if (infoWindowRef.current) {
        try { infoWindowRef.current.close(); } catch {}
      }
    }
  }, [selectedId, restaurants, sdkReady]);

  /* SDK 에러 시 fallback UI */
  if (sdkError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#FEEAC9] to-[#FFCDC9] flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FD7979" strokeWidth="1.5">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">지도를 불러올 수 없습니다</p>
          <p className="text-xs text-gray-400">{sdkError}</p>
        </div>
      </div>
    );
  }

  /* SDK 로딩 중 */
  if (!sdkReady) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-[#FEEAC9] to-[#FFCDC9] flex items-center justify-center animate-pulse">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FD7979" strokeWidth="1.5">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">지도 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      id="naver-map-container"
      style={{ minHeight: "400px" }}
    />
  );
}
