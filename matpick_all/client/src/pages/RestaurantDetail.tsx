import { useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Link, useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  Copy,
  ImagePlus,
  MessageCircle,
  MessageSquarePlus,
  Navigation,
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
import { RevenuePlacement } from "@/components/monetization/MonetizationSlot";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useLocale } from "@/contexts/LocaleContext";
import {
  creators,
  getCreatorDisplayName,
  getNearbyRestaurants,
  getRestaurantBroadcastMeta,
  getRelatedRestaurants,
  getRestaurantMenuItems,
  getRestaurantMenuSummary,
  getRecommendationCount,
  getSourceDisplayName,
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
import {
  fetchRestaurantComments,
  mergeComments,
  postRestaurantComment,
  readStoredComments,
  saveStoredComments,
  type RestaurantComment,
} from "@/lib/comments";
import { buildAbsoluteUrl, useSeo } from "@/lib/seo";
import {
  loadStoredLocation,
  LOCATION_UPDATED_EVENT,
  type StoredLocation,
} from "@/lib/location";
import type { Restaurant } from "@/data/types";

type DetailTab = "menu" | "comments" | "reviews" | "videos" | "details";
type ReviewItem = SharedReview;
type RelatedSortMode = "related" | "nearby";
const APP_URL = import.meta.env.VITE_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ?? "";
const MAX_REVIEW_PHOTOS = 3;
const MATPICK_FALLBACK_APP_URL = "https://matpick.co.kr";
const MOBILE_MAP_FALLBACK_DELAY_MS = 900;
const KOREAN_CITY_BY_ENGLISH_NAME: Record<string, string> = {
  busan: "\uBD80\uC0B0",
  daegu: "\uB300\uAD6C",
  daejeon: "\uB300\uC804",
  gangwon: "\uAC15\uC6D0",
  gwangju: "\uAD11\uC8FC",
  gyeonggi: "\uACBD\uAE30",
  incheon: "\uC778\uCC9C",
  jeju: "\uC81C\uC8FC",
  sejong: "\uC138\uC885",
  seoul: "\uC11C\uC6B8",
  ulsan: "\uC6B8\uC0B0",
};
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
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, ".");
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

function formatAddressForClipboard(address: string) {
  const normalized = address.replace(/\s+/g, " ").trim();
  if (!normalized.includes(",")) {
    return normalized;
  }

  const parts = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return normalized;
  }

  let changed = false;
  let cityPrefix = "";
  const countryPattern = /^(?:\uD55C\uAD6D|\uB300\uD55C\uBBFC\uAD6D|korea|south korea|republic of korea)$/i;
  const postalCodePattern = /^\d{5}(?:-\d{4})?$/;
  const englishSegmentPattern = /^[a-z][a-z\s.'-]*$/i;

  while (parts.length > 1 && countryPattern.test(parts[parts.length - 1])) {
    parts.pop();
    changed = true;
  }

  while (parts.length > 1 && postalCodePattern.test(parts[parts.length - 1])) {
    parts.pop();
    changed = true;
  }

  const tail = parts[parts.length - 1];
  const mappedCity = KOREAN_CITY_BY_ENGLISH_NAME[tail?.toLowerCase() ?? ""];
  if (parts.length > 1 && mappedCity) {
    cityPrefix = mappedCity;
    parts.pop();
    changed = true;
  } else if (changed && parts.length > 1 && englishSegmentPattern.test(tail)) {
    parts.pop();
    changed = true;
  }

  if (!changed) {
    return normalized;
  }

  const koreanAddress = parts.join(", ").trim();
  if (!cityPrefix || !koreanAddress) {
    return koreanAddress || normalized;
  }

  if (
    koreanAddress === cityPrefix ||
    koreanAddress.startsWith(`${cityPrefix} `) ||
    koreanAddress.startsWith(`${cityPrefix}\uC2DC`) ||
    koreanAddress.startsWith(`${cityPrefix}\uAD11\uC5ED\uC2DC`) ||
    koreanAddress.startsWith(`${cityPrefix}\uD2B9\uBCC4\uC2DC`)
  ) {
    return koreanAddress;
  }

  return `${cityPrefix} ${koreanAddress}`;
}

