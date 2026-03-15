import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  MapPinned,
  MessageSquarePlus,
  MoreVertical,
  Play,
  Share2,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import {
  creators,
  getCreatorsByRestaurant,
  getRecommendationCount,
  getVisitsByRestaurant,
  restaurants,
  type Restaurant,
  type Visit,
} from "@/data";
import HeartButton from "@/components/HeartButton";
import ShareSheet from "@/components/ShareSheet";
import { useAuth } from "@/contexts/AuthContext";
import { getDisplayName } from "@/lib/authProfile";

type DetailTab = "menu" | "videos" | "reviews" | "details";

type ReviewItem = {
  id: string;
  user: string;
  date: string;
  stars: number;
  text: string;
  helpful: number;
};

const APP_URL = import.meta.env.VITE_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ?? "";

function getRestaurantUrl(restaurantId: string) {
  if (APP_URL) {
    return `${APP_URL}/restaurant/${restaurantId}`;
  }

  if (typeof window === "undefined") {
    return `/restaurant/${restaurantId}`;
  }

  return `${window.location.origin}/restaurant/${restaurantId}`;
}

function getStoredReviewsKey(restaurantId: string) {
  return `matpick_reviews_${restaurantId}`;
}

function readStoredReviews(restaurantId: string): ReviewItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getStoredReviewsKey(restaurantId));
    return raw ? (JSON.parse(raw) as ReviewItem[]) : [];
  } catch {
    return [];
  }
}

function saveStoredReviews(restaurantId: string, reviews: ReviewItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getStoredReviewsKey(restaurantId), JSON.stringify(reviews));
}

function parseMenuItems(menuText: string) {
  return menuText
    .split("/")
    .map((chunk, index) => {
      const trimmed = chunk.trim();
      const priceMatch = trimmed.match(/(\d[\d,]*원?)/);
      const price = priceMatch ? priceMatch[1] : "";
      const name = price ? trimmed.replace(price, "").trim() : trimmed;
      return {
        id: `${index}_${name || trimmed}`,
        name: name || trimmed,
        price: price || "가격 문의",
      };
    })
    .filter((menu) => menu.name);
}

function formatReviewDate() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, ".");
}

function buildSampleReviews(restaurant: Restaurant): ReviewItem[] {
  return [
    {
      id: `${restaurant.id}_sample_1`,
      user: "맛집러버",
      date: "2025.01.15",
      stars: 5,
      text: `${restaurant.name} 정말 만족스러웠어요. 대표 메뉴가 특히 기억에 남고 다시 가고 싶어요.`,
      helpful: 12,
    },
    {
      id: `${restaurant.id}_sample_2`,
      user: "동네탐험가",
      date: "2025.01.10",
      stars: 4,
      text: "찾아가기 쉬웠고 분위기도 괜찮았어요. 웨이팅만 조금 덜하면 더 좋을 것 같아요.",
      helpful: 8,
    },
  ];
}

