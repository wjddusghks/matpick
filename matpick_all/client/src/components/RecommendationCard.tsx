import { Link } from "wouter";
import { MapPin, Navigation, Share2 } from "lucide-react";
import { toast } from "sonner";
import { getRestaurantRecommendationLabels, type Restaurant } from "@/data";
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
}: {
  restaurant: Restaurant;
  selected?: boolean;
  distanceMeters?: number | null;
  rank?: number;
  onSelect?: () => void;
}) {
  const { locale } = useLocale();
  const english = locale === "en";
  const labels = getRestaurantRecommendationLabels(restaurant.id);
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
  const share = async () => {
    const url = new URL(
      `/restaurant/${encodeURIComponent(restaurant.id)}`,
      window.location.origin
    ).href;
    try {
      if (navigator.share)
        await navigator.share({
          title: restaurant.name,
          text: labels.join(" · "),
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
        toast.success(english ? "Link copied" : "식당 링크를 복사했어요");
      }
      trackMarketingEvent("recommendation_share", {
        restaurant_id: restaurant.id,
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        toast.error(
          english
            ? "Could not share. Open details to copy the link."
            : "공유하지 못했어요. 상세 화면에서 링크를 복사해 주세요."
        );
    }
  };
  return (
    <article
      data-restaurant-id={restaurant.id}
      className={`border-b border-[#eee7e9] p-4 ${selected ? "bg-[#fff5f6]" : "bg-white"}`}
    >
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
        <Link href={`/restaurant/${restaurant.id}`} className="block">
          {headline}
        </Link>
      )}
      <p className="mt-2 text-xs font-medium leading-5 text-[#956624]">
        {labels.length
          ? `${labels.slice(0, 2).join(" · ")}${english ? " · Featured" : " 소개"}${labels.length > 2 ? ` +${labels.length - 2}` : ""}`
          : english
            ? "Source being checked"
            : "소개 근거 확인 중"}
      </p>
      <p className="mt-1 flex items-start gap-1 text-xs leading-5 text-[#82787d]">
        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
        {restaurant.address}
      </p>
      {notice && (
        <p role="status" className="mt-2 text-xs font-medium text-[#a44137]">
          {notice}
        </p>
      )}
      <div className="mt-3 flex items-center gap-2">
        {hasUsableCoordinates(restaurant) &&
          isRestaurantRecommendable(restaurant) && (
            <a
              href={getRestaurantDirectionsUrl(restaurant)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackMarketingEvent("directions_click", {
                  restaurant_id: restaurant.id,
                  provider: "kakao",
                  placement: "recommendation_card",
                })
              }
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#ef6479] px-3 text-sm font-semibold text-white hover:bg-[#df5269]"
            >
              <Navigation className="h-4 w-4" />
              {english ? "Directions" : "길찾기"}
            </a>
          )}
        <button
          type="button"
          onClick={() => void share()}
          aria-label={
            english ? `Share ${restaurant.name}` : `${restaurant.name} 공유`
          }
          className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-[#e7dfe2] px-3 text-xs text-[#655c61]"
        >
          <Share2 className="h-4 w-4" />
          {english ? "Share" : "공유"}
        </button>
        <Link
          href={`/restaurant/${restaurant.id}`}
          className="px-1 text-xs text-[#756c70] underline underline-offset-4"
        >
          {english ? "Details" : "상세"}
        </Link>
      </div>
    </article>
  );
}
