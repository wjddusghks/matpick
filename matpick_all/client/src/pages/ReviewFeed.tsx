import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Camera, MessageSquareText, Star } from "lucide-react";
import { AdsenseSlot } from "@/components/monetization/MonetizationSlot";
import { getRestaurantById } from "@/data";
import { trackMarketingEvent } from "@/lib/marketing";
import { getRestaurantDisplayImage } from "@/lib/restaurantPresentation";
import {
  collectReviewPhotos,
  sortReviews,
  summarizeReviews,
  type ReviewSortMode,
  type SharedReview,
} from "@/lib/reviews";
import { useSeo } from "@/lib/seo";

type FeedReview = SharedReview & {
  restaurantId: string;
};

export default function ReviewFeed() {
  const [reviews, setReviews] = useState<FeedReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortMode, setSortMode] = useState<ReviewSortMode>("latest");

  useEffect(() => {
    let ignore = false;

    void fetch("/api/reviews?scope=feed&limit=80")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load reviews");
        }

        return response.json() as Promise<{ reviews?: FeedReview[] }>;
      })
      .then((payload) => {
        if (ignore) {
          return;
        }

        setReviews(
          Array.isArray(payload.reviews)
            ? payload.reviews.filter(
                (review): review is FeedReview =>
                  typeof review.restaurantId === "string" && review.restaurantId.length > 0
              )
            : []
        );
      })
      .catch(() => {
        if (!ignore) {
          setReviews([]);
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    trackMarketingEvent("review_feed_view", {
      review_count: reviews.length,
    });
  }, [reviews.length]);

  const summary = useMemo(() => summarizeReviews(reviews), [reviews]);
  const visibleReviews = useMemo(() => sortReviews(reviews, sortMode), [reviews, sortMode]);
  const galleryPhotos = useMemo(() => collectReviewPhotos(reviews).slice(0, 18), [reviews]);

  useSeo({
    title: "방문자 리뷰 모아보기",
    description: "맛픽 사용자들이 남긴 최신 리뷰와 사진을 한곳에서 둘러보세요.",
    path: "/reviews",
    type: "website",
  });

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff7f8_0%,#ffffff_32%)]">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <div className="sticky top-0 z-20 flex items-center gap-3 rounded-[28px] border border-[#f3e5e8] bg-white/92 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.05)] backdrop-blur">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
                return;
              }

              window.location.href = "/";
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#f1d9de] bg-[#fff7f8] text-[#444] transition hover:border-[#ffb3be] hover:text-[#ff6f7c]"
            aria-label="뒤로가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#c98b95]">
              Review Feed
            </p>
            <h1 className="mt-1 text-[22px] font-black tracking-[-0.03em] text-[#171717] sm:text-[28px]">
              방문자 리뷰 모아보기
            </h1>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <div className="rounded-[30px] border border-[#f3e3e6] bg-white px-5 py-5 shadow-[0_22px_60px_rgba(0,0,0,0.05)] sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#ff7b83]">
                    다른 사람들이 남긴 리뷰와 사진을 한 번에 둘러보세요.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#7a7a7a]">
                    최신 리뷰, 사진이 많은 리뷰, 높은 평점 리뷰를 빠르게 살펴보고 바로 식당 상세로
                    이동할 수 있어요.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "latest" as const, label: "최신순" },
                    { key: "photos" as const, label: "사진 많은 순" },
                    { key: "top" as const, label: "높은 평점순" },
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => {
                        trackMarketingEvent("review_feed_sort", {
                          sort_mode: option.key,
                        });
                        setSortMode(option.key);
                      }}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        sortMode === option.key
                          ? "bg-[#ff7b83] text-white shadow-[0_10px_24px_rgba(255,123,131,0.24)]"
                          : "border border-[#f1d9de] bg-white text-[#6d6d6d] hover:border-[#ffb3be] hover:text-[#ff6f7c]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {galleryPhotos.length > 0 ? (
              <section className="rounded-[30px] border border-[#f3e3e6] bg-white px-5 py-5 shadow-[0_22px_60px_rgba(0,0,0,0.05)] sm:px-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black tracking-[-0.02em] text-[#191919]">
                      사진 모아보기
                    </h2>
                    <p className="mt-1 text-sm text-[#868686]">
                      방문자들이 직접 올린 최근 사진 {galleryPhotos.length}장을 먼저 볼 수 있어요.
                    </p>
                  </div>
                  <Camera className="h-5 w-5 text-[#ff7b83]" />
                </div>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {galleryPhotos.map((photo) => {
                    const restaurant = photo.restaurantId ? getRestaurantById(photo.restaurantId) : null;

                    return (
                      <Link
                        key={photo.id}
                        href={photo.restaurantId ? `/restaurant/${photo.restaurantId}` : "/reviews"}
                        onClick={() => {
                          if (!photo.restaurantId || !restaurant) {
                            return;
                          }

                          trackMarketingEvent("review_feed_restaurant_click", {
                            restaurant_id: restaurant.id,
                            restaurant_name: restaurant.name,
                            source: "gallery",
                            sort_mode: sortMode,
                          });
                        }}
                      >
                        <div className="group overflow-hidden rounded-[20px] border border-[#f2e6e9] bg-[#fff8f9]">
                          <img
                            src={photo.url}
                            alt={`${photo.user} 리뷰 사진`}
                            className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                            loading="lazy"
                          />
                          <div className="px-3 py-2">
                            <p className="truncate text-xs font-semibold text-[#252525]">
                              {restaurant?.name ?? "리뷰 사진"}
                            </p>
                            <p className="truncate text-[11px] text-[#8a8a8a]">{photo.user}</p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <AdsenseSlot label="Sponsored" />

            <section className="space-y-4">
              {isLoading ? (
                <div className="rounded-[30px] border border-dashed border-[#eed7db] bg-white px-6 py-16 text-center text-sm text-[#8b8b8b]">
                  리뷰 피드를 불러오는 중이에요.
                </div>
              ) : null}

              {!isLoading && visibleReviews.length === 0 ? (
                <div className="rounded-[30px] border border-dashed border-[#eed7db] bg-white px-6 py-16 text-center text-sm text-[#8b8b8b]">
                  아직 공용 리뷰가 많지 않아요. 첫 리뷰를 남겨보면 이 피드에도 바로 반영돼요.
                </div>
              ) : null}

              {visibleReviews.map((review, index) => {
                const restaurant = getRestaurantById(review.restaurantId);
                const displayImage = restaurant
                  ? getRestaurantDisplayImage(restaurant, {
                      width: 480,
                      height: 320,
                      reviewPhotoUrl: review.photos[0] ?? "",
                    })
                  : null;

                return (
                  <div key={`${review.restaurantId}_${review.id}`} className="space-y-4">
                    <article className="rounded-[30px] border border-[#f3e3e6] bg-white px-5 py-5 shadow-[0_22px_60px_rgba(0,0,0,0.05)] sm:px-6">
                      <div className="flex flex-col gap-5 lg:flex-row">
                      <div className="lg:w-[280px]">
                        {restaurant ? (
                          <Link
                            href={`/restaurant/${restaurant.id}`}
                            onClick={() =>
                              trackMarketingEvent("review_feed_restaurant_click", {
                                restaurant_id: restaurant.id,
                                restaurant_name: restaurant.name,
                                sort_mode: sortMode,
                              })
                            }
                          >
                            <div className="overflow-hidden rounded-[24px] border border-[#f0e2e6] bg-[#fff8f9]">
                              <div className="relative">
                                <img
                                  src={displayImage?.src}
                                  alt={restaurant.name}
                                  className="aspect-[4/3] w-full object-cover"
                                  loading="lazy"
                                />
                                {displayImage?.source === "review" ? (
                                  <span className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-semibold text-[#ff6f7c] backdrop-blur">
                                    방문자 사진
                                  </span>
                                ) : null}
                              </div>
                              <div className="space-y-1 px-4 py-4">
                                <p className="text-base font-black tracking-[-0.02em] text-[#191919]">
                                  {restaurant.name}
                                </p>
                                <p className="line-clamp-2 text-sm leading-6 text-[#747474]">
                                  {restaurant.address}
                                </p>
                              </div>
                            </div>
                          </Link>
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ffecee] text-sm font-bold text-[#ff7b83]">
                                {review.user.slice(0, 1)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-[#171717]">{review.user}</p>
                                <p className="text-xs text-[#999999]">{review.date}</p>
                              </div>
                            </div>
                          </div>
                          <div className="inline-flex items-center gap-1 rounded-full bg-[#fff5da] px-3 py-1.5 text-sm font-semibold text-[#d18a00]">
                            <Star className="h-4 w-4 fill-current" />
                            {review.stars.toFixed(1)}
                          </div>
                        </div>

                        {review.text ? (
                          <p className="mt-4 text-sm leading-7 text-[#4f4f4f]">{review.text}</p>
                        ) : null}

                        {review.photos.length > 0 ? (
                          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                            {review.photos.map((photo, index) => (
                              <div
                                key={`${review.id}_${index}`}
                                className="overflow-hidden rounded-[20px] border border-[#f0e2e6]"
                              >
                                <img
                                  src={photo}
                                  alt={`${review.user} 리뷰 사진 ${index + 1}`}
                                  className="aspect-square w-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {restaurant ? (
                          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#f4ecee] pt-4">
                            <div className="text-sm text-[#7f7f7f]">
                              <span className="font-semibold text-[#ff7b83]">{restaurant.name}</span> 상세 페이지에서
                              메뉴와 위치를 더 볼 수 있어요.
                            </div>
                            <Link
                              href={`/restaurant/${restaurant.id}`}
                              onClick={() =>
                                trackMarketingEvent("review_feed_restaurant_click", {
                                  restaurant_id: restaurant.id,
                                  restaurant_name: restaurant.name,
                                  sort_mode: sortMode,
                                  source: "review_footer",
                                })
                              }
                            >
                              <div className="inline-flex items-center gap-2 rounded-full bg-[#ff7b83] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,123,131,0.22)]">
                                식당 상세 보기
                              </div>
                            </Link>
                          </div>
                        ) : null}
                      </div>
                      </div>
                    </article>
                    {(index + 1) % 8 === 0 && index + 1 < visibleReviews.length ? (
                      <AdsenseSlot label="Sponsored" />
                    ) : null}
                  </div>
                );
              })}
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-6 lg:h-fit">
            <div className="rounded-[30px] border border-[#f3e3e6] bg-white px-5 py-5 shadow-[0_22px_60px_rgba(0,0,0,0.05)]">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c98b95]">
                Community Snapshot
              </p>
              <div className="mt-4 space-y-4">
                <div className="rounded-[24px] bg-[#fff7f8] px-4 py-4">
                  <p className="text-xs font-semibold text-[#8d8d8d]">전체 리뷰</p>
                  <p className="mt-1 text-[30px] font-black tracking-[-0.03em] text-[#171717]">
                    {summary.count.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-[24px] bg-[#fff7f8] px-4 py-4">
                  <p className="text-xs font-semibold text-[#8d8d8d]">평균 평점</p>
                  <p className="mt-1 text-[30px] font-black tracking-[-0.03em] text-[#171717]">
                    {summary.count > 0 ? summary.average.toFixed(1) : "-"}
                  </p>
                </div>
                <div className="rounded-[24px] bg-[#fff7f8] px-4 py-4">
                  <p className="text-xs font-semibold text-[#8d8d8d]">사진 리뷰</p>
                  <p className="mt-1 text-[30px] font-black tracking-[-0.03em] text-[#171717]">
                    {summary.withPhotosCount.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-[#f3e3e6] bg-white px-5 py-5 shadow-[0_22px_60px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5 text-[#ff7b83]" />
                <h2 className="text-base font-black tracking-[-0.02em] text-[#1b1b1b]">
                  둘러보면 좋은 이유
                </h2>
              </div>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[#6f6f6f]">
                <li>식당 상세에서 바로 리뷰를 확인하고, 사진 있는 리뷰만 빠르게 훑어볼 수 있어요.</li>
                <li>최신순, 사진 많은 순, 높은 평점순으로 분위기와 만족도를 비교하기 쉬워요.</li>
                <li>마음에 드는 식당은 상세 페이지로 바로 넘어가 메뉴와 지도를 이어서 볼 수 있어요.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
