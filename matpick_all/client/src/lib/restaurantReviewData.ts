import type { SharedReview } from "@/lib/reviews";
import { ageGroupLabel } from "@/lib/reviewAge";

const EDITORIAL_AUTHORS = new Set(["맛픽가이드", "맛픽 가이드"]);

export function mergeRestaurantReviews(
  ...collections: unknown[][]
): SharedReview[] {
  const byId = new Map<string, SharedReview>();
  for (const value of collections.flat()) {
    if (!value || typeof value !== "object") continue;
    const review = value as Partial<SharedReview>;
    if (
      typeof review.id !== "string" ||
      !review.id ||
      typeof review.user !== "string" ||
      EDITORIAL_AUTHORS.has(review.user.trim()) ||
      typeof review.stars !== "number" ||
      !Number.isFinite(review.stars) ||
      review.stars < 1 ||
      review.stars > 5
    )
      continue;
    // Earlier collections contain the fresh server response or new submission.
    if (byId.has(review.id)) continue;
    byId.set(review.id, {
      id: review.id,
      user: review.user,
      stars: review.stars,
      text: typeof review.text === "string" ? review.text : "",
      date: typeof review.date === "string" ? review.date : "",
      createdAt:
        typeof review.createdAt === "number" &&
        Number.isFinite(review.createdAt)
          ? review.createdAt
          : 0,
      photos: Array.isArray(review.photos)
        ? review.photos.filter(
            (url): url is string =>
              typeof url === "string" && url.trim().length > 0
          )
        : [],
      ...(typeof review.restaurantId === "string"
        ? { restaurantId: review.restaurantId }
        : {}),
      ...(review.ageConsentVersion === "review-age-v1" &&
      ageGroupLabel(review.ageGroup) &&
      ["birth_date", "kakao_range", "naver_range"].includes(
        review.ageBasis || ""
      )
        ? {
            ageGroup: review.ageGroup,
            ageBasis: review.ageBasis,
            ageCheckedAt: review.ageCheckedAt,
            ageConsentAt: review.ageConsentAt,
            ageConsentVersion: review.ageConsentVersion,
          }
        : {}),
    });
  }
  return Array.from(byId.values()).sort(
    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
  );
}

export function readRestaurantReviews(restaurantId: string): SharedReview[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(
        `matpick_shared_reviews_v2_${restaurantId}`
      ) ?? "[]"
    );
    return Array.isArray(value) ? mergeRestaurantReviews(value) : [];
  } catch {
    return [];
  }
}

export function storeRestaurantReviews(
  restaurantId: string,
  reviews: SharedReview[]
) {
  try {
    window.localStorage.setItem(
      `matpick_shared_reviews_v2_${restaurantId}`,
      JSON.stringify(reviews)
    );
  } catch {
    /* Shared reviews still work when device storage is unavailable. */
  }
}
