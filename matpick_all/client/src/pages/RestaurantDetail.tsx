import { useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
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
  X,
} from "lucide-react";
import { toast } from "sonner";
import AuthFeatureDialog, { type AuthFeatureMode } from "@/components/AuthFeatureDialog";
import HeartButton from "@/components/HeartButton";
import FavoriteTopicPickerDialog from "@/components/FavoriteTopicPickerDialog";
import ShareSheet from "@/components/ShareSheet";
import {
  AdsenseSlot,
  CoupangSlot,
} from "@/components/monetization/MonetizationSlot";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import {
  creators,
  getCreatorDisplayName,
  getCreatorsByRestaurant,
  getNearbyRestaurants,
  getRestaurantBroadcastMeta,
  getRelatedRestaurants,
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
import {
  formatRestaurantBroadcastBadge,
  getRestaurantDisplayImage,
  formatRestaurantFoundingBadge,
  getRestaurantPrimaryPrice,
} from "@/lib/restaurantPresentation";
import {
  collectReviewPhotos,
  getPrimaryReviewPhotoUrl,
  sortReviews,
  summarizeReviews,
  type ReviewSortMode,
  type SharedReview,
} from "@/lib/reviews";
import { trackMarketingEvent } from "@/lib/marketing";
import { buildAbsoluteUrl, useSeo } from "@/lib/seo";

type DetailTab = "menu" | "videos" | "reviews" | "details";
type ReviewItem = SharedReview;
type RelatedSortMode = "related" | "nearby";
type GoogleFallbackPhoto = {
  imageUrl: string;
  attributions: Array<{ displayName?: string; uri?: string }>;
};

const APP_URL = import.meta.env.VITE_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ?? "";
const MAX_REVIEW_PHOTOS = 3;
const GUIDE_REVIEW_USERS = new Set(["맛픽가이드", "맛픽 가이드"]);

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
    return raw
      ? (JSON.parse(raw) as ReviewItem[]).filter((review) => !GUIDE_REVIEW_USERS.has(review.user))
      : [];
  } catch {
    return [];
  }
}

function saveStoredReviews(restaurantId: string, reviews: ReviewItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getStoredReviewsKey(restaurantId), JSON.stringify(reviews));
}

function normalizeReview(review: ReviewItem): ReviewItem {
  return {
    ...review,
    createdAt: Number.isFinite(review.createdAt) ? review.createdAt : Date.now(),
    photos: Array.isArray(review.photos) ? review.photos.filter(Boolean) : [],
  };
}

function mergeReviews(...collections: ReviewItem[][]) {
  const merged = new Map<string, ReviewItem>();

  collections.flat().forEach((review) => {
    if (!review?.id) {
      return;
    }

    merged.set(review.id, normalizeReview(review));
  });

  return Array.from(merged.values()).sort(
    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
  );
}

async function fetchRemoteReviews(restaurantId: string): Promise<ReviewItem[]> {
  const response = await fetch(`/api/reviews?restaurantId=${encodeURIComponent(restaurantId)}`);
  if (!response.ok) {
    throw new Error("Failed to load remote reviews");
  }

  const payload = (await response.json()) as { reviews?: ReviewItem[] };
  return Array.isArray(payload.reviews) ? payload.reviews.map(normalizeReview) : [];
}

async function saveRemoteReview({
  restaurantId,
  userId,
  syncToken,
  review,
}: {
  restaurantId: string;
  userId: string;
  syncToken: string;
  review: ReviewItem;
}) {
  const response = await fetch("/api/reviews", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      restaurantId,
      userId,
      syncToken,
      review,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to save remote review");
  }

  const payload = (await response.json()) as { review?: ReviewItem };
  return payload.review ? normalizeReview(payload.review) : review;
}

function dataUrlToBlob(dataUrl: string) {
  const [header, encoded] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] || "image/jpeg";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

