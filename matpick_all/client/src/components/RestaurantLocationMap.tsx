import { useEffect, useRef, useState } from "react";
import type { Restaurant } from "@/data/types";
import {
  ensureNaverMapsSdk,
  NAVER_MAPS_AUTH_FAILURE_EVENT,
} from "@/lib/naverMaps";

/** A small neighborhood map; navigation stays in the buttons below it. */
export default function RestaurantLocationMap({
  restaurant,
  english,
}: {
  restaurant: Restaurant;
  english: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  useEffect(() => {
    let active = true;
    let map: naver.maps.Map | undefined;
    let marker: naver.maps.Marker | undefined;
    let observer: ResizeObserver | undefined;
    setStatus("loading");
    const fail = () => {
      if (active) setStatus("error");
    };
    window.addEventListener(NAVER_MAPS_AUTH_FAILURE_EVENT, fail);
    void ensureNaverMapsSdk()
      .then(() => {
        if (!active || !container.current) return;
        const position = new naver.maps.LatLng(restaurant.lat, restaurant.lng);
        map = new naver.maps.Map(container.current, {
          center: position,
          zoom: 15,
          minZoom: 11,
          maxZoom: 18,
          zoomControl: true,
          zoomControlOptions: { position: naver.maps.Position.TOP_RIGHT },
          mapTypeControl: false,
          scaleControl: true,
          logoControl: true,
          mapDataControl: true,
        });
        map.setOptions("scrollWheel", false);
        map.setOptions("draggable", false);
        map.setOptions("pinchZoom", false);
        map.setOptions("keyboardShortcuts", false);
        marker = new naver.maps.Marker({
          map,
          position,
          title: restaurant.name,
          clickable: false,
        });
        observer = new ResizeObserver(() => {
          if (!active || !container.current || !map) return;
          map.setSize(
            new naver.maps.Size(
              container.current.clientWidth,
              container.current.clientHeight
            )
          );
          map.setCenter(position);
        });
        observer.observe(container.current);
        setStatus("ready");
      })
      .catch(fail);
    return () => {
      active = false;
      window.removeEventListener(NAVER_MAPS_AUTH_FAILURE_EVENT, fail);
      observer?.disconnect();
      marker?.setMap(null);
      map?.destroy();
    };
  }, [restaurant.id, restaurant.lat, restaurant.lng, restaurant.name]);
  return (
    <div
      className="detail-mini-map"
      aria-label={
        restaurant.name + (english ? " neighborhood map" : " 주변 지도")
      }
    >
      <div ref={container} className="detail-mini-map-canvas" />
      {status !== "ready" && (
        <p role="status" className="detail-mini-map-status">
          {status === "loading"
            ? english
              ? "Loading map…"
              : "지도를 불러오는 중…"
            : english
              ? "Map unavailable. Open Naver Map below."
              : "지도를 불러오지 못했어요. 아래 네이버지도에서 확인해 주세요."}
        </p>
      )}
    </div>
  );
}
