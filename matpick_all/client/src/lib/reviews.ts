export type SharedReview = {
  id: string;
  user: string;
  date: string;
  stars: number;
  text: string;
  photos: string[];
  createdAt?: number;
  restaurantId?: string;
};

export type ReviewSortMode = "latest" | "photos" | "top";

export type ReviewSummary = {
  count: number;
  average: number;
  photoCount: number;
  withPhotosCount: number;
  distribution: Array<{
    stars: number;
    count: number;
  }>;
};

export type ReviewPhoto = {
  id: string;
  reviewId: string;
  restaurantId?: string;
  url: string;
  user: string;
  index: number;
};

export function normalizeSharedReview(review: SharedReview): SharedReview {
  return {
    ...review,
    createdAt: Number.isFinite(review.createdAt) ? review.createdAt : Date.now(),
    photos: Array.isArray(review.photos) ? review.photos.filter(Boolean) : [],
  };
}

export function summarizeReviews(reviews: SharedReview[]): ReviewSummary {
  if (reviews.length === 0) {
    return {
      count: 0,
      average: 0,
      photoCount: 0,
      withPhotosCount: 0,
      distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: 0 })),
    };
  }

  const distribution = new Map<number, number>();
  let totalStars = 0;
  let photoCount = 0;
  let withPhotosCount = 0;

  reviews.forEach((review) => {
    totalStars += review.stars;
    distribution.set(review.stars, (distribution.get(review.stars) ?? 0) + 1);
    photoCount += review.photos.length;

    if (review.photos.length > 0) {
      withPhotosCount += 1;
    }
  });

  return {
    count: reviews.length,
    average: totalStars / reviews.length,
    photoCount,
    withPhotosCount,
    distribution: [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: distribution.get(stars) ?? 0,
    })),
  };
}

export function sortReviews<T extends SharedReview>(reviews: T[], mode: ReviewSortMode): T[] {
  const next = [...reviews];

  switch (mode) {
    case "photos":
      return next.sort((left, right) => {
        const photoDelta = right.photos.length - left.photos.length;
        if (photoDelta !== 0) return photoDelta;
        return (right.createdAt ?? 0) - (left.createdAt ?? 0);
      });
    case "top":
      return next.sort((left, right) => {
        const starDelta = right.stars - left.stars;
        if (starDelta !== 0) return starDelta;
        return (right.createdAt ?? 0) - (left.createdAt ?? 0);
      });
    case "latest":
    default:
      return next.sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0));
  }
}

export function collectReviewPhotos(reviews: SharedReview[]): ReviewPhoto[] {
  const photos: ReviewPhoto[] = [];

  reviews.forEach((review) => {
    review.photos.forEach((url, index) => {
      photos.push({
        id: `${review.id}_${index}`,
        reviewId: review.id,
        restaurantId: review.restaurantId,
        url,
        user: review.user,
        index,
      });
    });
  });

  return photos;
}

export function getPrimaryReviewPhotoUrl(reviews: SharedReview[]) {
  return collectReviewPhotos(reviews)[0]?.url ?? "";
}
