import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  Copy,
  ImagePlus,
  MapPinned,
  MessageSquarePlus,
  MoreVertical,
  Play,
  Share2,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import HeartButton from "@/components/HeartButton";
import FavoriteTopicPickerDialog from "@/components/FavoriteTopicPickerDialog";
import ShareSheet from "@/components/ShareSheet";
import MonetizationSlot from "@/components/monetization/MonetizationSlot";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import {
  creators,
  getCreatorDisplayName,
  getCreatorsByRestaurant,
  getRestaurantMenuItems,
  getRestaurantMenuSummary,
  getRecommendationCount,
  getSourcesByRestaurant,
  getVisitsByRestaurant,
  restaurants,
} from "@/data";
import { getDisplayName } from "@/lib/authProfile";
import {
  clearUserRestaurantRating,
  getUserRestaurantRating,
  saveUserRestaurantRating,
} from "@/lib/restaurantRatings";
import { buildAbsoluteUrl, useSeo } from "@/lib/seo";

type DetailTab = "menu" | "videos" | "reviews" | "details";
type ReviewItem = { id: string; user: string; date: string; stars: number; text: string; photos: string[] };

const APP_URL = import.meta.env.VITE_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ?? "";
const MAX_REVIEW_PHOTOS = 3;

function getRestaurantUrl(restaurantId: string) {
  if (APP_URL) return `${APP_URL}/restaurant/${restaurantId}`;
  if (typeof window === "undefined") return `/restaurant/${restaurantId}`;
  return `${window.location.origin}/restaurant/${restaurantId}`;
}

function getStoredReviewsKey(restaurantId: string) {
  return `matpick_reviews_${restaurantId}`;
}

function readStoredReviews(restaurantId: string): ReviewItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(getStoredReviewsKey(restaurantId));
    return raw ? (JSON.parse(raw) as ReviewItem[]) : [];
  } catch {
    return [];
  }
}

function saveStoredReviews(restaurantId: string, reviews: ReviewItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getStoredReviewsKey(restaurantId), JSON.stringify(reviews));
}

async function toDataUrl(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image();
      next.onload = () => resolve(next);
      next.onerror = () => reject(new Error("이미지를 불러오지 못했어요."));
      next.src = objectUrl;
    });
    const canvas = document.createElement("canvas");
    const maxSide = 1280;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지를 변환하지 못했어요.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function formatDate() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, ".");
}