function ReviewsTab({
  restaurant,
  reviews,
  reviewDraft,
  reviewStars,
  isComposerOpen,
  onOpenComposer,
  onReviewDraftChange,
  onReviewStarsChange,
  onSubmitReview,
  isLoggedIn,
}: {
  restaurant: Restaurant;
  reviews: ReviewItem[];
  reviewDraft: string;
  reviewStars: number;
  isComposerOpen: boolean;
  onOpenComposer: () => void;
  onReviewDraftChange: (value: string) => void;
  onReviewStarsChange: (stars: number) => void;
  onSubmitReview: () => void;
  isLoggedIn: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-[24px] border border-[#f1e7e9] bg-[#fff8f9] px-5 py-4">
        <div>
          <p className="text-base font-bold text-[#191919]">방문 리뷰</p>
          <p className="mt-1 text-sm text-[#8a8a8a]">
            로그인한 사용자는 바로 리뷰를 남길 수 있어요.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenComposer}
          className="flex h-11 items-center justify-center rounded-full bg-[#ff7b83] px-5 text-sm font-semibold text-white transition hover:brightness-95"
        >
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          리뷰 쓰기
        </button>
      </div>

      {isComposerOpen ? (
        <div className="rounded-[24px] border border-[#ffd7dd] bg-white p-5 shadow-[0_12px_36px_rgba(255,123,131,0.08)]">
          <p className="text-base font-bold text-[#191919]">{restaurant.name} 리뷰 작성</p>
          <div className="mt-3 flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onReviewStarsChange(value)}
                className="text-[#ffb24a] transition hover:scale-105"
              >
                <Star
                  className="h-6 w-6"
                  fill={value <= reviewStars ? "currentColor" : "transparent"}
                />
              </button>
            ))}
          </div>
          <textarea
            value={reviewDraft}
            onChange={(event) => onReviewDraftChange(event.target.value)}
            placeholder={
              isLoggedIn
                ? "음식 맛, 분위기, 웨이팅, 다시 방문 의사 등을 적어주세요."
                : "리뷰 작성은 로그인 후 이용할 수 있어요."
            }
            disabled={!isLoggedIn}
            className="mt-4 min-h-[140px] w-full rounded-[20px] border border-[#e8dfe1] px-4 py-4 text-sm text-[#1a1a1a] outline-none transition focus:border-[#ff9ea9] focus:shadow-[0_0_0_3px_rgba(255,123,131,0.10)] disabled:cursor-not-allowed disabled:bg-[#f9f9f9]"
          />
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={!isLoggedIn}
              onClick={onSubmitReview}
              className="flex h-11 items-center justify-center rounded-full bg-[#161616] px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-[#b7b7b7]"
            >
              리뷰 등록
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="rounded-[24px] border border-[#f0f0f0] bg-white px-5 py-4"
          >
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
            <p className="mt-3 text-sm leading-6 text-[#555555]">{review.text}</p>
            <div className="mt-3 border-t border-[#f4f4f4] pt-3 text-xs text-[#999999]">
              도움됨 {review.helpful}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VideosTab({ visits }: { visits: Visit[] }) {
  if (visits.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-[#e3e3e3] px-6 py-12 text-center text-sm text-[#8a8a8a]">
        연결된 영상이 아직 없어요.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visits.map((visit) => {
        const creator = creators.find((item) => item.id === visit.creatorId);
        return (
          <a
            key={visit.id}
            href={visit.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="flex gap-4 rounded-[22px] border border-[#f0f0f0] bg-white p-4 no-underline transition hover:border-[#ffd5db] hover:shadow-[0_10px_28px_rgba(255,123,131,0.10)]"
          >
            <div className="relative h-[100px] w-[180px] overflow-hidden rounded-[18px] bg-[#1f1f1f]">
              <img
                src={visit.thumbnailUrl}
                alt={visit.videoTitle}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white">
                  <Play className="ml-0.5 h-5 w-5 fill-current" />
                </div>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[15px] font-bold leading-6 text-[#171717]">
                {visit.videoTitle}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#8d8d8d]">
                {creator ? <span className="font-semibold text-[#ff7b83]">{creator.name}</span> : null}
                <span>{visit.visitDate}</span>
                {visit.episode ? <span>{visit.episode}</span> : null}
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

function MenuTab({ restaurant }: { restaurant: Restaurant }) {
  const menuItems = parseMenuItems(restaurant.representativeMenu || "");

  if (menuItems.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-[#e3e3e3] px-6 py-12 text-center text-sm text-[#8a8a8a]">
        메뉴 정보가 아직 없어요.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {menuItems.map((menu) => (
        <div
          key={menu.id}
          className="rounded-[24px] border border-[#f0f0f0] bg-white p-5 transition hover:border-[#ffd5db] hover:shadow-[0_10px_28px_rgba(255,123,131,0.08)]"
        >
          <div className="flex aspect-[4/3] items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#fff6f7_0%,#fff1eb_100%)] text-5xl">
            🍽
          </div>
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-bold text-[#171717]">{menu.name}</p>
              <p className="mt-1 text-sm text-[#8a8a8a]">대표 메뉴</p>
            </div>
            <p className="text-sm font-semibold text-[#ff7b83]">{menu.price}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailsTab({ restaurant }: { restaurant: Restaurant }) {
  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-[#f0f0f0] bg-white px-5 py-4">
        <p className="text-base font-bold text-[#171717]">기본 정보</p>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex gap-4">
            <span className="w-[96px] flex-shrink-0 text-[#8a8a8a]">주소</span>
            <span className="text-[#1d1d1d]">{restaurant.address}</span>
          </div>
          <div className="flex gap-4">
            <span className="w-[96px] flex-shrink-0 text-[#8a8a8a]">지역</span>
            <span className="text-[#1d1d1d]">{restaurant.region}</span>
          </div>
          <div className="flex gap-4">
            <span className="w-[96px] flex-shrink-0 text-[#8a8a8a]">카테고리</span>
            <span className="text-[#1d1d1d]">{restaurant.category}</span>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-[#f0f0f0] bg-white px-5 py-4">
        <p className="text-base font-bold text-[#171717]">지도 좌표</p>
        <p className="mt-4 font-mono text-sm text-[#555555]">
          {restaurant.lat.toFixed(6)}, {restaurant.lng.toFixed(6)}
        </p>
      </section>
    </div>
  );
}

export default function RestaurantDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { isLoggedIn, user } = useAuth();
  const restaurant = restaurants.find((item) => item.id === id);
  const [activeTab, setActiveTab] = useState<DetailTab>("menu");
  const [shareOpen, setShareOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [reviewDraft, setReviewDraft] = useState("");
  const [reviewStars, setReviewStars] = useState(5);
  const [storedReviews, setStoredReviews] = useState<ReviewItem[]>([]);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!restaurant) {
      return;
    }

    setStoredReviews(readStoredReviews(restaurant.id));
  }, [restaurant?.id]);

  if (!restaurant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa]">
        <div className="text-center">
          <p className="mb-4 text-6xl">🍽</p>
          <p className="mb-4 text-lg text-[#888]">식당을 찾을 수 없어요.</p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-full bg-[#FD7979] px-6 py-2 font-medium text-white"
          >
            홈으로
          </button>
        </div>
      </div>
    );
  }

  const visits = getVisitsByRestaurant(restaurant.id);
  const recommenders = getCreatorsByRestaurant(restaurant.id);
  const recCount = getRecommendationCount(restaurant.id);
  const sampleReviews = buildSampleReviews(restaurant);
  const reviews = [...storedReviews, ...sampleReviews];
  const shareUrl = getRestaurantUrl(restaurant.id);
  const shareText = `${restaurant.name} - 맛픽에서 크리에이터 추천 맛집을 확인해 보세요.`;

  const openReviewComposer = () => {
    if (!isLoggedIn) {
      toast("리뷰 작성은 로그인 후 사용할 수 있어요.", {
        description: "로그인한 뒤 바로 리뷰를 남겨보세요.",
        action: {
          label: "홈으로",
          onClick: () => window.location.assign("/"),
        },
      });
      return;
    }

    setActiveTab("reviews");
    setIsComposerOpen(true);
  };

  const submitReview = () => {
    if (!isLoggedIn || !user) {
      openReviewComposer();
      return;
    }

    const trimmed = reviewDraft.trim();
    if (!trimmed) {
      toast("리뷰 내용을 입력해 주세요.");
      return;
    }

    const nextReview: ReviewItem = {
      id: `${Date.now()}`,
      user: getDisplayName(user),
      date: formatReviewDate(),
      stars: reviewStars,
      text: trimmed,
      helpful: 0,
    };

    const nextReviews = [nextReview, ...storedReviews];
    setStoredReviews(nextReviews);
    saveStoredReviews(restaurant.id, nextReviews);
    setReviewDraft("");
    setReviewStars(5);
    setIsComposerOpen(false);
    toast.success("리뷰를 등록했어요.");
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f8f9fa_0%,#f0f2f5_100%)]">
      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={restaurant.name}
        text={shareText}
        url={shareUrl}
        imageUrl={restaurant.imageUrl}
      />

      <nav className="sticky top-0 z-40 flex items-center justify-between border-b border-[#e8e8e8] bg-white/95 px-6 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur">
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
            aria-label="공유하기"
          >
            <Share2 className="h-4.5 w-4.5" />
          </button>
          <div ref={moreMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((prev) => !prev)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e0e0e0] bg-white text-[#555] transition hover:border-[#FD7979] hover:bg-[#FFF5F5]"
              aria-label="더보기"
            >
              <MoreVertical className="h-4.5 w-4.5" />
            </button>

            {moreOpen ? (
              <div className="absolute right-0 top-full z-20 mt-2 w-[190px] overflow-hidden rounded-[20px] border border-[#ece6e7] bg-white py-2 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(restaurant.address);
                      toast.success("주소를 복사했어요.");
                    } catch {
                      toast.error("주소 복사에 실패했어요.");
                    }
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
                    setMoreOpen(false);
                    navigate(`/map?type=restaurant&value=${encodeURIComponent(restaurant.id)}`);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#252525] transition hover:bg-[#fff6f7]"
                >
                  <MapPinned className="h-4 w-4" />
                  지도에서 보기
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      toast.success("맛집 링크를 복사했어요.");
                    } catch {
                      toast.error("링크 복사에 실패했어요.");
                    }
                    setMoreOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#252525] transition hover:bg-[#fff6f7]"
                >
                  <ExternalLink className="h-4 w-4" />
                  링크 복사
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </nav>

      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 p-6 lg:grid-cols-[1fr_420px] lg:px-8">
        <div className="flex flex-col gap-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl bg-white p-7 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
          >
            <div className="mb-6 border-b border-[#f0f0f0] pb-5">
              <h1 className="mb-2 text-[28px] font-[800] text-[#1a1a1a]">
                {restaurant.name}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-[#666]">
                {recCount > 0 ? (
                  <span className="font-bold text-[#FD7979]">추천 {recCount}회</span>
                ) : null}
                <span>{restaurant.region}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium uppercase tracking-wider text-[#999]">
                  주소
                </span>
                <span className="text-[15px] font-semibold leading-relaxed text-[#1a1a1a]">
                  {restaurant.address}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium uppercase tracking-wider text-[#999]">
                  대표 메뉴
                </span>
                <span className="text-[15px] font-semibold leading-relaxed text-[#1a1a1a]">
                  {restaurant.representativeMenu || "정보 준비 중"}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium uppercase tracking-wider text-[#999]">
                  카테고리
                </span>
                <span className="text-[15px] font-semibold text-[#1a1a1a]">
                  {restaurant.category}
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
          >
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

            <div className="p-7">
              {activeTab === "menu" ? <MenuTab restaurant={restaurant} /> : null}
              {activeTab === "videos" ? <VideosTab visits={visits} /> : null}
              {activeTab === "reviews" ? (
                <ReviewsTab
                  restaurant={restaurant}
                  reviews={reviews}
                  reviewDraft={reviewDraft}
                  reviewStars={reviewStars}
                  isComposerOpen={isComposerOpen}
                  onOpenComposer={openReviewComposer}
                  onReviewDraftChange={setReviewDraft}
                  onReviewStarsChange={setReviewStars}
                  onSubmitReview={submitReview}
                  isLoggedIn={isLoggedIn}
                />
              ) : null}
              {activeTab === "details" ? <DetailsTab restaurant={restaurant} /> : null}
            </div>
          </motion.div>
        </div>

        <div className="flex h-fit flex-col gap-5 lg:sticky lg:top-[80px]">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
          >
            <div className="relative">
              <img
                src={
                  restaurant.imageUrl ||
                  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=420&h=315&fit=crop"
                }
                alt={restaurant.name}
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="absolute bottom-3 right-3 rounded bg-black/70 px-2.5 py-1 text-xs text-white">
                사진
              </div>
            </div>

            {visits.length > 0 ? (
              <div className="grid grid-cols-2 gap-0.5 p-0.5">
                {visits.slice(0, 4).map((visit, index) => (
                  <div key={visit.id} className="relative aspect-square overflow-hidden">
                    <img src={visit.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    {index === 3 && visits.length > 4 ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-lg font-bold text-white">
                        +{visits.length - 4}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </motion.div>

          {recommenders.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
            >
              <h3 className="mb-3 text-sm font-bold text-[#1a1a1a]">추천 크리에이터</h3>
              <div className="flex flex-wrap gap-2">
                {recommenders.map((creator) => (
                  <Link key={creator.id} href={`/creator/${creator.id}`} className="no-underline">
                    <div className="flex items-center gap-2 rounded-xl border border-[#FFCDC9] px-3 py-2 transition-colors hover:bg-[#FFF5F5]">
                      <img
                        src={creator.profileImage}
                        alt={creator.name}
                        className="h-7 w-7 rounded-full object-cover"
                      />
                      <span className="text-sm font-semibold text-[#FD7979]">
                        {creator.name}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          ) : null}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="flex flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
          >
            <button
              type="button"
              onClick={() =>
                navigate(`/map?type=restaurant&value=${encodeURIComponent(restaurant.id)}`)
              }
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FD7979] to-[#FDACAC] py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(253,121,121,0.3)]"
            >
              <MapPinned className="h-4 w-4" />
              지도에서 보기
            </button>
            <button
              type="button"
              onClick={openReviewComposer}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#f5f5f5] py-3 text-sm font-semibold text-[#555] transition-all hover:bg-[#e8e8e8]"
            >
              <MessageSquarePlus className="h-4 w-4" />
              리뷰 쓰기
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
