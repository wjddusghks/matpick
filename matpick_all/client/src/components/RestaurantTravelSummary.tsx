import { Car, BusFront, ArrowUpRight } from "lucide-react";
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
}: {
  restaurant: Restaurant;
  origin: { lat: number; lng: number } | null;
  travel?: RestaurantTravelTimes;
  loading?: boolean;
  english?: boolean;
}) {
  if (!origin || restaurant.isOverseas) return null;
  const modes = [
    {
      key: "driving",
      mode: "car",
      name: english ? "Car" : "자동차",
      Icon: Car,
    },
    {
      key: "transit",
      mode: "traffic",
      name: english ? "Transit" : "대중교통",
      Icon: BusFront,
    },
  ] as const;
  return (
    <div className="mt-3 rounded-xl bg-[#f8f6f7] p-2.5">
      <p className="mb-2 text-[10px] text-[#8b7c83]">
        {english
          ? "From my location · at time of lookup"
          : "내 위치에서 · 조회 시점 기준"}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {modes.map(({ key, mode, name, Icon }) => {
          const value = travel?.[key];
          const hint = loading
            ? english
              ? "Checking route…"
              : "경로 조회 중…"
            : value?.status === "no_route"
              ? english
                ? "No route found"
                : "경로 없음"
              : value?.status === "unsupported"
                ? english
                  ? "Check in map"
                  : "장거리·지역 확인"
                : english
                  ? "Check in map"
                  : "지도에서 확인";
          return (
            <a
              key={key}
              href={getRestaurantDirectionsUrl(restaurant, origin, mode)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${name} ${english ? "directions to" : "길찾기"} ${restaurant.name}`}
              className="flex min-h-12 min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg bg-white p-2 text-xs text-[#68565f] hover:bg-[#fff0f4]"
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{name}</span>
              <ArrowUpRight className="ml-auto h-3 w-3 shrink-0" />
              <span className="w-full font-semibold text-[#43333c]">
                {value?.status === "ok"
                  ? `${formatTravelTime(value.durationMinutes, english)} · ${formatRouteDistance(value.distanceMeters)}`
                  : hint}
              </span>
              {value?.status === "ok" && (
                <span className="text-[9px] text-[#9a8c93]">
                  {value.provider}
                  {key === "transit"
                    ? english
                      ? " · includes walking"
                      : " · 도보 포함"
                    : ""}
                </span>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