function isMobileMapContext() {
  if (typeof window === "undefined") {
    return false;
  }

  return /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);
}

function getMapAppName() {
  return encodeURIComponent(APP_URL || MATPICK_FALLBACK_APP_URL);
}

function buildNaverNavigationUrls(restaurant: Restaurant) {
  const destinationName = encodeURIComponent(restaurant.name);
  const destinationQuery = encodeURIComponent(`${restaurant.name} ${restaurant.address}`);

  return {
    appUrl: `nmap://navigation?dlat=${restaurant.lat}&dlng=${restaurant.lng}&dname=${destinationName}&appname=${getMapAppName()}`,
    webUrl: `https://map.naver.com/p/search/${destinationQuery}`,
  };
}

function buildKakaoNavigationUrls(
  restaurant: Restaurant,
  currentLocation: StoredLocation | null
) {
  if (currentLocation) {
    const routePath = `sp=${currentLocation.lat},${currentLocation.lng}&ep=${restaurant.lat},${restaurant.lng}&by=car`;

    return {
      appUrl: `kakaomap://route?${routePath}`,
      webUrl: `http://m.map.kakao.com/scheme/route?${routePath}`,
    };
  }

  const point = `${restaurant.lat},${restaurant.lng}`;

  return {
    appUrl: `kakaomap://look?p=${point}`,
    webUrl: `http://m.map.kakao.com/scheme/look?p=${point}`,
  };
}

function openMobileMapApp(appUrl: string, fallbackUrl: string) {
  if (typeof window === "undefined") {
    return;
  }

  const fallbackTimer = window.setTimeout(() => {
    window.location.href = fallbackUrl;
  }, MOBILE_MAP_FALLBACK_DELAY_MS);

  const clearFallback = () => {
    window.clearTimeout(fallbackTimer);
    window.removeEventListener("blur", clearFallback);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      clearFallback();
    }
  };

  window.addEventListener("blur", clearFallback, { once: true });
  document.addEventListener("visibilitychange", handleVisibilityChange, {
    once: true,
  });
  window.location.href = appUrl;
}

