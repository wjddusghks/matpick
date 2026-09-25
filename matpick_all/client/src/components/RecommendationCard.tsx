import HeartButton from "@/components/HeartButton";
import { restaurantDetailPath } from "@/lib/restaurantNavigation";
import { useState } from "react";
import ShareSheet from "@/components/ShareSheet";
import RestaurantSourceBadges from "@/components/RestaurantSourceBadges";
import RestaurantTravelSummary from "@/components/RestaurantTravelSummary";
import type { RestaurantTravelTimes } from "@/lib/travelTimes";
import { buildAbsoluteUrl } from "@/lib/seo";
import { Link } from "wouter";
import { MapPin, Navigation, Share2 } from "lucide-react";
import {
  getRestaurantRecommendationLabels,
  getRestaurantMenuItems,
  type Restaurant,
} from "@/data";
import { useLocale } from "@/contexts/LocaleContext";
import { getRestaurantDirectionsUrl } from "@/lib/restaurantDirections";
import {
  getOperationNotice,
  hasUsableCoordinates,
  isRestaurantRecommendable,
} from "@/lib/restaurantEligibility";
import { translateCuisineLabel } from "@/lib/locale";
import { trackMarketingEvent } from "@/lib/marketing";

export default function RecommendationCard({
  restaurant,
  selected = false,
  distanceMeters,
  rank,
  onSelect,
  origin = null,
  travel,
  travelLoading,
  onRequestTravel,
}: {
  restaurant: Restaurant;
  selected?: boolean;
  distanceMeters?: number | null;
  rank?: number;
  onSelect?: () => void;
  origin?: { lat: number; lng: number } | null;
  travel?: RestaurantTravelTimes;
  travelLoading?: boolean;
  onRequestTravel?: () => void;
}) {
  const { locale } = useLocale();
  const english = locale === "en";
  const [shareOpen, setShareOpen] = useState(false);
  const labels = getRestaurantRecommendationLabels(restaurant.id);
  const menuSummary = getRestaurantMenuItems(restaurant)
    .map(menu => menu.name.trim())
    .filter(name => !/^(메인|추가|점심|저녁|추천|대표)?\s*메뉴$/.test(name))
    .slice(0, 3)
    .join(" · ");
  const distance =
    distanceMeters == null
      ? null
      : distanceMeters < 1000
        ? `${Math.round(distanceMeters)}m`
        : `${(distanceMeters / 1000).toFixed(1)}km`;
  const notice = getOperationNotice(restaurant, locale);
  const headline = (
    <>
      <span className="flex items-center gap-2">
        {rank != null && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#fff0f2] text-xs font-bold text-[#ce425a]">
            {rank}
          </span>
        )}
        <span className="text-base font-bold text-[#262126]">
          {restaurant.name}
        </span>
      </span>
      <span className="mt-1 block text-xs text-[#756c70]">
        {translateCuisineLabel(restaurant.category?.trim() || "미분류", locale)}
        {distance && ` · ${english ? "Straight-line" : "직선거리"} ${distance}`}
      </span>
    </>
  );
  return (
    <article
      data-restaurant-id={restaurant.id}
      className={`border-b border-[#eee7e9] p-4 ${selected ? "bg-[#fff5f6]" : "bg-white"}`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {onSelect ? (
            <button
              type="button"
              aria-pressed={selected}
              onClick={onSelect}
              className="block w-full text-left rounded focus-visible:outline-2 focus-visible:outline-[#ff7b83]"
            >
              {headline}
            </button>
          ) : (
            <Link href={restaurantDetailPath(restaurant)} className="block">
              {headline}
            </Link>
          )}
        </div>
        <HeartButton restaurantId={restaurant.id} size="lg" />
      </div>
      {menuSummary && (
        <p className="mt-2 text-sm font-semibold leading-5 text-[#52434b]">
          {menuSummary}
        </p>
      )}
      <RestaurantSourceBadges
        id={restaurant.id}
        name={restaurant.name}
        english={english}
      />
      <p className="mt-1 flex items-start gap-1 text-xs leading-5 text-[#82787d]">
        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
        {restaurant.address}
      </p>
      {notice && (
        <p role="status" className="mt-2 text-xs font-medium text-[#a44137]">
          {notice}
        </p>
      )}
      <RestaurantTravelSummary
        restaurant={restaurant}
        origin={origin}
        travel={travel}
        loading={travelLoading}
        onRequest={onRequestTravel}
        english={english}
      />
      <div className="mt-3 flex items-center gap-2">
        {hasUsableCoordinates(restaurant) &&
          isRestaurantRecommendable(restaurant) && (
            <a
              href={getRestaurantDirectionsUrl(restaurant, origin)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackMarketingEvent("directions_click", {
                  restaurant_id: restaurant.id,
                  provider: "naver",
                  placement: "recommendation_card",
                })
              }
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#ef6479] px-3 text-sm font-semibold text-white hover:bg-[#df5269]"
            >
              <Navigation className="h-4 w-4" />
              {english ? "Naver directions" : "네이버 길찾기"}
            </a>
          )}
        <button
          type="button"
          onClick={() => {
            setShareOpen(true);
            trackMarketingEvent("recommendation_share", {
              restaurant_id: restaurant.id,
            });
          }}
          aria-label={
            english ? `Share ${restaurant.name}` : `${restaurant.name} 공유`
          }
          className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-[#e7dfe2] px-3 text-xs text-[#655c61]"
        >
          <Share2 className="h-4 w-4" />
          {english ? "Share" : "공유"}
        </button>
        <Link
          href={restaurantDetailPath(restaurant)}
          className="inline-flex min-h-11 items-center px-2 text-sm text-[#756c70] underline underline-offset-4"
        >
          {english ? "Details" : "상세"}
        </Link>
      </div>
      {shareOpen && (
        <ShareSheet
          open
          onClose={() => setShareOpen(false)}
          title={restaurant.name}
          text={labels.join(" · ")}
          url={buildAbsoluteUrl(
            `/restaurant/${encodeURIComponent(restaurant.id)}`
          )}
        />
      )}
    </article>
  );
}
