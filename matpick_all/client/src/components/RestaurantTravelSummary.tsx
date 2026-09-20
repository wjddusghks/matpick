import { Car, ArrowUpRight } from "lucide-react";
import type { Restaurant } from "@/data/types";
import { getRestaurantDirectionsUrl } from "@/lib/restaurantDirections";
import {
  formatRouteDistance,
  formatTravelTime,
  type RestaurantTravelTimes,
} from "@/lib/travelTimes";

export default function RestaurantTravelSummary({
  restaurant,
  origin,
  travel,
  loading,
  english = false,
  onRequest,
}: {
  restaurant: Restaurant;
  origin: { lat: number; lng: number } | null;
  travel?: RestaurantTravelTimes;
  loading?: boolean;
  english?: boolean;
  onRequest?: () => void;
}) {
  if (!origin || restaurant.isOverseas) return null;
  const driving = travel?.driving;
  if (!travel && onRequest)
    return (
      <button
        type="button"
        onClick={onRequest}
        disabled={loading}
        className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl bg-[#f8f6f7] p-3 text-left text-xs font-semibold text-[#68565f] disabled:opacity-60"
      >
        <span className="flex items-center gap-2">
          <Car className="h-4 w-4" />
          {loading
            ? english
              ? "Checking route…"
              : "경로 조회 중…"
            : english
              ? "Check driving time and distance"
              : "자동차 시간·거리 확인"}
        </span>
        <span aria-hidden>→</span>
      </button>
    );
  const hint = loading
    ? english
      ? "Checking route…"
      : "경로 조회 중…"
    : driving?.status === "no_route"
      ? english
        ? "No driving route"
        : "자동차 경로 없음"
      : english
        ? "Check in Naver Map"
        : "네이버지도에서 확인";
  return (
    <a
      href={getRestaurantDirectionsUrl(restaurant, origin)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={
        (english ? "Naver driving directions to " : "네이버 자동차 길찾기 ") +
        restaurant.name
      }
      className="mt-3 flex items-center gap-3 rounded-xl bg-[#f8f6f7] p-3 text-[#68565f] hover:bg-[#fff0f4]"
    >
      <Car className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px]">
          {english ? "Drive from my location" : "내 위치에서 자동차로"}
        </span>
        <strong className="mt-0.5 block text-sm text-[#43333c]">
          {driving?.status === "ok"
            ? formatTravelTime(driving.durationMinutes, english) +
              " · " +
              formatRouteDistance(driving.distanceMeters)
            : hint}
        </strong>
        <span className="mt-1 block text-[10px] text-[#8b7c83]">
          {english
            ? "NAVER Maps · at time of lookup"
            : "네이버지도 · 조회 시점 기준"}
        </span>
      </span>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
    </a>
  );
}