async function uploadReviewPhotos({
  restaurantId,
  userId,
  syncToken,
  reviewId,
  photos,
}: {
  restaurantId: string;
  userId: string;
  syncToken: string;
  reviewId: string;
  photos: string[];
}) {
  const uploaded = await Promise.all(
    photos.map((photo, index) =>
      upload(`reviews/${restaurantId}/${userId}-${reviewId}-${index + 1}.jpg`, dataUrlToBlob(photo), {
        access: "public",
        handleUploadUrl: "/api/reviews/upload",
        clientPayload: JSON.stringify({
          restaurantId,
          userId,
          syncToken,
        }),
      })
    )
  );

  return uploaded.map((blob) => blob.url);
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

function formatDistance(distanceKm: number | null) {
  if (distanceKm == null) {
    return "거리 정보 없음";
  }

  if (distanceKm < 1) {
    return `${Math.max(100, Math.round(distanceKm * 1000))}m`;
  }

  return `${distanceKm.toFixed(1)}km`;
}

export default function RestaurantDetail() {
  const { id } = useParams<{ id: string }>();
  const [location, navigate] = useLocation();
  const { isLoggedIn, user } = useAuth();
  const { topics, getTopicsForRestaurant, toggleRestaurantInTopic } = useFavorites();
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
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [topicPickerOpen, setTopicPickerOpen] = useState(false);
  const [authFeatureDialogOpen, setAuthFeatureDialogOpen] = useState(false);
  const [authFeatureMode, setAuthFeatureMode] =
    useState<AuthFeatureMode>("rating");
  const [reviewSortMode, setReviewSortMode] = useState<ReviewSortMode>("latest");
  const [relatedSortMode, setRelatedSortMode] = useState<RelatedSortMode>("related");
  const [googleFallbackPhoto, setGoogleFallbackPhoto] =
    useState<GoogleFallbackPhoto | null>(null);
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
    const localReviews = readStoredReviews(restaurant.id).map(normalizeReview);
    setStoredReviews(localReviews);
    setReviewDraft("");
    setReviewStars(5);
    setReviewPhotos([]);
    setHoveredPersonalRating(0);
    setReviewSortMode("latest");
    setRelatedSortMode("related");
    setComposerOpen(false);
    setGoogleFallbackPhoto(null);

    let ignore = false;

    void fetchRemoteReviews(restaurant.id)
      .then((remoteReviews) => {
        if (ignore) {
          return;
        }

        const merged = mergeReviews(remoteReviews, localReviews);
        setStoredReviews(merged);
        saveStoredReviews(restaurant.id, merged);
      })
      .catch(() => {
        // Keep local reviews when the remote review store is unavailable.
      });

    return () => {
      ignore = true;
    };
  }, [restaurant?.id]);

  useEffect(() => {
    if (!restaurant || !user) {
      setPersonalRating(0);
      setHoveredPersonalRating(0);
      return;
    }
    setPersonalRating(getUserRestaurantRating(user.id, restaurant.id)?.stars ?? 0);
  }, [restaurant, user]);

  useEffect(() => {
    if (!restaurant) {
      return;
    }

    trackMarketingEvent("restaurant_view", {
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.name,
      category: restaurant.category,
      region: restaurant.region,
      recommendation_count: getRecommendationCount(restaurant.id),
    });
  }, [restaurant]);

  const visibleReviews = useMemo(
    () => storedReviews.filter((review) => !GUIDE_REVIEW_USERS.has(review.user)),
    [storedReviews]
  );
  const publicReviewSummary = useMemo(() => summarizeReviews(visibleReviews), [visibleReviews]);
  const reviewGallery = useMemo(() => collectReviewPhotos(visibleReviews).slice(0, 8), [visibleReviews]);
  const primaryReviewPhotoUrl = useMemo(
    () => getPrimaryReviewPhotoUrl(visibleReviews),
    [visibleReviews]
  );
  const sortedReviews = useMemo(
    () => sortReviews(visibleReviews, reviewSortMode),
    [reviewSortMode, visibleReviews]
  );
  const relatedRestaurants = useMemo(() => {
    if (!restaurant) {
      return [];
    }

    return relatedSortMode === "related"
      ? getRelatedRestaurants(restaurant.id, 6)
      : getNearbyRestaurants(restaurant.id, 6);
  }, [relatedSortMode, restaurant]);

  useEffect(() => {
    if (!restaurant) {
      return;
    }

    if (
      !restaurant.googlePlaceId ||
      primaryReviewPhotoUrl ||
      restaurant.imageUrl.trim() ||
      restaurant.thumbnailFileName?.trim()
    ) {
      setGoogleFallbackPhoto(null);
      return;
    }

    let ignore = false;

    void fetch(`/api/places/photo?placeId=${encodeURIComponent(restaurant.googlePlaceId)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load Google place photo");
        }

        return response.json() as Promise<GoogleFallbackPhoto>;
      })
      .then((payload) => {
        if (ignore) {
          return;
        }

        if (payload?.imageUrl) {
          setGoogleFallbackPhoto(payload);
        } else {
          setGoogleFallbackPhoto(null);
        }
      })
      .catch(() => {
        if (!ignore) {
          setGoogleFallbackPhoto(null);
        }
      });

    return () => {
      ignore = true;
    };
  }, [
    primaryReviewPhotoUrl,
    restaurant,
    restaurant?.googlePlaceId,
    restaurant?.imageUrl,
    restaurant?.thumbnailFileName,
  ]);

  useEffect(() => {
    if (!restaurant) {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [restaurant]);

  if (!restaurant) {
    return <div className="flex min-h-screen items-center justify-center text-[#666]">식당을 찾을 수 없어요.</div>;
  }

  const displayImage = getRestaurantDisplayImage(restaurant, {
    width: 1200,
    height: 900,
    reviewPhotoUrl: primaryReviewPhotoUrl,
    googlePhotoUrl: googleFallbackPhoto?.imageUrl,
  });
  const primaryPrice = getRestaurantPrimaryPrice(restaurant);
  const shareImage = displayImage.hasPhoto ? displayImage.src : "/og-default.png";
  const visits = getVisitsByRestaurant(restaurant.id);
  const recommenders = getCreatorsByRestaurant(restaurant.id);
  const sourcesByRestaurant = getSourcesByRestaurant(restaurant.id);
  const recommendationCount = getRecommendationCount(restaurant.id);
  const shareUrl = getRestaurantUrl(restaurant.id);
  const redirectTo =
    typeof window === "undefined"
      ? location || `/restaurant/${restaurant.id}`
      : `${window.location.pathname}${window.location.search}`;
  const visiblePersonalRating = hoveredPersonalRating || personalRating;
  const assignedTopics = getTopicsForRestaurant(restaurant.id);
  const foundingBadge = formatRestaurantFoundingBadge(restaurant.foundingYear);
  const broadcastBadge = formatRestaurantBroadcastBadge(
    getRestaurantBroadcastMeta(restaurant.id)
  );
  const detailPhotoBadge =
    displayImage.source === "review"
      ? "방문자 사진"
      : displayImage.source === "google"
        ? "Google 사진"
        : !displayImage.hasPhoto
          ? "사진 준비 중"
          : "";
  const googlePhotoAttribution = googleFallbackPhoto?.attributions?.[0];

  const openAuthFeatureDialog = (mode: AuthFeatureMode) => {
    setAuthFeatureMode(mode);
    setAuthFeatureDialogOpen(true);
  };

  const removeRestaurantFromTopic = (topicId: string, topicName: string) => {
    const nextState = toggleRestaurantInTopic(topicId, restaurant.id);
    if (!nextState) {
      trackMarketingEvent("topic_remove", {
        restaurant_id: restaurant.id,
        topic_id: topicId,
        topic_name: topicName,
      });
      toast.success(`"${topicName}"에서 "${restaurant.name}"을 뺐어요.`);
    }
  };

  useSeo({
    title: `${restaurant.name} 맛집 정보`,
    description: `${restaurant.name}의 대표 메뉴, 위치, 추천 소스와 리뷰를 맛픽에서 확인해보세요.`,
    path: `/restaurant/${restaurant.id}`,
    type: "article",
    image: shareImage,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Restaurant",
      name: restaurant.name,
      image: buildAbsoluteUrl(shareImage),
      address: {
        "@type": "PostalAddress",
        streetAddress: restaurant.address,
        addressCountry: "KR",
      },
      servesCuisine: restaurant.category,
      url: shareUrl,
      ...(publicReviewSummary.count > 0
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: publicReviewSummary.average.toFixed(1),
              reviewCount: publicReviewSummary.count,
            },
          }
        : {}),
    },
  });

  const openComposer = () => {
    if (!isLoggedIn) {
      openAuthFeatureDialog("review");
      return;
    }
    if (!isLoggedIn) {
      toast("리뷰 작성은 로그인 후에 이용할 수 있어요.");
      return;
    }
    trackMarketingEvent("review_composer_open", {
      restaurant_id: restaurant.id,
    });
    setActiveTab("reviews");
    setComposerOpen(true);
  };

  const saveRating = (stars: number) => {
    if (!isLoggedIn || !user) {
      openAuthFeatureDialog("rating");
      return;
    }
    if (!isLoggedIn || !user) {
      toast("내 평점은 로그인 후에 저장할 수 있어요.");
      return;
    }

    if (personalRating === stars) {
      clearUserRestaurantRating(user.id, restaurant.id);
      setPersonalRating(0);
      setHoveredPersonalRating(0);
      trackMarketingEvent("rating_clear", {
        restaurant_id: restaurant.id,
      });
      toast.success("내 평점을 초기화했어요.");
      return;
    }

    saveUserRestaurantRating(user.id, restaurant.id, stars);
    setPersonalRating(stars);
    setHoveredPersonalRating(0);
    trackMarketingEvent("rating_submit", {
      restaurant_id: restaurant.id,
      stars,
    });
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

  const handleSubmitReview = async () => {
    if (!isLoggedIn || !user) {
      openAuthFeatureDialog("review");
      return;
    }

    if (!reviewDraft.trim() && reviewPhotos.length === 0) {
      toast("리뷰 내용이나 사진을 하나 이상 넣어주세요.");
      return;
    }

    setIsSubmittingReview(true);

    try {
      const reviewId = `${Date.now()}`;
      const photoUrls =
        reviewPhotos.length > 0 && user.syncToken
          ? await uploadReviewPhotos({
              restaurantId: restaurant.id,
              userId: user.id,
              syncToken: user.syncToken,
              reviewId,
              photos: reviewPhotos,
            })
          : reviewPhotos;

      const nextReview = normalizeReview({
        id: reviewId,
        user: getDisplayName(user),
        date: formatDate(),
        stars: reviewStars,
        text: reviewDraft.trim(),
        photos: photoUrls,
        createdAt: Date.now(),
      });

      const localMerged = mergeReviews([nextReview], storedReviews);
      setStoredReviews(localMerged);
      saveStoredReviews(restaurant.id, localMerged);

      if (user.syncToken) {
        const remoteSavedReview = await saveRemoteReview({
          restaurantId: restaurant.id,
          userId: user.id,
          syncToken: user.syncToken,
          review: nextReview,
        });

        const syncedReviews = mergeReviews([remoteSavedReview], localMerged);
        setStoredReviews(syncedReviews);
        saveStoredReviews(restaurant.id, syncedReviews);
      } else {
        toast("리뷰를 현재 기기에 먼저 저장했어요.");
      }

      setReviewDraft("");
      setReviewStars(5);
      setReviewPhotos([]);
      setComposerOpen(false);
      trackMarketingEvent("review_submit", {
        restaurant_id: restaurant.id,
        stars: nextReview.stars,
        photo_count: nextReview.photos.length,
      });
      toast.success("리뷰를 등록했어요.");
    } catch (error) {
      console.error(error);
      toast.error("리뷰를 업로드하지 못했어요. 다시 시도해주세요.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const submitReview = () => {
    if (!isLoggedIn || !user) {
      openAuthFeatureDialog("review");
      return;
    }
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
        imageUrl={shareImage}
      />
      <AuthFeatureDialog
        open={authFeatureDialogOpen}
        onOpenChange={setAuthFeatureDialogOpen}
        mode={authFeatureMode}
        redirectTo={redirectTo}
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
            onClick={() => {
              trackMarketingEvent("share_open", {
                restaurant_id: restaurant.id,
              });
              setShareOpen(true);
            }}
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
                    trackMarketingEvent("map_open", {
                      restaurant_id: restaurant.id,
                      source: "overflow_menu",
                    });
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
              </div>
              {(foundingBadge || broadcastBadge) ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {foundingBadge ? (
                    <span className="inline-flex items-center rounded-full bg-[#fff4f5] px-3 py-1 text-xs font-semibold text-[#ff6f7c]">
                      {foundingBadge}
                    </span>
                  ) : null}
                  {broadcastBadge ? (
                    <span className="inline-flex items-center rounded-full bg-[#eef7ff] px-3 py-1 text-xs font-semibold text-[#3b82c4]">
                      {broadcastBadge}
                    </span>
                  ) : null}
                </div>
              ) : null}
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

          {relatedRestaurants.length > 0 ? (
            <section className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-[#1a1a1a]">함께 둘러볼만한 맛집</p>
                  <p className="mt-1 text-sm text-[#8a8a8a]">
                    지금 보고 있는 식당과 잘 어울리는 곳을 연관도와 거리 기준으로 나눠서 보여드려요.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "related" as const, label: "연관순" },
                    { key: "nearby" as const, label: "현재 식당 거리순" },
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setRelatedSortMode(option.key)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        relatedSortMode === option.key
                          ? "bg-[#ff7b83] text-white shadow-[0_10px_20px_rgba(255,123,131,0.22)]"
                          : "border border-[#f0d7db] bg-white text-[#666] hover:border-[#ffb5be] hover:text-[#ff6f7c]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                {relatedRestaurants.map((entry) => {
                  const candidate = entry.restaurant;
                  const candidateFoundingBadge = formatRestaurantFoundingBadge(
                    candidate.foundingYear
                  );
                  const candidateBroadcastBadge = formatRestaurantBroadcastBadge(
                    getRestaurantBroadcastMeta(candidate.id)
                  );

                  return (
                    <Link
                      key={`${relatedSortMode}_${candidate.id}`}
                      href={`/restaurant/${candidate.id}`}
                      onClick={() => {
                        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
                      }}
                    >
                      <div className="flex h-full gap-4 rounded-[22px] border border-[#f0f0f0] bg-white p-4 transition hover:border-[#ffd1d8] hover:shadow-[0_12px_28px_rgba(0,0,0,0.06)]">
                        <img
                          src={getRestaurantDisplayImage(candidate, { width: 320, height: 240 }).src}
                          alt={candidate.name}
                          className="h-[92px] w-[92px] flex-shrink-0 rounded-[18px] object-cover"
                          loading="lazy"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[15px] font-bold text-[#171717]">{candidate.name}</p>
                              <p className="mt-1 line-clamp-1 text-sm text-[#7f7f7f]">{candidate.address}</p>
                            </div>
                            <span className="rounded-full bg-[#fff4f6] px-3 py-1 text-xs font-semibold text-[#ff6f7c]">
                              {formatDistance(entry.distanceKm)}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {candidateFoundingBadge ? (
                              <span className="rounded-full bg-[#fff4f5] px-2.5 py-1 text-[11px] font-semibold text-[#ff6f7c]">
                                {candidateFoundingBadge}
                              </span>
                            ) : null}
                            {candidateBroadcastBadge ? (
                              <span className="rounded-full bg-[#eef7ff] px-2.5 py-1 text-[11px] font-semibold text-[#3b82c4]">
                                {candidateBroadcastBadge}
                              </span>
                            ) : null}
                            {entry.sharedCreatorCount > 0 ? (
                              <span className="rounded-full bg-[#fff8eb] px-2.5 py-1 text-[11px] font-semibold text-[#b7791f]">
                                겹치는 크리에이터 {entry.sharedCreatorCount}
                              </span>
                            ) : null}
                            {entry.sharedSourceCount > 0 ? (
                              <span className="rounded-full bg-[#eef8ff] px-2.5 py-1 text-[11px] font-semibold text-[#3a7bb7]">
                                같은 선정 출처 {entry.sharedSourceCount}
                              </span>
                            ) : null}
                            {entry.sameCuisine ? (
                              <span className="rounded-full bg-[#f5f2ff] px-2.5 py-1 text-[11px] font-semibold text-[#7457c7]">
                                같은 카테고리
                              </span>
                            ) : null}
                            {entry.sameRegion ? (
                              <span className="rounded-full bg-[#effaf2] px-2.5 py-1 text-[11px] font-semibold text-[#2d8b57]">
                                같은 지역
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

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
                          onClick={() =>
                            trackMarketingEvent("video_click", {
                              restaurant_id: restaurant.id,
                              video_url: visit.videoUrl,
                              creator_id: visit.creatorId,
                            })
                          }
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
                  <div className="flex flex-col gap-4 rounded-[24px] border border-[#f1e7e9] bg-[#fff8f9] px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-base font-bold text-[#191919]">방문 리뷰</p>
                        <p className="mt-1 text-sm text-[#8a8a8a]">
                          방문자들의 실제 평점과 사진을 모아서 볼 수 있어요.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link href="/reviews">
                          <div
                            onClick={() =>
                              trackMarketingEvent("review_feed_open", {
                                restaurant_id: restaurant.id,
                                source: "restaurant_detail",
                              })
                            }
                            className="flex h-11 items-center justify-center rounded-full border border-[#ffd5db] bg-white px-5 text-sm font-semibold text-[#ff6f7c] transition hover:bg-[#fff2f4]"
                          >
                            방문자 리뷰 전체 보기
                          </div>
                        </Link>
                        <button
                          type="button"
                          onClick={openComposer}
                          className="flex h-11 items-center justify-center rounded-full bg-[#ff7b83] px-5 text-sm font-semibold text-white transition hover:brightness-95"
                        >
                          <MessageSquarePlus className="mr-2 h-4 w-4" />
                          리뷰 쓰기
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[20px] bg-white px-4 py-4">
                        <p className="text-xs font-semibold text-[#929292]">평균 평점</p>
                        <p className="mt-2 text-[28px] font-black tracking-[-0.03em] text-[#181818]">
                          {publicReviewSummary.count > 0 ? publicReviewSummary.average.toFixed(1) : "-"}
                        </p>
                      </div>
                      <div className="rounded-[20px] bg-white px-4 py-4">
                        <p className="text-xs font-semibold text-[#929292]">전체 리뷰</p>
                        <p className="mt-2 text-[28px] font-black tracking-[-0.03em] text-[#181818]">
                          {publicReviewSummary.count}
                        </p>
                      </div>
                      <div className="rounded-[20px] bg-white px-4 py-4">
                        <p className="text-xs font-semibold text-[#929292]">사진 리뷰</p>
                        <p className="mt-2 text-[28px] font-black tracking-[-0.03em] text-[#181818]">
                          {publicReviewSummary.withPhotosCount}
                        </p>
                      </div>
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
                            trackMarketingEvent("review_sort_change", {
                              restaurant_id: restaurant.id,
                              sort_mode: option.key,
                            });
                            setReviewSortMode(option.key);
                          }}
                          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                            reviewSortMode === option.key
                              ? "bg-[#ff7b83] text-white shadow-[0_10px_20px_rgba(255,123,131,0.22)]"
                              : "border border-[#f0d7db] bg-white text-[#666] hover:border-[#ffb5be] hover:text-[#ff6f7c]"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
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
                          onClick={handleSubmitReview}
                          disabled={isSubmittingReview}
                          className="flex h-11 items-center justify-center rounded-full bg-[#161616] px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          {isSubmittingReview ? "업로드 중..." : "리뷰 등록"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {reviewGallery.length > 0 ? (
                    <div className="rounded-[24px] border border-[#f0f0f0] bg-white p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-base font-bold text-[#171717]">사진 모아보기</p>
                          <p className="mt-1 text-sm text-[#8a8a8a]">
                            방문자들이 올린 사진만 먼저 모아봤어요.
                          </p>
                        </div>
                        <span className="rounded-full bg-[#fff4f6] px-3 py-1 text-xs font-semibold text-[#ff6f7c]">
                          {reviewGallery.length}장
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {reviewGallery.map((photo) => (
                          <div
                            key={photo.id}
                            className="overflow-hidden rounded-[18px] border border-[#efe4e6]"
                          >
                            <img
                              src={photo.url}
                              alt={`${photo.user} 리뷰 사진`}
                              className="aspect-square w-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-4">
                    {sortedReviews.map((review) => (
                      <div key={review.id} className="rounded-[24px] border border-[#f0f0f0] bg-white px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ffecee] text-sm font-bold text-[#ff7b83]">
                            {review.user.slice(0, 1)}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-[#171717]">{review.user}</p>
                            <p className="text-xs text-[#999999]">{review.date}</p>
                          </div>
                          <div className="text-sm font-semibold text-[#ffb24a]">{"★".repeat(review.stars)}</div>
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

                    {!isSubmittingReview && sortedReviews.length === 0 ? (
                      <div className="rounded-[24px] border border-dashed border-[#e3e3e3] px-6 py-12 text-center text-sm text-[#8a8a8a]">
                        <p>아직 방문 리뷰가 없어요. 첫 리뷰를 남겨보면 이 식당의 분위기를 더 잘 전달할 수 있어요.</p>
                      </div>
                    ) : null}
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
          <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <img
              src={displayImage.src}
              alt={restaurant.name}
              className="aspect-[4/3] w-full object-cover"
            />
            {detailPhotoBadge ? (
              <div className="absolute left-4 top-4 rounded-full bg-white/92 px-3 py-1 text-xs font-semibold text-[#6f7280] backdrop-blur">
                {detailPhotoBadge}
              </div>
            ) : null}
            {primaryPrice ? (
              <div className="absolute bottom-4 left-4 rounded-full bg-[#111111]/78 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                대표 가격 {primaryPrice}
              </div>
            ) : null}
            {displayImage.source === "google" && googlePhotoAttribution?.displayName ? (
              <div className="border-t border-[#f3eef0] bg-white px-4 py-2 text-[11px] text-[#8a8a8a]">
                Google 사진 · {googlePhotoAttribution.uri ? (
                  <a
                    href={googlePhotoAttribution.uri}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[#6f7280] underline underline-offset-2"
                  >
                    {googlePhotoAttribution.displayName}
                  </a>
                ) : (
                  <span className="font-medium text-[#6f7280]">
                    {googlePhotoAttribution.displayName}
                  </span>
                )}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#1a1a1a]">방문자 평점</h3>
                <p className="mt-1 text-xs leading-5 text-[#8a8a8a]">
                  실제 방문자 리뷰를 바탕으로 요약한 공용 평점이에요.
                </p>
              </div>
              {publicReviewSummary.count > 0 ? (
                <div className="text-right">
                  <p className="text-[30px] font-black tracking-[-0.03em] text-[#171717]">
                    {publicReviewSummary.average.toFixed(1)}
                  </p>
                  <p className="text-xs text-[#8a8a8a]">{publicReviewSummary.count}개 리뷰</p>
                </div>
              ) : null}
            </div>

            {publicReviewSummary.count > 0 ? (
              <div className="mt-4 space-y-2.5">
                {publicReviewSummary.distribution.map((entry) => {
                  const fill =
                    publicReviewSummary.count > 0
                      ? (entry.count / publicReviewSummary.count) * 100
                      : 0;

                  return (
                    <div key={entry.stars} className="flex items-center gap-3">
                      <span className="w-5 text-xs font-semibold text-[#6d6d6d]">{entry.stars}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f2ecee]">
                        <div
                          className="h-full rounded-full bg-[#ffb24a]"
                          style={{ width: `${fill}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-xs text-[#8a8a8a]">{entry.count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-[18px] border border-dashed border-[#efe4e6] bg-[#fffafb] px-4 py-4 text-sm text-[#8a8a8a]">
                아직 공용 리뷰가 많지 않아요. 첫 방문 리뷰를 남기면 이 식당의 공용 평점이 시작돼요.
                <button
                  type="button"
                  onClick={openComposer}
                  className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-[#ffd5db] bg-white px-4 text-sm font-semibold text-[#ff6f7c] transition hover:bg-[#fff0f3]"
                >
                  {"\uB9AC\uBDF0 \uB0A8\uAE30\uB7EC \uAC00\uAE30"}
                </button>
              </div>
            )}

            {reviewGallery.length > 0 ? (
              <div className="mt-4 border-t border-[#f3eef0] pt-4">
                <div className="grid grid-cols-4 gap-2">
                  {reviewGallery.slice(0, 4).map((photo) => (
                    <div key={`summary_${photo.id}`} className="overflow-hidden rounded-[16px] border border-[#efe4e6]">
                      <img
                        src={photo.url}
                        alt={`${photo.user} 리뷰 사진`}
                        className="aspect-square w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
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
                    onClick={(event) => {
                      event.currentTarget.blur();
                      saveRating(value);
                    }}
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
            {!isLoggedIn ? (
              <div className="mt-4 border-t border-[#f3eef0] pt-4">
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#202020]">주제별 저장</p>
                    <p className="mt-1 text-xs leading-5 text-[#8a8a8a]">
                      로그인하면 데이트, 혼밥, 여행 코스처럼 원하는 주제를 만들고 식당을 나눠 담아둘 수 있어요.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      trackMarketingEvent("topic_picker_open", {
                        restaurant_id: restaurant.id,
                        source: "guest_cta",
                      });
                      openAuthFeatureDialog("topic");
                    }}
                    className="inline-flex h-9 w-full items-center justify-center whitespace-nowrap rounded-full border border-[#ffd2d8] bg-[#fff7f8] px-4 text-xs font-semibold text-[#ff6b7b] transition hover:bg-[#fff0f3] sm:w-auto sm:self-auto"
                  >
                    로그인하고 주제 저장
                  </button>
                </div>
                <div className="mt-3 rounded-[18px] border border-dashed border-[#ffe0e4] bg-[#fffafb] px-4 py-3">
                  <p className="text-xs leading-5 text-[#8a8a8a]">
                    주제를 만들면 저장한 맛집을 테마별로 다시 모아보고, 나중에 탐색 화면에서도 바로 불러올 수 있어요.
                  </p>
                </div>
              </div>
            ) : null}
            {isLoggedIn ? (
              <div className="mt-4 border-t border-[#f3eef0] pt-4">
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#202020]">주제별 저장</p>
                    <p className="mt-1 text-xs leading-5 text-[#8a8a8a]">
                      만든 주제에 이 식당을 담아 두고 나중에 탐색 화면에서 바로 모아볼 수 있어요.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      trackMarketingEvent("topic_picker_open", {
                        restaurant_id: restaurant.id,
                        source: "detail_sidebar",
                      });
                      setTopicPickerOpen(true);
                    }}
                    className="inline-flex h-9 w-full items-center justify-center whitespace-nowrap rounded-full border border-[#ffd2d8] bg-[#fff7f8] px-4 text-xs font-semibold text-[#ff6b7b] transition hover:bg-[#fff0f3] sm:w-auto sm:self-auto"
                  >
                    {topics.length > 0 ? "주제에 담기" : "주제 만들기"}
                  </button>
                </div>

                {assignedTopics.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {assignedTopics.map((topic) => (
                      <span
                        key={topic.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#ffd2d8] bg-[#fff4f6] py-1 pl-3 pr-1 text-xs font-semibold text-[#ff6b7b]"
                      >
                        <span>{topic.name}</span>
                        <button
                          type="button"
                          onClick={() => removeRestaurantFromTopic(topic.id, topic.name)}
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-white/70 text-[#ff6b7b] transition hover:bg-white"
                          aria-label={`${topic.name}에서 제거`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="mt-3 text-xs leading-5 text-[#8a8a8a]">
                  주제에 담기 버튼에서 같은 주제를 다시 누르면 취소되고, 아래 주제 오른쪽 X 버튼으로도 바로 뺄 수 있어요.
                </p>
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

          <div className="space-y-4">
            <AdsenseSlot label="Sponsored" />
            <CoupangSlot label="Partner Pick" />
          </div>

          <div className="flex flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <button
              type="button"
              onClick={() => {
                trackMarketingEvent("map_open", {
                  restaurant_id: restaurant.id,
                  source: "sidebar_cta",
                });
                navigate(`/map?type=restaurant&value=${encodeURIComponent(restaurant.id)}`);
              }}
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