export default function RestaurantDetail() {
  const { id } = useParams<{ id: string }>();
  const [location] = useLocation();
  const { isLoggedIn, user } = useAuth();
  const { isEnglish } = useLocale();
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
  const [comments, setComments] = useState<RestaurantComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [topicPickerOpen, setTopicPickerOpen] = useState(false);
  const [authFeatureDialogOpen, setAuthFeatureDialogOpen] = useState(false);
  const [authFeatureMode, setAuthFeatureMode] =
    useState<AuthFeatureMode>("rating");
  const [reviewSortMode, setReviewSortMode] = useState<ReviewSortMode>("latest");
  const [relatedSortMode, setRelatedSortMode] = useState<RelatedSortMode>("related");
  const [currentLocation, setCurrentLocation] = useState<StoredLocation | null>(() =>
    loadStoredLocation()
  );
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
    if (typeof window === "undefined") {
      return;
    }

    const syncLocation = () => {
      setCurrentLocation(loadStoredLocation());
    };

    window.addEventListener(LOCATION_UPDATED_EVENT, syncLocation as EventListener);
    return () =>
      window.removeEventListener(LOCATION_UPDATED_EVENT, syncLocation as EventListener);
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
    if (!restaurant) {
      return;
    }

    const localComments = readStoredComments(restaurant.id);
    setComments(localComments);
    setCommentDraft("");
    let ignore = false;

    void fetchRestaurantComments(restaurant.id)
      .then((remoteComments) => {
        if (ignore) {
          return;
        }

        const merged = mergeComments(remoteComments, localComments);
        setComments(merged);
        saveStoredComments(restaurant.id, merged);
      })
      .catch(() => {
        // Keep locally cached comments when the shared store is unavailable.
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

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [restaurant]);

  if (!restaurant) {
    return <div className="flex min-h-screen items-center justify-center text-[#666]">식당을 찾을 수 없어요.</div>;
  }

  const displayImage = getRestaurantDisplayImage(restaurant, {
    width: 1200,
    height: 900,
    reviewPhotoUrl: primaryReviewPhotoUrl,
  });
  const primaryPrice = getRestaurantPrimaryPrice(restaurant);
  const shareImage = displayImage.hasPhoto ? displayImage.src : "/og-default.png";
  const visits = getVisitsByRestaurant(restaurant.id);
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
        : !displayImage.hasPhoto
          ? "사진 준비 중"
          : "";
  const uiCopy = isEnglish
    ? {
        mobileSummaryEyebrow: "Quick actions",
        mobileSummaryDescription:
          "Open the map, continue in a navigation app, or jump into reviews before you scroll further.",
        relatedTitle: "Restaurants to explore next",
        relatedDescription:
          "Browse nearby alternatives or places that overlap in source, creator, cuisine, or neighborhood.",
        relatedModeRelated: "Related",
        relatedModeNearby: "Distance",
        relatedSharedCreator: "Shared creators",
        relatedSharedSource: "Same source",
        relatedSameCuisine: "Same cuisine",
        relatedSameRegion: "Same area",
        directionsTitle: "Continue in map apps",
        directionsDescription:
          "Open the destination directly in Naver Map or KakaoMap and continue with directions there.",
        actionNaver: "Naver Map",
        actionKakao: "KakaoMap",
        actionCopyAddress: "Copy address",
        actionReview: "Write a review",
      }
    : {
        mobileSummaryEyebrow: "\uBC14\uB85C \uC774\uC5B4\uBCF4\uAE30",
        mobileSummaryDescription:
          "\uC9C0\uB3C4 \uBCF4\uAE30, \uAE38\uC548\uB0B4 \uC5F0\uACB0, \uB9AC\uBDF0 \uC791\uC131\uC744 \uBA3C\uC800 \uBAA8\uC544\uC11C \uBCFC \uC218 \uC788\uAC8C \uC815\uB9AC\uD588\uC5B4\uC694.",
        relatedTitle: "\uD568\uAED8 \uB458\uB7EC\uBCFC \uB9CC\uD55C \uB9DB\uC9D1",
        relatedDescription:
          "\uC9C0\uAE08 \uBCF4\uACE0 \uC788\uB294 \uC2DD\uB2F9\uACFC \uAC00\uAE4C\uC6B4 \uACF3, \uB610\uB294 \uAC19\uC740 \uCD9C\uCC98\u00B7\uD06C\uB9AC\uC5D0\uC774\uD130\u00B7\uCE74\uD14C\uACE0\uB9AC\u00B7\uC9C0\uC5ED\uC744 \uACF5\uC720\uD558\uB294 \uACF3\uC744 \uBAA8\uC544\uBD24\uC5B4\uC694.",
        relatedModeRelated: "\uC5F0\uAD00\uC21C",
        relatedModeNearby: "\uD604\uC7AC \uC2DD\uB2F9 \uAC70\uB9AC\uC21C",
        relatedSharedCreator: "\uACB9\uCE58\uB294 \uD06C\uB9AC\uC5D0\uC774\uD130",
        relatedSharedSource: "\uAC19\uC740 \uCD9C\uCC98",
        relatedSameCuisine: "\uAC19\uC740 \uCE74\uD14C\uACE0\uB9AC",
        relatedSameRegion: "\uAC19\uC740 \uC9C0\uC5ED",
        directionsTitle: "\uC678\uBD80 \uC9C0\uB3C4\uB85C \uC774\uC5B4\uAC00\uAE30",
        directionsDescription:
          "\uB124\uC774\uBC84\uC9C0\uB3C4\uB098 \uCE74\uCE74\uC624\uB9F5\uC5D0\uC11C \uC2DD\uB2F9 \uC704\uCE58\uB97C \uBC14\uB85C \uC5F4\uACE0 \uAE38\uC548\uB0B4\uB97C \uC774\uC5B4\uAC00\uC138\uC694.",
        actionNaver: "\uB124\uC774\uBC84\uC9C0\uB3C4 \uAE38\uC548\uB0B4",
        actionKakao: "\uCE74\uCE74\uC624\uB9F5 \uC5F4\uAE30",
        actionCopyAddress: "\uC8FC\uC18C \uBCF5\uC0AC",
        actionReview: "\uB9AC\uBDF0 \uC4F0\uAE30",
      };
  const naverNavigation = buildNaverNavigationUrls(restaurant);
  const kakaoNavigation = buildKakaoNavigationUrls(restaurant, currentLocation);

  const openAuthFeatureDialog = (mode: AuthFeatureMode) => {
    setAuthFeatureMode(mode);
    setAuthFeatureDialogOpen(true);
  };

  const openExternalDirections = (provider: "naver" | "kakao") => {
    const target = provider === "naver" ? naverNavigation : kakaoNavigation;

    trackMarketingEvent("directions_click", {
      restaurant_id: restaurant.id,
      provider,
      has_origin: Boolean(currentLocation),
      platform: isMobileMapContext() ? "mobile" : "desktop",
    });

    if (isMobileMapContext()) {
      openMobileMapApp(target.appUrl, target.webUrl);
      return;
    }

    window.open(target.webUrl, "_blank", "noopener,noreferrer");
  };

  const copyRestaurantAddress = async () => {
    const addressForClipboard = formatAddressForClipboard(restaurant.address);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(addressForClipboard);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = addressForClipboard;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      toast.success(isEnglish ? "Address copied." : "\uC8FC\uC18C\uB97C \uBCF5\uC0AC\uD588\uC5B4\uC694.");
    } catch {
      toast.error(
        isEnglish
          ? "Could not copy the address."
          : "\uC8FC\uC18C\uB97C \uBCF5\uC0AC\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694."
      );
    }
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
    description: `${restaurant.name}의 메뉴, 가격, 위치 정보를 맛픽에서 간단하게 확인해보세요.`,
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

  const handleSubmitComment = async () => {
    const text = commentDraft.trim();

    if (!isLoggedIn || !user) {
      openAuthFeatureDialog("comment");
      return;
    }

    if (!text) {
      toast(
        isEnglish
          ? "Write a comment first."
          : "\uB313\uAE00 \uB0B4\uC6A9\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694."
      );
      return;
    }

    const nextComment: RestaurantComment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user: getDisplayName(user),
      date: formatDate(),
      text: text.slice(0, 500),
      createdAt: Date.now(),
    };
    const optimisticComments = mergeComments([nextComment], comments);
    setComments(optimisticComments);
    saveStoredComments(restaurant.id, optimisticComments);
    setCommentDraft("");
    setIsSubmittingComment(true);

    try {
      if (!user.syncToken) {
        throw new Error("Missing sync token");
      }

      const savedComment = await postRestaurantComment({
        restaurantId: restaurant.id,
        userId: user.id,
        syncToken: user.syncToken,
        comment: nextComment,
      });
      const syncedComments = mergeComments(
        [savedComment],
        optimisticComments.filter((comment) => comment.id !== nextComment.id)
      );
      setComments(syncedComments);
      saveStoredComments(restaurant.id, syncedComments);
      trackMarketingEvent("restaurant_comment_submit", {
        restaurant_id: restaurant.id,
      });
      toast.success(
        isEnglish ? "Comment posted." : "\uB313\uAE00\uC744 \uB4F1\uB85D\uD588\uC5B4\uC694."
      );
    } catch (error) {
      console.error(error);
      toast.error(
        isEnglish
          ? "The comment is saved on this device, but could not be shared yet."
          : "\uB313\uAE00\uC740 \uC774 \uAE30\uAE30\uC5D0 \uC800\uC7A5\uD588\uC9C0\uB9CC \uC11C\uBC84\uC5D0 \uC62C\uB9AC\uC9C0 \uBABB\uD588\uC5B4\uC694."
      );
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const renderQuickActionPanel = () => (
    <div className="rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[#1a1a1a]">{uiCopy.directionsTitle}</h3>
        <p className="mt-1 text-xs leading-5 text-[#8a8a8a]">{uiCopy.directionsDescription}</p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => openExternalDirections("naver")}
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-[#d8f0dc] bg-[#f4fbf6] px-4 py-3 text-sm font-semibold text-[#20744a] transition hover:border-[#bde4c5] hover:bg-[#eef8f1]"
        >
          <Navigation className="h-4 w-4" />
          {uiCopy.actionNaver}
        </button>
        <button
          type="button"
          onClick={() => openExternalDirections("kakao")}
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-[#f1e6bb] bg-[#fff9e8] px-4 py-3 text-sm font-semibold text-[#9a6b00] transition hover:border-[#e7d99a] hover:bg-[#fff5d9]"
        >
          <Navigation className="h-4 w-4" />
          {uiCopy.actionKakao}
        </button>
      </div>

      <button
        type="button"
        onClick={copyRestaurantAddress}
        className="mt-2.5 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl border border-[#ece7e8] bg-white px-4 py-3 text-sm font-semibold text-[#4d4749] transition hover:border-[#ffd0d5] hover:bg-[#fff8f9]"
      >
        <Copy className="h-4 w-4" />
        {uiCopy.actionCopyAddress}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f6f6f5]">
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
                    await copyRestaurantAddress();
                    setMoreOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#252525] transition hover:bg-[#fff6f7]"
                >
                  <Copy className="h-4 w-4" />
                  주소 복사
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </nav>

      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-5 p-4 sm:gap-6 sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="flex flex-col gap-6">
          <div className="lg:hidden">
            <div className="rounded-2xl border border-[#ffe1e6] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff7b83]">
                {uiCopy.mobileSummaryEyebrow}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#8a8a8a]">
                사진 없이도 메뉴, 위치, 길찾기를 먼저 볼 수 있게 정리했어요.
              </p>
            </div>

            <div className="mt-4">{renderQuickActionPanel()}</div>
          </div>

          <div className="rounded-lg border border-[#e8e5e5] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:p-7">
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
                    {getSourceDisplayName(source)}
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

          <div className="overflow-hidden rounded-lg border border-[#e8e5e5] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="border-b border-[#ebe7e8] px-3 py-3 sm:px-5">
              <div
                role="tablist"
                aria-label={isEnglish ? "Restaurant details" : "\uC2DD\uB2F9 \uC0C1\uC138 \uBA54\uB274"}
                className="grid grid-cols-5 gap-1"
              >
                {[
                  { key: "menu" as const, label: isEnglish ? "Menu" : "\uBA54\uB274" },
                  {
                    key: "comments" as const,
                    label: isEnglish ? `Comments ${comments.length}` : `\uB313\uAE00 ${comments.length}`,
                  },
                  {
                    key: "reviews" as const,
                    label: isEnglish
                      ? `Reviews ${publicReviewSummary.count}`
                      : `\uB9AC\uBDF0 ${publicReviewSummary.count}`,
                  },
                  { key: "videos" as const, label: isEnglish ? "Media" : "\uBC29\uC1A1" },
                  { key: "details" as const, label: isEnglish ? "Info" : "\uC815\uBCF4" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`min-h-10 border-b-2 px-1 py-2 text-xs font-bold transition sm:text-sm ${
                      activeTab === tab.key
                        ? "border-[#ff6f7c] text-[#202020]"
                        : "border-transparent text-[#8a8587] hover:text-[#3f3a3c]"
                    }`}
                  >
                    <span className="block truncate">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {activeTab === "menu" ? (
            <div className="border-b border-[#f0f0f0] px-5 py-5 sm:px-7">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff7b83]">
                MENU
              </p>
              <h2 className="mt-2 text-xl font-black text-[#171717]">메뉴</h2>
              <p className="mt-2 text-sm leading-6 text-[#8a8a8a]">
                방문 전에 확인하기 좋은 메뉴와 가격만 간단하게 정리했어요.
              </p>
            </div>
            ) : null}

            <div className="p-5 sm:p-7">
              {activeTab === "menu" ? (
              <div className="divide-y divide-[#ece8e9] border-y border-[#dedadb]">
                  {getRestaurantMenuItems(restaurant).length > 0 ? (
                    getRestaurantMenuItems(restaurant).map((menu) => (
                      <div key={menu.id} className="flex min-h-[72px] items-center justify-between gap-5 py-4">
                        <div className="min-w-0">
                          <p className="text-[15px] font-bold text-[#202020] sm:text-base">{menu.name}</p>
                          {menu.isSignature ? (
                            <p className="mt-1 text-xs font-semibold text-[#ff6f7c]">
                              {isEnglish ? "Signature" : "대표 메뉴"}
                            </p>
                          ) : null}
                          {menu.description ? (
                            <p className="mt-1.5 max-w-2xl text-xs leading-5 text-[#777173]">
                              {menu.description}
                            </p>
                          ) : null}
                        </div>
                        <p className="shrink-0 text-[15px] font-bold tabular-nums text-[#242122] sm:text-base">
                          {menu.price || (isEnglish ? "Ask" : "가격 문의")}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="px-6 py-12 text-center">
                      <p className="text-base font-bold text-[#171717]">메뉴 정보가 아직 준비 중이에요.</p>
                      <p className="mt-2 text-sm leading-6 text-[#8a8a8a]">
                        사진 없이도 어색하지 않도록 메뉴 데이터가 들어오면 이 영역에 바로 정리됩니다.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}

              {activeTab === "comments" ? (
                <section aria-labelledby="restaurant-comments-title">
                  <div className="flex flex-col gap-2 border-b border-[#e9e5e6] pb-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase text-[#ff6f7c]">COMMUNITY</p>
                      <h2
                        id="restaurant-comments-title"
                        className="mt-2 text-xl font-black text-[#202020]"
                      >
                        {isEnglish ? "Restaurant comments" : "식당 댓글"}
                      </h2>
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-[#777173]">
                      {isEnglish ? `${comments.length} comments` : `댓글 ${comments.length}개`}
                    </p>
                  </div>

                  <div className="mt-5 rounded-lg border border-[#ddd8d9] bg-[#faf9f9] p-4 sm:p-5">
                    <label htmlFor="restaurant-comment" className="text-sm font-bold text-[#292526]">
                      {isLoggedIn
                        ? isEnglish
                          ? "Share a short note"
                          : "이 식당에 대한 이야기를 남겨보세요"
                        : isEnglish
                          ? "Sign in to leave a comment"
                          : "로그인 후 댓글을 남길 수 있어요"}
                    </label>
                    <textarea
                      id="restaurant-comment"
                      value={commentDraft}
                      maxLength={500}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      onFocus={() => {
                        if (!isLoggedIn) {
                          openAuthFeatureDialog("comment");
                        }
                      }}
                      placeholder={
                        isEnglish
                          ? "Menu recommendations, waiting tips, or a short visit note"
                          : "추천 메뉴, 대기 팁, 방문 소감 등을 자유롭게 적어주세요"
                      }
                      className="mt-3 min-h-[112px] w-full resize-y rounded-md border border-[#d8d2d4] bg-white px-4 py-3 text-sm leading-6 text-[#242122] outline-none transition placeholder:text-[#aaa4a6] focus:border-[#ff8c97] focus:ring-2 focus:ring-[#ffe6e9]"
                    />
                    <div className="mt-3 flex items-center justify-between gap-4">
                      <span className="text-xs tabular-nums text-[#9a9496]">
                        {commentDraft.length}/500
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleSubmitComment()}
                        disabled={isSubmittingComment || !commentDraft.trim()}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#242122] px-5 text-sm font-bold text-white transition hover:bg-[#3a3537] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <MessageCircle className="h-4 w-4" />
                        {isSubmittingComment
                          ? isEnglish
                            ? "Posting..."
                            : "등록 중..."
                          : isEnglish
                            ? "Post"
                            : "댓글 등록"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 divide-y divide-[#ece8e9] border-y border-[#dedadb]">
                    {comments.length > 0 ? (
                      comments.map((comment) => (
                        <article key={comment.id} className="flex gap-3 py-5">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ffe9ec] text-sm font-black text-[#e86674]">
                            {comment.user.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <p className="text-sm font-bold text-[#262223]">{comment.user}</p>
                              <time className="text-xs text-[#999395]">{comment.date}</time>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#565052]">
                              {comment.text}
                            </p>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="py-12 text-center">
                        <MessageCircle className="mx-auto h-6 w-6 text-[#c7c1c3]" />
                        <p className="mt-3 text-sm font-semibold text-[#777173]">
                          {isEnglish
                            ? "No comments yet. Start the conversation."
                            : "아직 댓글이 없어요. 첫 이야기를 남겨보세요."}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
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
                      {restaurant.phone ? (
                        <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                          <span className="w-full flex-shrink-0 text-[#8a8a8a] sm:w-[96px]">전화</span>
                          <a className="font-semibold text-[#1d1d1d] hover:text-[#ff6f7c]" href={`tel:${restaurant.phone}`}>
                            {restaurant.phone}
                          </a>
                        </div>
                      ) : null}
                      {restaurant.operationStatus || restaurant.operationSummary ? (
                        <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                          <span className="w-full flex-shrink-0 text-[#8a8a8a] sm:w-[96px]">영업 상태</span>
                          <span className="text-[#1d1d1d]">
                            {[restaurant.operationStatus, restaurant.operationSummary].filter(Boolean).join(" · ")}
                          </span>
                        </div>
                      ) : null}
                      {(restaurant.weeklyHours?.length ?? 0) > 0 ? (
                        <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                          <span className="w-full flex-shrink-0 text-[#8a8a8a] sm:w-[96px]">영업시간</span>
                          <div className="space-y-1 text-[#1d1d1d]">
                            {restaurant.weeklyHours?.map((item) => (
                              <p key={`${restaurant.id}_${item.day}`}>
                                <span className="mr-2 inline-block w-4 font-semibold">{item.day}</span>
                                {item.hours.join(" · ")}
                              </p>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {restaurant.officialDescriptionAddress &&
                      restaurant.officialDescriptionAddress !== restaurant.address ? (
                        <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                          <span className="w-full flex-shrink-0 text-[#8a8a8a] sm:w-[96px]">방송 당시</span>
                          <span className="text-[#1d1d1d]">{restaurant.officialDescriptionAddress}</span>
                        </div>
                      ) : null}
                      {restaurant.placeUrl ? (
                        <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                          <span className="w-full flex-shrink-0 text-[#8a8a8a] sm:w-[96px]">지도 정보</span>
                          <a
                            className="font-semibold text-[#ff6f7c] hover:underline"
                            href={restaurant.placeUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            카카오맵에서 확인
                          </a>
                        </div>
                      ) : null}
                    </div>
                    {restaurant.detailCollectedAt ? (
                      <p className="mt-4 text-xs leading-5 text-[#9a9597]">
                        영업시간과 메뉴 가격은 {restaurant.detailCollectedAt.slice(0, 10)} 수집 기준이며, 방문 전 매장에 다시 확인해 주세요.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

        </div>

        <div className="flex h-fit flex-col gap-5 lg:sticky lg:top-[80px]">
          <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#1a1a1a]">주제별 저장</h3>
                <p className="mt-1 text-xs leading-5 text-[#8a8a8a]">
                  {isLoggedIn
                    ? "이 식당을 직접 만든 주제에 담아둘 수 있어요."
                    : "로그인하면 데이트, 혼밥, 여행 코스처럼 원하는 주제에 식당을 담아둘 수 있어요."}
                </p>
              </div>
            </div>
            {!isLoggedIn ? (
              <div className="mt-4">
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#202020]">로그인이 필요해요</p>
                    <p className="mt-1 text-xs leading-5 text-[#8a8a8a]">
                      내 주제에 담아두면 나중에 탐색 화면에서 다시 모아볼 수 있어요.
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
              <div className="mt-4">
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#202020]">내 주제에 담기</p>
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

          <RevenuePlacement providers={["kakao", "coupang"]} />

          <div className="hidden lg:block">{renderQuickActionPanel()}</div>

        </div>
      </div>
    </div>
  );
}
