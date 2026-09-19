import type { Restaurant } from "@/data/types";

export type OperationState =
  | "unknown"
  | "operating"
  | "closed"
  | "moved"
  | "temporarily_closed";

export function getOperationState(restaurant: Restaurant): OperationState {
  if (restaurant.operationState) return restaurant.operationState;
  const value = restaurant.operationStatus?.trim() ?? "";
  if (/폐업|영업종료|permanently\s*closed/i.test(value)) return "closed";
  if (/이전|relocated|moved/i.test(value)) return "moved";
  if (/휴업|temporarily\s*closed/i.test(value)) return "temporarily_closed";
  // '영업' is a business status, not a live opening-hours calculation.
  if (value === "영업" || value === "operating") return "operating";
  return "unknown";
}

export function hasUsableCoordinates(point: Pick<Restaurant, "lat" | "lng">) {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat !== 0 &&
    point.lng !== 0 &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180
  );
}

export function isRestaurantRecommendable(restaurant: Restaurant) {
  return !restaurant.recommendationHold && !["closed", "moved", "temporarily_closed"].includes(
    getOperationState(restaurant)
  );
}

export function getOperationNotice(
  restaurant: Restaurant,
  locale: "ko" | "en" = "ko"
) {
  if (restaurant.recommendationHold) {
    return locale === "en"
      ? "This listing is being checked and is temporarily excluded from recommendations."
      : "식당 정보를 확인 중입니다. 확인이 끝날 때까지 추천에서 제외했습니다.";
  }
  const state = getOperationState(restaurant);
  const labels = {
    closed: [
      "폐업으로 확인된 식당입니다. 추천 목록에서 제외했습니다.",
      "Reported permanently closed. Excluded from recommendations.",
    ],
    moved: [
      "이전 정보가 있는 식당입니다. 새 위치를 확인해 주세요.",
      "Reported relocated. Please check the new location.",
    ],
    temporarily_closed: [
      "휴업 정보가 있는 식당입니다. 방문 전 확인해 주세요.",
      "Reported temporarily closed. Please check before visiting.",
    ],
  };
  return state in labels
    ? labels[state as keyof typeof labels][locale === "en" ? 1 : 0]
    : null;
}