export default function RestaurantDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { isLoggedIn, user } = useAuth();
  const { topics, getTopicsForRestaurant } = useFavorites();
  const restaurant = restaurants.find((item) => item.id === id);
  const [activeTab, setActiveTab] = useState<DetailTab>("menu");
  const [shareOpen, setShareOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [reviewDraft, setReviewDraft] = useState("");
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewPhotos, setReviewPhotos] = useState<string[]>([]);
  const [storedReviews, setStoredReviews] = useState<ReviewItem[]>([]);
  const [personalRating, setPersonalRating] = useState(0);
  const [hoveredPersonalRating, setHoveredPersonalRating] = useState(0);
  const [topicPickerOpen, setTopicPickerOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    if (!restaurant) return;
    setStoredReviews(readStoredReviews(restaurant.id));
    setReviewDraft("");
    setReviewStars(5);
    setReviewPhotos([]);
    setHoveredPersonalRating(0);
    setComposerOpen(false);
  }, [restaurant?.id]);

  useEffect(() => {
    if (!restaurant || !user) {
      setPersonalRating(0);
      setHoveredPersonalRating(0);
      return;
    }
    setPersonalRating(getUserRestaurantRating(user.id, restaurant.id)?.stars ?? 0);
  }, [restaurant, user]);

  const reviews = useMemo(
    () =>
      restaurant
        ? [
            ...storedReviews,
            {
              id: `${restaurant.id}_sample`,
              user: "맛픽가이드",
              date: "2025.01.15",
              stars: 5,
              text: `${restaurant.name} 분위기와 대표 메뉴가 좋아서 기억에 남는 곳이에요.`,
              photos: [],
            },
          ]
        : [],
    [restaurant, storedReviews]
  );

  if (!restaurant) {
    return <div className="flex min-h-screen items-center justify-center text-[#666]">식당을 찾을 수 없어요.</div>;
  }

  const visits = getVisitsByRestaurant(restaurant.id);
  const recommenders = getCreatorsByRestaurant(restaurant.id);
  const sourcesByRestaurant = getSourcesByRestaurant(restaurant.id);
  const recommendationCount = getRecommendationCount(restaurant.id);
  const shareUrl = getRestaurantUrl(restaurant.id);
  const visiblePersonalRating = hoveredPersonalRating || personalRating;
  const assignedTopics = getTopicsForRestaurant(restaurant.id);

  useSeo({
    title: `${restaurant.name} 맛집 정보`,
    description: `${restaurant.name}의 대표 메뉴, 위치, 추천 소스와 리뷰를 맛픽에서 확인해보세요.`,
    path: `/restaurant/${restaurant.id}`,
    type: "article",
    image: restaurant.imageUrl || "/og-default.png",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Restaurant",
      name: restaurant.name,
      image: restaurant.imageUrl ? buildAbsoluteUrl(restaurant.imageUrl) : buildAbsoluteUrl("/og-default.png"),
      address: {
        "@type": "PostalAddress",
        streetAddress: restaurant.address,
        addressCountry: "KR",
      },
      servesCuisine: restaurant.category,
      url: shareUrl,
    },
  });

  const openComposer = () => {
    if (!isLoggedIn) {
      toast("리뷰 작성은 로그인 후에 이용할 수 있어요.");
      return;
    }
    setActiveTab("reviews");
    setComposerOpen(true);
  };

  const saveRating = (stars: number) => {
    if (!isLoggedIn || !user) {
      toast("내 평점은 로그인 후에 저장할 수 있어요.");
      return;
    }

    if (personalRating === stars) {
      clearUserRestaurantRating(user.id, restaurant.id);
      setPersonalRating(0);
      setHoveredPersonalRating(0);
      toast.success("내 평점을 초기화했어요.");
      return;
    }

    saveUserRestaurantRating(user.id, restaurant.id, stars);
    setPersonalRating(stars);
    setHoveredPersonalRating(0);
    toast.success(`내 평점 ${stars}점을 저장했어요.`);
  };

  const addReviewPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const candidates = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, Math.max(0, MAX_REVIEW_PHOTOS - reviewPhotos.length));
    const nextPhotos = await Promise.all(candidates.map((file) => toDataUrl(file)));
    setReviewPhotos((prev) => [...prev, ...nextPhotos].slice(0, MAX_REVIEW_PHOTOS));
  };

  const submitReview = () => {
    if (!isLoggedIn || !user) {
      toast("리뷰 작성은 로그인 후에 이용할 수 있어요.");
      return;
    }
    if (!reviewDraft.trim() && reviewPhotos.length === 0) {
      toast("리뷰 내용이나 사진을 하나 이상 남겨주세요.");
      return;
    }

    const nextReview: ReviewItem = {
      id: `${Date.now()}`,
      user: getDisplayName(user),
      date: formatDate(),
      stars: reviewStars,
      text: reviewDraft.trim(),
      photos: reviewPhotos,
    };

    const nextReviews = [nextReview, ...storedReviews];
    setStoredReviews(nextReviews);
    saveStoredReviews(restaurant.id, nextReviews);
    setReviewDraft("");
    setReviewStars(5);
    setReviewPhotos([]);
    setComposerOpen(false);
    toast.success("리뷰를 등록했어요.");
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f8f9fa_0%,#f0f2f5_100%)]">
      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={restaurant.name}
        text={`${restaurant.name} - 맛픽에서 확인해보세요.`}
        url={shareUrl}
        imageUrl={restaurant.imageUrl}
      />
      <FavoriteTopicPickerDialog
        open={topicPickerOpen}
        onOpenChange={setTopicPickerOpen}
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
      />

      <nav className="sticky top-0 z-40 flex items-center justify-between border-b border-[#e8e8e8] bg-white/95 px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur sm:px-6">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e0e0e0] bg-white text-[#333] transition hover:border-[#FD7979] hover:bg-[#FFF5F5]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <HeartButton restaurantId={restaurant.id} size="md" className="shadow-sm" />
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e0e0e0] bg-white text-[#555] transition hover:border-[#FD7979] hover:bg-[#FFF5F5]"
          >
            <Share2 className="h-4.5 w-4.5" />
          </button>
          <div ref={moreRef} className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((prev) => !prev)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e0e0e0] bg-white text-[#555] transition hover:border-[#FD7979] hover:bg-[#FFF5F5]"
            >
              <MoreVertical className="h-4.5 w-4.5" />
            </button>
            {moreOpen ? (
              <div className="absolute right-0 top-full z-20 mt-2 w-[190px] overflow-hidden rounded-[20px] border border-[#ece6e7] bg-white py-2 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(restaurant.address);
                    toast.success("주소를 복사했어요.");
                    setMoreOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#252525] transition hover:bg-[#fff6f7]"
                >
                  <Copy className="h-4 w-4" />
                  주소 복사
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/map?type=restaurant&value=${encodeURIComponent(restaurant.id)}`);
                    setMoreOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#252525] transition hover:bg-[#fff6f7]"
                >
                  <MapPinned className="h-4 w-4" />
                  지도에서 보기
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </nav>

      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-5 p-4 sm:gap-6 sm:p-6 lg:grid-cols-[1fr_420px] lg:px-8">
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] sm:p-7">
            <div className="mb-6 border-b border-[#f0f0f0] pb-5">
              <h1 className="mb-2 text-[24px] font-[800] text-[#1a1a1a] sm:text-[28px]">{restaurant.name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-[#666]">
                {recommendationCount > 0 ? (
                  <span className="font-bold text-[#FD7979]">추천 {recommendationCount}곳</span>
                ) : null}
                <span>{restaurant.region}</span>
                {restaurant.foundingYear ? <span>{restaurant.foundingYear}년 개업</span> : null}
              </div>
              {sourcesByRestaurant.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {sourcesByRestaurant.map((source) => (
                    <span
                      key={source.id}
                      className="inline-flex items-center rounded-full border border-[#f3d5a1] bg-[#fff7e8] px-3 py-1 text-xs font-semibold text-[#b7791f]"
                    >
                      {source.name}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-6">
              <div>
                <span className="text-[12px] font-medium uppercase tracking-wider text-[#999]">주소</span>
                <p className="mt-2 text-[15px] font-semibold leading-relaxed text-[#1a1a1a]">
                  {restaurant.address}
                </p>
              </div>
              <div>
                <span className="text-[12px] font-medium uppercase tracking-wider text-[#999]">대표 메뉴</span>
                <p className="mt-2 text-[15px] font-semibold leading-relaxed text-[#1a1a1a]">
                  {getRestaurantMenuSummary(restaurant) || "정보 준비 중"}
                </p>
              </div>
              <div>
                <span className="text-[12px] font-medium uppercase tracking-wider text-[#999]">카테고리</span>
                <p className="mt-2 text-[15px] font-semibold text-[#1a1a1a]">{restaurant.category}</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <div className="flex border-b-2 border-[#f0f0f0]">
              {[
                { key: "menu" as const, label: "메뉴" },
                { key: "videos" as const, label: "영상" },
                { key: "reviews" as const, label: "리뷰" },
                { key: "details" as const, label: "상세 정보" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`-mb-[2px] flex-1 border-b-[3px] bg-transparent px-5 py-4 text-[15px] font-semibold transition-all ${
                    activeTab === tab.key
                      ? "border-[#FD7979] text-[#FD7979]"
                      : "border-transparent text-[#999] hover:text-[#FD7979]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-5 sm:p-7">
              {activeTab === "menu" ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {getRestaurantMenuItems(restaurant).length > 0 ? (
                    getRestaurantMenuItems(restaurant).map((menu) => (
                      <div key={menu.id} className="rounded-[24px] border border-[#f0f0f0] bg-white p-5">
                        <p className="text-base font-bold text-[#171717]">{menu.name}</p>
                        <p className="mt-1 text-sm text-[#8a8a8a]">{menu.isSignature ? "대표 메뉴" : "메뉴"}</p>
                        <p className="mt-3 text-sm font-semibold text-[#ff7b83]">{menu.price || "가격 문의"}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-[#e3e3e3] px-6 py-12 text-center text-sm text-[#8a8a8a]">
                      메뉴 정보가 아직 없어요.
                    </div>
                  )}
                </div>
              ) : null}

              {activeTab === "videos" ? (
                visits.length > 0 ? (
                  <div className="space-y-4">
                    {visits.map((visit) => {
                      const creator = creators.find((item) => item.id === visit.creatorId);
                      return (
                        <a
                          key={visit.id}
                          href={visit.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex flex-col gap-4 rounded-[22px] border border-[#f0f0f0] bg-white p-4 no-underline transition hover:border-[#ffd5db] sm:flex-row"
                        >
                          <div className="relative h-[180px] w-full overflow-hidden rounded-[18px] bg-[#1f1f1f] sm:h-[100px] sm:w-[180px]">
                            <img src={visit.thumbnailUrl} alt={visit.videoTitle} className="h-full w-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white">
                                <Play className="ml-0.5 h-5 w-5 fill-current" />
                              </div>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-[15px] font-bold leading-6 text-[#171717]">{visit.videoTitle}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#8d8d8d]">
                              {creator ? (
                                <span className="font-semibold text-[#ff7b83]">
                                  {getCreatorDisplayName(creator)}
                                </span>
                              ) : null}
                              <span>{visit.visitDate}</span>
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-dashed border-[#e3e3e3] px-6 py-12 text-center text-sm text-[#8a8a8a]">
                    연결된 영상이 아직 없어요.
                  </div>
                )
              ) : null}

              {activeTab === "reviews" ? (
                <div className="space-y-5">
                  <div className="flex flex-col gap-3 rounded-[24px] border border-[#f1e7e9] bg-[#fff8f9] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-bold text-[#191919]">방문 리뷰</p>
                      <p className="mt-1 text-sm text-[#8a8a8a]">로그인한 사용자는 바로 리뷰와 사진을 남길 수 있어요.</p>
                    </div>
                    <button
                      type="button"
                      onClick={openComposer}
                      className="flex h-11 items-center justify-center rounded-full bg-[#ff7b83] px-5 text-sm font-semibold text-white transition hover:brightness-95"
                    >
                      <MessageSquarePlus className="mr-2 h-4 w-4" />
                      리뷰 쓰기
                    </button>
                  </div>

                  {composerOpen ? (
                    <div className="rounded-[24px] border border-[#ffd7dd] bg-white p-5">
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button key={value} type="button" onClick={() => setReviewStars(value)} className="text-[#ffb24a]">
                            <Star className="h-6 w-6" fill={value <= reviewStars ? "currentColor" : "transparent"} />
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={reviewDraft}
                        onChange={(event) => setReviewDraft(event.target.value)}
                        placeholder="음식 맛, 분위기, 서비스 등을 자유롭게 남겨주세요."
                        className="mt-4 min-h-[140px] w-full rounded-[20px] border border-[#e8dfe1] px-4 py-4 text-sm text-[#1a1a1a] outline-none transition focus:border-[#ff9ea9]"
                      />
                      <div className="mt-4 flex flex-wrap gap-3">
                        {reviewPhotos.map((photo, index) => (
                          <div key={`${photo}_${index}`} className="relative h-24 w-24 overflow-hidden rounded-[18px] border border-[#f0e4e6]">
                            <img src={photo} alt={`리뷰 사진 ${index + 1}`} className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setReviewPhotos((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-sm font-bold text-white"
                            >
                              ×
                            </button>
                          </div>
                        ))}

                        {reviewPhotos.length < MAX_REVIEW_PHOTOS ? (
                          <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-[18px] border border-dashed border-[#ffb7c0] bg-[#fff8f9] text-[#ff7b83]">
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={async (event) => {
                                await addReviewPhotos(event.target.files);
                                event.currentTarget.value = "";
                              }}
                            />
                            <div className="flex flex-col items-center gap-2">
                              <ImagePlus className="h-5 w-5" />
                              <span className="text-xs font-semibold">사진 추가</span>
                            </div>
                          </label>
                        ) : null}
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={submitReview}
                          className="flex h-11 items-center justify-center rounded-full bg-[#161616] px-5 text-sm font-semibold text-white transition hover:brightness-110"
                        >
                          리뷰 등록
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div key={review.id} className="rounded-[24px] border border-[#f0f0f0] bg-white px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ffecee] text-sm font-bold text-[#ff7b83]">
                            {review.user.slice(0, 1)}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-[#171717]">{review.user}</p>
                            <p className="text-xs text-[#999999]">{review.date}</p>
                          </div>
                          <div className="text-sm text-[#ffb24a]">{"★".repeat(review.stars)}</div>
                        </div>
                        {review.text ? <p className="mt-3 text-sm leading-6 text-[#555555]">{review.text}</p> : null}
                        {review.photos.length > 0 ? (
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {review.photos.map((photo, index) => (
                              <div key={`${review.id}_photo_${index}`} className="overflow-hidden rounded-[18px] border border-[#efe4e6]">
                                <img src={photo} alt={`${review.user} 리뷰 사진 ${index + 1}`} className="aspect-square w-full object-cover" />
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeTab === "details" ? (
                <div className="space-y-5">
                  <div className="rounded-[24px] border border-[#f0f0f0] bg-white px-5 py-4">
                    <p className="text-base font-bold text-[#171717]">기본 정보</p>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                        <span className="w-full flex-shrink-0 text-[#8a8a8a] sm:w-[96px]">주소</span>
                        <span className="text-[#1d1d1d]">{restaurant.address}</span>
                      </div>
                      <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                        <span className="w-full flex-shrink-0 text-[#8a8a8a] sm:w-[96px]">지역</span>
                        <span className="text-[#1d1d1d]">{restaurant.region}</span>
                      </div>
                      <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                        <span className="w-full flex-shrink-0 text-[#8a8a8a] sm:w-[96px]">카테고리</span>
                        <span className="text-[#1d1d1d]">{restaurant.category}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex h-fit flex-col gap-5 lg:sticky lg:top-[80px]">
          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <img
              src={
                restaurant.imageUrl ||
                "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=420&h=315&fit=crop"
              }
              alt={restaurant.name}
              className="aspect-[4/3] w-full object-cover"
            />
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#1a1a1a]">나만의 평점</h3>
                <p className="mt-1 text-xs leading-5 text-[#8a8a8a]">
                  {isLoggedIn
                    ? "식당별로 내 평점을 기록해 둘 수 있어요."
                    : "로그인하면 식당마다 내 평점을 남길 수 있어요."}
                </p>
              </div>
              {personalRating > 0 ? (
                <span className="rounded-full bg-[#fff3e8] px-3 py-1 text-xs font-semibold text-[#ff9f1c]">
                  {personalRating}/5
                </span>
              ) : null}
            </div>
            <div
              className="mt-4 flex items-center gap-2"
              onMouseLeave={() => setHoveredPersonalRating(0)}
            >
              {[1, 2, 3, 4, 5].map((value) => {
                const isActive = value <= visiblePersonalRating;

                return (
                  <button
                    key={value}
                    type="button"
                    onMouseEnter={() => setHoveredPersonalRating(value)}
                    onFocus={() => setHoveredPersonalRating(value)}
                    onBlur={() => setHoveredPersonalRating(0)}
                    onClick={() => saveRating(value)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                      isActive
                        ? "bg-[#fff4d8] text-[#ffb24a]"
                        : "bg-[#f6f6f6] text-[#c7c7c7] hover:bg-[#fff8e8] hover:text-[#ffb24a]"
                    }`}
                  >
                    <Star className="h-5 w-5" fill={isActive ? "currentColor" : "transparent"} />
                  </button>
                );
              })}
            </div>
            {isLoggedIn ? (
              <div className="mt-4 border-t border-[#f3eef0] pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#202020]">주제별 저장</p>
                    <p className="mt-1 text-xs leading-5 text-[#8a8a8a]">
                      만든 주제에 이 식당을 담아 두고 나중에 탐색 화면에서 바로 모아볼 수 있어요.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTopicPickerOpen(true)}
                    className="inline-flex h-9 items-center justify-center rounded-full border border-[#ffd2d8] bg-[#fff7f8] px-4 text-xs font-semibold text-[#ff6b7b] transition hover:bg-[#fff0f3]"
                  >
                    {topics.length > 0 ? "주제에 담기" : "주제 만들기"}
                  </button>
                </div>

                {assignedTopics.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {assignedTopics.map((topic) => (
                      <span
                        key={topic.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#ffd2d8] bg-[#fff4f6] px-3 py-1 text-xs font-semibold text-[#ff6b7b]"
                      >
                        <span>{topic.name}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {recommenders.length > 0 || sourcesByRestaurant.length > 0 ? (
            <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <h3 className="mb-3 text-sm font-bold text-[#1a1a1a]">추천 채널 · 소스</h3>
              <div className="flex flex-wrap gap-2">
                {recommenders.map((creator) => (
                  <Link key={creator.id} href={`/creator/${creator.id}`} className="no-underline">
                    <div className="flex items-center gap-2 rounded-xl border border-[#FFCDC9] px-3 py-2 transition-colors hover:bg-[#FFF5F5]">
                      <img
                        src={creator.profileImage}
                        alt={getCreatorDisplayName(creator)}
                        className="h-7 w-7 rounded-full object-cover"
                      />
                      <span className="text-sm font-semibold text-[#FD7979]">
                        {getCreatorDisplayName(creator)}
                      </span>
                    </div>
                  </Link>
                ))}

                {sourcesByRestaurant.map((source) => (
                  <div
                    key={source.id}
                    title={source.name}
                    className="inline-flex max-w-full items-center gap-2 rounded-xl border border-[#f3d5a1] bg-[#fff7e8] px-3 py-2 text-sm font-semibold text-[#b7791f]"
                  >
                    {source.imageUrl ? (
                      <img
                        src={source.imageUrl}
                        alt={source.name}
                        className="h-7 w-7 rounded-full object-cover"
                      />
                    ) : null}
                    <span className="truncate">{source.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <MonetizationSlot label="Sponsored" />

          <div className="flex flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <button
              type="button"
              onClick={() => navigate(`/map?type=restaurant&value=${encodeURIComponent(restaurant.id)}`)}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FD7979] to-[#FDACAC] py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(253,121,121,0.3)]"
            >
              <MapPinned className="h-4 w-4" />
              지도에서 보기
            </button>
            <button
              type="button"
              onClick={openComposer}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#f5f5f5] py-3 text-sm font-semibold text-[#555] transition-all hover:bg-[#e8e8e8]"
            >
              <MessageSquarePlus className="h-4 w-4" />
              리뷰 쓰기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
