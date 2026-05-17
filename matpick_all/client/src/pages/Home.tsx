import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Compass,
  Heart,
  MapPin,
  MessageCircleMore,
  Plus,
  Search,
  Send,
  Share2,
  Star,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import FavoriteTopicDialog, { FavoriteTopicBadge } from "@/components/FavoriteTopicDialog";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { AdsenseSlot } from "@/components/monetization/MonetizationSlot";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useLocale } from "@/contexts/LocaleContext";
import {
  publicDiscoveryTopics,
  mockSearchData,
  type DiscoveryTopic,
  type SearchResult,
} from "@/data";
import {
  featuredMapCollections,
  getMapCollectionPath,
  type MapCollectionTopic,
} from "@/data/mapCollections";
import { getDisplayName } from "@/lib/authProfile";
import { clearStoredLocation, saveStoredLocation } from "@/lib/location";
import { trackMarketingEvent } from "@/lib/marketing";
import { buildAbsoluteUrl, useSeo } from "@/lib/seo";
import matpickLogo from "../assets/matpick-logo-final 2.png";

const RECENT_KEY = "matpick_recent_searches";
const LOCATION_STATUS_KEY = "matpick_location_permission";
const LOCATION_DISMISSED_KEY = "matpick_location_prompt_dismissed";
const COLLECTION_SOCIAL_KEY = "matpick_collection_social";

const HOME_UI_KO = {
  brandFirst: "\uB9DB",
  brandSecond: "\uD53D",
  restaurantLabel: "\uB9DB\uC9D1",
  subscriberPrefix: "\uAD6C\uB3C5\uC790 ",
  regionLabel: "\uC9C0\uC5ED",
  foodLabel: "\uC74C\uC2DD\uC885\uB958",
  recentDeleteSuffix: "\uCD5C\uADFC \uAC80\uC0C9 \uC0AD\uC81C",
  guestTitle: "\uB85C\uADF8\uC778\uD558\uBA74 \uC774\uB7F0 \uD61C\uD0DD\uC774!",
  benefits: {
    saveTitle: "\uB9DB\uC9D1 \uC800\uC7A5",
    saveDescription:
      "\uAC00\uACE0 \uC2F6\uC740 \uB9DB\uC9D1\uC744 \uCC1C\uD574\uC11C \uB2E4\uC2DC \uD3B8\uD558\uAC8C \uCC3E\uC544\uBCFC \uC218 \uC788\uC5B4\uC694.",
    communityTitle: "\uCEE4\uBBA4\uB2C8\uD2F0 \uCC38\uC5EC",
    communityDescription:
      "\uB9AC\uBDF0\uC640 \uC758\uACAC\uC744 \uB0A8\uAE30\uACE0 \uB2E4\uB978 \uC0AC\uC6A9\uC790\uC640 \uD568\uAED8 \uACF5\uC720\uD560 \uC218 \uC788\uC5B4\uC694.",
    ratingTitle: "\uB098\uB9CC\uC758 \uD3C9\uC810",
    ratingDescription:
      "\uBC29\uBB38\uD55C \uB9DB\uC9D1\uC744 \uAE30\uB85D\uD574 \uB450\uACE0 \uB2E4\uC2DC \uBE44\uAD50\uD560 \uC218 \uC788\uC5B4\uC694.",
    topicTitle: "\uC8FC\uC81C\uBCC4 \uC800\uC7A5",
    topicDescription:
      "\uB370\uC774\uD2B8, \uD63C\uBC25, \uC5EC\uD589 \uCC98\uB7FC \uC6D0\uD558\uB294 \uD14C\uB9C8\uB85C \uB9DB\uC9D1\uC744 \uB098\uB220 \uB2F4\uC544\uB458 \uC218 \uC788\uC5B4\uC694.",
  },
  location: {
    deniedTitle: "\uC704\uCE58 \uAD8C\uD55C\uC774 \uCC28\uB2E8\uB418\uC5B4 \uC788\uC5B4\uC694",
    promptTitle:
      "\uB0B4 \uC8FC\uBCC0 \uB9DB\uC9D1\uC744 \uB354 \uC815\uD655\uD558\uAC8C \uCC3E\uC73C\uB824\uBA74 \uC704\uCE58 \uAD8C\uD55C\uC774 \uD544\uC694\uD574\uC694",
    deniedDescription:
      "\uBE0C\uB77C\uC6B0\uC800 \uC124\uC815\uC5D0\uC11C \uC704\uCE58 \uC811\uADFC\uC744 \uB2E4\uC2DC \uD5C8\uC6A9\uD558\uBA74 \uD604\uC7AC \uC704\uCE58 \uADFC\uCC98 \uB9DB\uC9D1\uC744 \uB354 \uBE60\uB974\uAC8C \uBCF4\uC5EC\uB4DC\uB9B4 \uC218 \uC788\uC5B4\uC694.",
    promptDescription:
      "\uD648\uD398\uC774\uC9C0\uC5D0 \uB4E4\uC5B4\uC628 \uC0AC\uC6A9\uC790\uC758 \uD604\uC7AC \uC704\uCE58\uB97C \uAE30\uC900\uC73C\uB85C \uC9C0\uC5ED \uAC80\uC0C9\uACFC \uCD94\uCC9C \uACB0\uACFC\uB97C \uB354 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uBCF4\uC5EC\uB4DC\uB9B4\uAC8C\uC694.",
    laterButton: "\uB098\uC911\uC5D0",
    allowButton: "\uC704\uCE58 \uD5C8\uC6A9\uD558\uAE30",
    loadingButton: "\uC704\uCE58 \uD655\uC778 \uC911...",
    unsupportedMessage:
      "\uC774 \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C\uB294 \uC704\uCE58 \uAD8C\uD55C \uC694\uCCAD\uC744 \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uC544\uC694.",
    unsupportedFootnote:
      "\uD604\uC7AC \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C\uB294 \uC704\uCE58 \uAD8C\uD55C \uC694\uCCAD\uC744 \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uC544\uC694. \uAC80\uC0C9\uC740 \uADF8\uB300\uB85C \uC0AC\uC6A9\uD560 \uC218 \uC788\uC5B4\uC694.",
    deniedFeedback:
      "\uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C \uC704\uCE58 \uAD8C\uD55C\uC774 \uCC28\uB2E8\uB410\uC5B4\uC694. \uBE0C\uB77C\uC6B0\uC800 \uC124\uC815\uC5D0\uC11C \uB2E4\uC2DC \uD5C8\uC6A9\uD558\uBA74 \uB0B4 \uC8FC\uBCC0 \uAC80\uC0C9\uC744 \uB354 \uC815\uD655\uD558\uAC8C \uBCF4\uC5EC\uB4DC\uB9B4 \uC218 \uC788\uC5B4\uC694.",
    failedFeedback:
      "\uC704\uCE58\uB97C \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.",
  },
  header: {
    logoAlt: "\uB9DB\uD53D \uB85C\uACE0",
    exploreLabel: "\uB9DB\uC9D1 \uD0D0\uC0C9",
    savedLabel: "\uC800\uC7A5\uD55C \uB9DB\uC9D1",
    logoutFallback: "\uB85C\uADF8\uC544\uC6C3",
    accountProviderPrefix: "\uB85C\uADF8\uC778 \uACC4\uC815",
    logout: "\uB85C\uADF8\uC544\uC6C3",
    login: "\uB85C\uADF8\uC778",
  },
  heroSubtitle:
    "\uB0B4 \uC8FC\uBCC0 \uC720\uBA85\uD55C \uB9DB\uC9D1\uC744 \uD55C\uACF3\uC5D0\uC11C \uCC3E\uC544\uBCF4\uC138\uC694!",
  searchPlaceholder:
    "\uC9C0\uC5ED, \uB9DB\uC9D1, \uC74C\uC2DD\uC744 \uAC80\uC0C9\uD574 \uBCF4\uC138\uC694!",
  searchHelperText:
    "\uAC80\uC0C9\uC5B4 \uC5C6\uC774 \uB3CB\uBCF4\uAE30\uB97C \uB204\uB974\uBA74 \uB0B4 \uC8FC\uBCC0 \uC720\uBA85 \uB9DB\uC9D1 \uC9C0\uB3C4\uAC00 \uBC14\uB85C \uC5F4\uB824\uC694.",
  searchButtonLabel: "\uAC80\uC0C9",
  collectionMarqueeLabel: "지도로 바로 보는 지역별 유명 맛집",
  collectionModal: {
    openAria: "주제 카드 자세히 보기",
    openCta: "카드 보기",
    close: "닫기",
    previous: "이전 카드",
    next: "다음 카드",
    viewMap: "지도에서 보기",
    like: "좋아요",
    comment: "댓글",
    share: "공유",
    commentPlaceholder: "댓글을 남겨보세요",
    commentSubmit: "게시",
    commentsTitle: "댓글",
    noComments: "댓글이 달리면 여기에 표시됩니다.",
    likeAdded: "좋아요를 눌렀어요",
    likeRemoved: "좋아요를 취소했어요",
    commentAdded: "댓글을 남겼어요",
    commentEmpty: "댓글 내용을 입력해 주세요",
    shareCopied: "링크가 복사됐어요",
    shareFailed: "공유 링크를 만들지 못했어요",
  },
  dropdown: {
    resultsTitle: "\uAC80\uC0C9 \uACB0\uACFC",
    resultsSuffix: "\uAC1C \uD56D\uBAA9",
    emptyResultsTitle:
      "\uC544\uC9C1 \uBE44\uAD50\uD560 \uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC5B4\uC694.",
    emptyResultsDescription:
      "\uB514\uC790\uC778\uC5D0 \uB4E4\uC5B4\uAC08 \uC774\uBBF8\uC9C0\uC640 \uACB0\uACFC \uCE74\uB4DC \uC790\uB9AC\uB294 \uBE44\uC6CC\uB458\uAC8C\uC694. \uAC80\uC0C9\uC5B4\uB97C \uC870\uAE08 \uB2E4\uB974\uAC8C \uC785\uB825\uD558\uAC70\uB098, \uB098\uC911\uC5D0 \uBC1B\uC744 \uB514\uC790\uC778 \uC790\uC0B0\uC5D0 \uB9DE\uCDB0 \uC774\uC5B4\uC11C \uBD99\uC77C \uC218 \uC788\uB3C4\uB85D \uAD6C\uC870\uB9CC \uBA3C\uC800 \uC7A1\uC544\uB450\uC5C8\uC2B5\uB2C8\uB2E4.",
    recentTitle: "\uCD5C\uADFC \uAC80\uC0C9 \uD56D\uBAA9",
    clearAll: "\uBAA8\uB450 \uC9C0\uC6B0\uAE30",
    noRecentTitle:
      "\uCD5C\uADFC \uAC80\uC0C9 \uD56D\uBAA9\uC774 \uC544\uC9C1 \uC5C6\uC5B4\uC694.",
    noRecentDescription:
      "\uAC80\uC0C9\uD558\uBA74 \uCD5C\uADFC \uD56D\uBAA9\uC774 \uC5EC\uAE30\uC5D0 \uC313\uC774\uACE0, \uC774\uD6C4\uC5D4 Group7 \uD615\uD0DC\uB85C \uBC14\uB85C \uB2E4\uC2DC \uC120\uD0DD\uD560 \uC218 \uC788\uAC8C \uB429\uB2C8\uB2E4.",
  },
} as const;

const HOME_UI_EN = {
  brandFirst: HOME_UI_KO.brandFirst,
  brandSecond: HOME_UI_KO.brandSecond,
  restaurantLabel: "Restaurants",
  subscriberPrefix: "Subscribers ",
  regionLabel: "Region",
  foodLabel: "Cuisine",
  recentDeleteSuffix: "remove recent search",
  guestTitle: "Sign in to unlock more with Matpick",
  benefits: {
    saveTitle: "Save places",
    saveDescription:
      "Bookmark the restaurants you want to visit and come back to them faster later.",
    communityTitle: "Join the community",
    communityDescription:
      "Leave reviews, share photos, and see what other diners thought about each place.",
    ratingTitle: "Your own ratings",
    ratingDescription:
      "Keep personal ratings for the places you visited and compare them again later.",
    topicTitle: "Save by topic",
    topicDescription:
      "Organize restaurants into themes like date night, solo meals, or travel courses.",
  },
  location: {
    deniedTitle: "Location access is blocked",
    promptTitle: "Allow location to discover nearby restaurants more accurately",
    deniedDescription:
      "If you allow location access again in your browser settings, Matpick can show better nearby restaurant results.",
    promptDescription:
      "We use your current location to make region search and nearby recommendations feel more natural on the home screen.",
    laterButton: "Maybe later",
    allowButton: "Allow location",
    loadingButton: "Checking location...",
    unsupportedMessage: "This browser does not support requesting location permission.",
    unsupportedFootnote:
      "Location permission requests are not supported in this browser. You can still use search normally.",
    deniedFeedback:
      "Location access was denied in your browser. If you allow it later, Matpick can show better nearby discovery results.",
    failedFeedback:
      "We could not confirm your location. Please try again in a moment.",
  },
  header: {
    logoAlt: "Matpick logo",
    exploreLabel: "Explore",
    savedLabel: "Saved places",
    logoutFallback: "Log out",
    accountProviderPrefix: "Signed in with",
    logout: "Log out",
    login: "Sign in",
  },
  heroSubtitle:
    "Find famous restaurants near you in one place.",
  searchPlaceholder: "Search a region, restaurant, or cuisine",
  searchHelperText:
    "Press search with an empty field to open the nearby famous restaurant map.",
  searchButtonLabel: "Search",
  collectionMarqueeLabel: "Famous local restaurant cards for the map",
  collectionModal: {
    openAria: "Open topic card details",
    openCta: "Open card",
    close: "Close",
    previous: "Previous card",
    next: "Next card",
    viewMap: "View on map",
    like: "Like",
    comment: "Comment",
    share: "Share",
    commentPlaceholder: "Leave a comment",
    commentSubmit: "Post",
    commentsTitle: "Comments",
    noComments: "Comments will appear here.",
    likeAdded: "Liked this list",
    likeRemoved: "Removed like",
    commentAdded: "Comment added",
    commentEmpty: "Please enter a comment",
    shareCopied: "Link copied",
    shareFailed: "Could not create a share link",
  },
  dropdown: {
    resultsTitle: "Search results",
    resultsSuffix: " results",
    emptyResultsTitle: "No matching result yet.",
    emptyResultsDescription:
      "Try a different keyword or browse the curated topic shortcuts below.",
    recentTitle: "Recent searches",
    clearAll: "Clear all",
    noRecentTitle: "No recent searches yet.",
    noRecentDescription:
      "Your recent searches will appear here so you can jump back into discovery faster.",
  },
} as const;

type LocationPermissionState =
  | "unknown"
  | "prompt"
  | "granted"
  | "denied"
  | "unsupported";

type CollectionComment = {
  id: string;
  text: string;
  createdAt: string;
};

type CollectionSocialState = {
  likedSlugs: string[];
  commentsBySlug: Record<string, CollectionComment[]>;
  shareCountsBySlug: Record<string, number>;
};

type CollectionStorySlide = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  tags?: string[];
  variant: "cover" | "editorial" | "list" | "map";
};

const emptyCollectionSocialState: CollectionSocialState = {
  likedSlugs: [],
  commentsBySlug: {},
  shareCountsBySlug: {},
};

function useHomeUi() {
  const { isEnglish } = useLocale();
  return isEnglish ? HOME_UI_EN : HOME_UI_KO;
}

function getSearchResultKey(item: Pick<SearchResult, "type" | "id">) {
  return `${item.type}:${item.id}`;
}

function normalizeSearchResult(item: SearchResult) {
  const latest = mockSearchData.find(
    (entry) => getSearchResultKey(entry) === getSearchResultKey(item)
  );

  return latest ? { ...item, ...latest } : item;
}

function getRecentSearches(): SearchResult[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as SearchResult[]).map(normalizeSearchResult) : [];
  } catch {
    return [];
  }
}

function saveRecentSearches(items: SearchResult[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    RECENT_KEY,
    JSON.stringify(items.slice(0, 8).map(normalizeSearchResult))
  );
}

function getCollectionSocialState(): CollectionSocialState {
  if (typeof window === "undefined") {
    return emptyCollectionSocialState;
  }

  try {
    const raw = window.localStorage.getItem(COLLECTION_SOCIAL_KEY);
    if (!raw) {
      return emptyCollectionSocialState;
    }

    const parsed = JSON.parse(raw) as Partial<CollectionSocialState>;
    const commentsBySlug = Object.fromEntries(
      Object.entries(parsed.commentsBySlug ?? {}).filter(([, comments]) =>
        Array.isArray(comments)
      )
    ) as Record<string, CollectionComment[]>;

    return {
      likedSlugs: Array.isArray(parsed.likedSlugs) ? parsed.likedSlugs : [],
      commentsBySlug,
      shareCountsBySlug:
        parsed.shareCountsBySlug && typeof parsed.shareCountsBySlug === "object"
          ? parsed.shareCountsBySlug
          : {},
    };
  } catch {
    return emptyCollectionSocialState;
  }
}

function saveCollectionSocialState(state: CollectionSocialState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(COLLECTION_SOCIAL_KEY, JSON.stringify(state));
}

function getCollectionStorySlides(collection: MapCollectionTopic): CollectionStorySlide[] {
  const tagText = collection.purposeTags.join(" · ");

  return [
    {
      id: "cover",
      eyebrow: collection.eyebrow,
      title: collection.title,
      body: collection.description,
      tags: collection.purposeTags,
      variant: "cover",
    },
    {
      id: "local",
      eyebrow: `${collection.areaLabel}에서 고를 때`,
      title: `${collection.areaLabel} 근처 유명 맛집만 빠르게`,
      body: "방송, 크리에이터, 가이드 출처가 있는 곳만 묶어서 지도에서 바로 훑어볼 수 있어요.",
      tags: [collection.areaLabel, `${collection.targetCount}곳`, "지도 탐색"],
      variant: "editorial",
    },
    {
      id: "mood",
      eyebrow: "이럴 때 저장",
      title: tagText,
      body: "데이트, 여행, 약속 전처럼 시간이 없을 때 먼저 열어보기 좋은 주제형 맛집 리스트입니다.",
      tags: collection.purposeTags,
      variant: "list",
    },
    {
      id: "map",
      eyebrow: "지도에서 한 번에",
      title: `${collection.targetCount}곳을 지도 위에서 바로 보기`,
      body: "카드를 넘겨본 뒤 마음에 들면 지도에서 거리와 위치를 비교해 보세요.",
      tags: ["지도 보기", collection.areaLabel],
      variant: "map",
    },
  ];
}

function persistLocationStatus(status: Exclude<LocationPermissionState, "unknown">) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCATION_STATUS_KEY, status);
}

function getStoredLocationStatus(): LocationPermissionState {
  if (typeof window === "undefined") {
    return "unknown";
  }

  const stored = window.localStorage.getItem(LOCATION_STATUS_KEY);
  if (
    stored === "prompt" ||
    stored === "granted" ||
    stored === "denied" ||
    stored === "unsupported"
  ) {
    return stored;
  }

  return "unknown";
}

function SearchResultItem({
  item,
  isHovered,
  onHover,
  onLeave,
  onSelect,
  showDelete = false,
  onDelete,
}: {
  item: SearchResult;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onSelect: () => void;
  showDelete?: boolean;
  onDelete?: () => void;
}) {
  const ui = useHomeUi();
  let accentLabel: string = ui.restaurantLabel;
  let detailText = "";

  if (item.type === "creator") {
    accentLabel = item.platform ?? "Creator";
    detailText = `${ui.subscriberPrefix}${item.subscribers ?? "-"}`;
  } else if (item.type === "region") {
    accentLabel = item.parentRegion ?? ui.regionLabel;
    detailText = `${ui.restaurantLabel} ${(item.restaurantCount ?? 0).toLocaleString()}\uAC1C`;
  } else if (item.type === "food") {
    accentLabel = ui.foodLabel;
    detailText = `${ui.restaurantLabel} ${(item.restaurantCount ?? 0).toLocaleString()}\uAC1C`;
  } else if (item.type === "source") {
    accentLabel = item.sourceTypeLabel ?? (ui.foodLabel === "Cuisine" ? "Source" : "출처");
    detailText = `${ui.restaurantLabel} ${(item.restaurantCount ?? 0).toLocaleString()}\uAC1C`;
  } else {
    accentLabel = item.category ?? ui.restaurantLabel;
    detailText = item.address ?? "";
  }

  return (
    <div
      className={`flex items-center gap-4 px-7 py-4 transition-colors ${
        isHovered ? "bg-[#fff6f7]" : "bg-white"
      }`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full">
        {item.type === "creator" && item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="h-full w-full rounded-full border border-[#ffd9de] object-cover"
          />
        ) : item.type === "source" && item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="h-full w-full rounded-[20px] border border-[#ffe1d8] object-cover"
          />
        ) : item.type === "region" ? (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-[#ececec] text-[#111111]">
            <MapPin className="h-8 w-8" strokeWidth={2.2} />
          </div>
        ) : item.type === "restaurant" ? (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-[#ffecee] text-[#ff7b83]">
            <UtensilsCrossed className="h-8 w-8" strokeWidth={2.1} />
          </div>
        ) : (
          <div className="h-full w-full rounded-full bg-[#d7d7d7]" />
        )}
      </div>

      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-[18px] font-semibold text-[#161616]">{item.name}</p>
        <div className="mt-1 flex min-w-0 items-center gap-3 text-[14px]">
          <span className="shrink-0 font-medium text-[#ff7b83]">{accentLabel}</span>
          <span className="truncate text-[#222222]">{detailText}</span>
        </div>
      </div>

      {showDelete && onDelete ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="rounded-full p-2 text-[#1f1f1f] transition hover:bg-[#fff3f4]"
          aria-label={`${item.name} ${ui.recentDeleteSuffix}`}
        >
          <X className="h-8 w-8" strokeWidth={1.8} />
        </button>
      ) : null}
    </div>
  );
}

function TopicShortcutButton({
  topic,
  href,
  onClick,
}: {
  topic: DiscoveryTopic;
  href: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      title={topic.name}
      onClick={onClick}
      className="flex w-[74px] flex-shrink-0 flex-col items-center gap-2 text-center sm:w-[86px]"
    >
      <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#ffd8de_0%,#ffe7f6_100%)] p-[2px] transition-all hover:shadow-[0_14px_30px_rgba(255,105,135,0.18)] sm:h-[68px] sm:w-[68px]">
        <span className="flex h-full w-full items-center justify-center rounded-full bg-white">
          {topic.imageUrl ? (
            <img
              src={topic.imageUrl}
              alt={topic.name}
              className="h-[50px] w-[50px] rounded-full object-cover sm:h-[58px] sm:w-[58px]"
            />
          ) : (
            <span className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-[#fff3f5] text-[10px] font-black text-[#ff7b83] sm:h-[58px] sm:w-[58px] sm:text-xs">
              TOP
            </span>
          )}
        </span>
      </span>

      <span className="max-w-[74px] truncate text-[11px] font-semibold leading-tight text-[#5a5a5a] sm:max-w-[86px]">
        {topic.name}
      </span>
    </Link>
  );
}

function BenefitItem({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff1f3] text-[#ff7b83]">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-[#1d1d1d]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#8b8b8b]">{description}</p>
      </div>
    </div>
  );
}

function GuestPanel({ redirectTo }: { redirectTo: string }) {
  const ui = useHomeUi();
  return (
    <div className="w-[320px] max-w-[calc(100vw-2rem)] rounded-[28px] border border-[#ffd5db] bg-white/95 p-6 shadow-[0_24px_70px_rgba(255,112,140,0.18)] backdrop-blur sm:w-[340px]">
      <h2 className="break-keep text-[28px] font-black leading-[1.05] text-[#161616]">
        {ui.guestTitle}
      </h2>
      <div className="mt-6 space-y-4">
        <BenefitItem
          icon={<Heart className="h-5 w-5 fill-current" />}
          title={ui.benefits.saveTitle}
          description={ui.benefits.saveDescription}
        />
        <BenefitItem
          icon={<MessageCircleMore className="h-5 w-5" />}
          title={ui.benefits.communityTitle}
          description={ui.benefits.communityDescription}
        />
        <BenefitItem
          icon={<Star className="h-5 w-5 fill-current" />}
          title={ui.benefits.ratingTitle}
          description={ui.benefits.ratingDescription}
        />
        <BenefitItem
          icon={<Plus className="h-5 w-5" />}
          title={ui.benefits.topicTitle}
          description={ui.benefits.topicDescription}
        />
      </div>
      <SocialLoginButtons redirectTo={redirectTo} className="mt-6" />
    </div>
  );
}

function LocationPermissionModal({
  open,
  locationState,
  feedback,
  isRequesting,
  onAllow,
  onLater,
}: {
  open: boolean;
  locationState: LocationPermissionState;
  feedback: string | null;
  isRequesting: boolean;
  onAllow: () => void;
  onLater: () => void;
}) {
  const ui = useHomeUi();
  if (!open) {
    return null;
  }

  const title =
    locationState === "denied"
      ? ui.location.deniedTitle
      : ui.location.promptTitle;

  const description =
    locationState === "denied"
      ? ui.location.deniedDescription
      : ui.location.promptDescription;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(17,17,17,0.28)] px-4">
      <div className="w-full max-w-[420px] rounded-[28px] border border-[#ffd7dd] bg-white p-7 shadow-[0_28px_90px_rgba(0,0,0,0.14)]">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fff0f2] text-[#ff7b83]">
          <MapPin className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-[24px] font-black leading-tight text-[#161616]">{title}</h2>
        <p className="mt-3 text-[15px] leading-7 text-[#707070]">{description}</p>

        {feedback ? (
          <div className="mt-4 rounded-2xl bg-[#fff5f6] px-4 py-3 text-sm leading-6 text-[#7b5b61]">
            {feedback}
          </div>
        ) : null}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onLater}
            className="flex-1 rounded-full border border-[#e9d9dd] px-5 py-3 text-sm font-semibold text-[#646464] transition hover:bg-[#faf7f8]"
          >
            {ui.location.laterButton}
          </button>
          <button
            type="button"
            onClick={onAllow}
            disabled={isRequesting || locationState === "unsupported"}
            className="flex-1 rounded-full bg-[#ff7b83] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRequesting ? ui.location.loadingButton : ui.location.allowButton}
          </button>
        </div>

        {locationState === "unsupported" ? (
          <p className="mt-4 text-xs leading-5 text-[#999999]">
            {ui.location.unsupportedFootnote}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function Home() {
  const ui = useHomeUi();
  const { locale, isEnglish } = useLocale();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>(getRecentSearches);
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const [isLoginPanelPinned, setIsLoginPanelPinned] = useState(false);
  const [showAccountPanel, setShowAccountPanel] = useState(false);
  const [isAccountPanelPinned, setIsAccountPanelPinned] = useState(false);
  const [showTopicDialog, setShowTopicDialog] = useState(false);
  const [isTopicDeleteMode, setIsTopicDeleteMode] = useState(false);
  const [selectedTopicIdsForDelete, setSelectedTopicIdsForDelete] = useState<string[]>([]);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [locationState, setLocationState] = useState<LocationPermissionState>(
    getStoredLocationStatus
  );
  const [locationFeedback, setLocationFeedback] = useState<string | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const loginRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const loginTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, navigate] = useLocation();
  const { isLoggedIn, user, logout } = useAuth();
  const { favoritesCount, topics, deleteTopics, getTopicRestaurantCount } = useFavorites();
  const userDisplayName = getDisplayName(user);
  const providerLabel =
    user?.provider === "kakao"
      ? isEnglish
        ? "Kakao account"
        : "카카오 계정"
      : isEnglish
        ? "Naver account"
        : "네이버 계정";

  useSeo({
    title: isEnglish
      ? "Matpick | Discover creator-picked restaurants in Korea"
      : "맛픽 Matpick | 크리에이터 추천 맛집 탐색",
    description: isEnglish
      ? "Find restaurants featured by YouTube creators, TV shows, and curated guides in one place with maps, menus, and saved topics."
      : "유튜브 방송, 미쉐린 가이드 같은 다양한 소스를 한곳에 모아 취향과 위치에 맞는 맛집을 찾는 서비스 맛픽.",
    path: "/",
    locale,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "맛픽",
        alternateName: "Matpick",
        url: buildAbsoluteUrl("/"),
        potentialAction: {
          "@type": "SearchAction",
          target: `${buildAbsoluteUrl("/map")}?type=all&value={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "맛픽",
        alternateName: "Matpick",
        url: buildAbsoluteUrl("/"),
        logo: buildAbsoluteUrl("/web-app-manifest-512x512.png"),
      },
    ],
  });

  const normalizedQuery = query.trim().toLowerCase();

  const filteredResults = normalizedQuery
    ? mockSearchData
        .filter((item) => {
          const searchableFields = [
            item.name,
            item.platform,
            item.subscribers,
            item.parentRegion,
            item.category,
            item.address,
            item.sourceTypeLabel,
            item.restaurantCount?.toString(),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchableFields.includes(normalizedQuery);
        })
        .slice(0, 8)
    : [];

  const activeItems = normalizedQuery ? filteredResults : recentSearches;

  useEffect(() => {
    setRecentSearches((prev) => {
      const normalized = prev.map(normalizeSearchResult);
      const changed = normalized.some(
        (item, index) => JSON.stringify(item) !== JSON.stringify(prev[index])
      );

      if (changed) {
        saveRecentSearches(normalized);
        return normalized;
      }

      return prev;
    });
  }, []);

  const closeLoginPanel = useCallback(() => {
    if (loginTimeoutRef.current) {
      clearTimeout(loginTimeoutRef.current);
      loginTimeoutRef.current = null;
    }

    setShowLoginPanel(false);
    setIsLoginPanelPinned(false);
  }, []);

  const closeAccountPanel = useCallback(() => {
    if (accountTimeoutRef.current) {
      clearTimeout(accountTimeoutRef.current);
      accountTimeoutRef.current = null;
    }

    setShowAccountPanel(false);
    setIsAccountPanelPinned(false);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (searchRef.current && !searchRef.current.contains(target)) {
        setIsFocused(false);
      }

      if (loginRef.current && !loginRef.current.contains(target)) {
        closeLoginPanel();
      }

      if (accountRef.current && !accountRef.current.contains(target)) {
        closeAccountPanel();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeAccountPanel, closeLoginPanel]);

  useEffect(() => {
    return () => {
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current);
      }

      if (accountTimeoutRef.current) {
        clearTimeout(accountTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    const timerId = window.setTimeout(async () => {
      const dismissed = window.localStorage.getItem(LOCATION_DISMISSED_KEY) === "true";

      if (dismissed) {
        return;
      }

      if (!("geolocation" in navigator)) {
        if (!ignore) {
          clearStoredLocation();
          setLocationState("unsupported");
          persistLocationStatus("unsupported");
          setShowLocationPrompt(true);
        }
        return;
      }

      let nextState: LocationPermissionState = getStoredLocationStatus();

      if (nextState === "unknown") {
        nextState = "prompt";
      }

      if ("permissions" in navigator && typeof navigator.permissions.query === "function") {
        try {
          const status = await navigator.permissions.query({
            name: "geolocation" as PermissionName,
          });

          nextState =
            status.state === "granted" || status.state === "denied"
              ? status.state
              : "prompt";
        } catch {
          nextState = "prompt";
        }
      }

      if (ignore) {
        return;
      }

      setLocationState(nextState);

      persistLocationStatus(nextState);

      if (nextState === "granted") {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (ignore) {
              return;
            }

            saveStoredLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          () => {
            // Ignore background refresh failures and keep the last known location.
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        );
      }

      if (nextState !== "granted") {
        setShowLocationPrompt(true);
      }
    }, 450);

    return () => {
      ignore = true;
      window.clearTimeout(timerId);
    };
  }, []);

  const handleLoginEnter = useCallback(() => {
    if (loginTimeoutRef.current) {
      clearTimeout(loginTimeoutRef.current);
      loginTimeoutRef.current = null;
    }
    setShowLoginPanel(true);
  }, []);

  const handleLoginLeave = useCallback(() => {
    if (isLoginPanelPinned) {
      return;
    }

    loginTimeoutRef.current = setTimeout(() => {
      setShowLoginPanel(false);
    }, 160);
  }, [isLoginPanelPinned]);

  const handleLoginToggle = useCallback(() => {
    if (showLoginPanel && isLoginPanelPinned) {
      closeLoginPanel();
      return;
    }

    if (loginTimeoutRef.current) {
      clearTimeout(loginTimeoutRef.current);
      loginTimeoutRef.current = null;
    }

    setShowLoginPanel(true);
    setIsLoginPanelPinned(true);
  }, [closeLoginPanel, isLoginPanelPinned, showLoginPanel]);

  const handleAccountEnter = useCallback(() => {
    if (accountTimeoutRef.current) {
      clearTimeout(accountTimeoutRef.current);
      accountTimeoutRef.current = null;
    }
    setShowAccountPanel(true);
  }, []);

  const handleAccountLeave = useCallback(() => {
    if (isAccountPanelPinned) {
      return;
    }

    accountTimeoutRef.current = setTimeout(() => {
      setShowAccountPanel(false);
    }, 160);
  }, [isAccountPanelPinned]);

  const handleAccountToggle = useCallback(() => {
    if (showAccountPanel && isAccountPanelPinned) {
      closeAccountPanel();
      return;
    }

    if (accountTimeoutRef.current) {
      clearTimeout(accountTimeoutRef.current);
      accountTimeoutRef.current = null;
    }

    setShowAccountPanel(true);
    setIsAccountPanelPinned(true);
  }, [closeAccountPanel, isAccountPanelPinned, showAccountPanel]);

  useEffect(() => {
    if (!showAccountPanel) {
      setIsTopicDeleteMode(false);
      setSelectedTopicIdsForDelete([]);
    }
  }, [showAccountPanel]);

  const toggleTopicDeleteSelection = useCallback((topicId: string) => {
    setSelectedTopicIdsForDelete((prev) =>
      prev.includes(topicId)
        ? prev.filter((candidateId) => candidateId !== topicId)
        : [...prev, topicId]
    );
  }, []);

  const handleDeleteSelectedTopics = useCallback(() => {
    if (selectedTopicIdsForDelete.length === 0) {
      return;
    }

    const deletedCount = deleteTopics(selectedTopicIdsForDelete);
    if (deletedCount > 0) {
      toast.success(`${deletedCount}개의 주제를 삭제했어요.`);
    }
    setSelectedTopicIdsForDelete([]);
    setIsTopicDeleteMode(false);
  }, [deleteTopics, selectedTopicIdsForDelete]);

  const handleOpenTopicPage = useCallback(
    (topicId: string) => {
      setIsTopicDeleteMode(false);
      setSelectedTopicIdsForDelete([]);
      closeAccountPanel();
      navigate(`/my/favorites?topic=${encodeURIComponent(topicId)}`);
    },
    [closeAccountPanel, navigate]
  );

  const handleSelect = useCallback(
    (item: SearchResult) => {
      const normalizedItem = normalizeSearchResult(item);
      trackMarketingEvent("search_result_click", {
        query: normalizedQuery || "recent",
        result_type: normalizedItem.type,
        result_id: normalizedItem.id,
        result_name: normalizedItem.name,
      });

      setRecentSearches((prev) => {
        const withoutCurrent = prev.filter(
          (entry) => getSearchResultKey(entry) !== getSearchResultKey(normalizedItem)
        );
        const updated = [normalizedItem, ...withoutCurrent];
        saveRecentSearches(updated);
        return updated;
      });

      setQuery(normalizedItem.name);
      setIsFocused(false);

      if (normalizedItem.type === "restaurant") {
        navigate(`/map?type=restaurant&value=${encodeURIComponent(normalizedItem.id)}`);
        return;
      }

      if (normalizedItem.type === "creator") {
        navigate(`/map?type=creator&value=${encodeURIComponent(normalizedItem.id)}`);
        return;
      }

      if (normalizedItem.type === "region") {
        navigate(`/map?type=region&value=${encodeURIComponent(normalizedItem.name)}`);
        return;
      }

      if (normalizedItem.type === "food") {
        navigate(`/map?type=food&value=${encodeURIComponent(normalizedItem.name)}`);
        return;
      }

      if (normalizedItem.type === "source") {
        navigate(`/map?type=source&value=${encodeURIComponent(normalizedItem.id)}`);
        return;
      }

      navigate("/map");
    },
    [navigate, normalizedQuery]
  );

  const handleDeleteRecent = useCallback((id: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveRecentSearches(updated);
      return updated;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    setRecentSearches([]);
    window.localStorage.removeItem(RECENT_KEY);
  }, []);

  const handlePrimarySearch = useCallback(() => {
    trackMarketingEvent("search_submit", {
      query: normalizedQuery || "",
      has_query: Boolean(normalizedQuery),
      result_count: filteredResults.length,
    });

    if (!normalizedQuery) {
      navigate("/map?type=nearby");
      return;
    }

    const selectedItem =
      filteredResults[hoveredIndex >= 0 ? hoveredIndex : 0] ?? filteredResults[0];

    if (selectedItem) {
      handleSelect(selectedItem);
      return;
    }

    navigate(`/map?type=region&value=${encodeURIComponent(query.trim())}`);
  }, [filteredResults, handleSelect, hoveredIndex, navigate, normalizedQuery, query]);

  const handleSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHoveredIndex((prev) => {
          if (activeItems.length === 0) {
            return -1;
          }

          return Math.min(prev + 1, activeItems.length - 1);
        });
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHoveredIndex((prev) => {
          if (activeItems.length === 0) {
            return -1;
          }

          return Math.max(prev - 1, 0);
        });
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();

        if (!normalizedQuery) {
          handlePrimarySearch();
          return;
        }

        const selectedItem = activeItems[hoveredIndex] ?? activeItems[0];

        if (selectedItem) {
          handleSelect(selectedItem);
          return;
        }

        handlePrimarySearch();
      }
    },
    [activeItems, handlePrimarySearch, handleSelect, hoveredIndex, normalizedQuery]
  );

  const requestLocationPermission = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocationState("unsupported");
      setLocationFeedback(ui.location.unsupportedMessage);
      persistLocationStatus("unsupported");
      return;
    }

    setIsRequestingLocation(true);
    setLocationFeedback(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsRequestingLocation(false);
        setLocationState("granted");
        persistLocationStatus("granted");
        saveStoredLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        window.localStorage.removeItem(LOCATION_DISMISSED_KEY);
        setShowLocationPrompt(false);
      },
      (error) => {
        setIsRequestingLocation(false);

        if (error.code === error.PERMISSION_DENIED) {
          setLocationState("denied");
          persistLocationStatus("denied");
          clearStoredLocation();
          setLocationFeedback(ui.location.deniedFeedback);
          return;
        }

        setLocationState("prompt");
        persistLocationStatus("prompt");
        setLocationFeedback(ui.location.failedFeedback);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  const handleDismissLocation = useCallback(() => {
    window.localStorage.setItem(LOCATION_DISMISSED_KEY, "true");
    setShowLocationPrompt(false);
  }, []);

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/";

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#fffdfd] text-[#161616]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15)_0%,rgba(255,255,255,0.6)_55%,rgba(255,255,255,0.96)_100%)]" />
        <img
          src={matpickLogo}
          alt=""
          className="absolute left-1/2 top-[57%] h-[660px] w-[660px] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.14] sm:h-[820px] sm:w-[820px] lg:h-[1080px] lg:w-[1080px]"
        />
      </div>

      <LocationPermissionModal
        open={showLocationPrompt}
        locationState={locationState}
        feedback={locationFeedback}
        isRequesting={isRequestingLocation}
        onAllow={requestLocationPermission}
        onLater={handleDismissLocation}
      />
      <FavoriteTopicDialog open={showTopicDialog} onOpenChange={setShowTopicDialog} />

      <header className="relative z-20 flex items-start justify-between gap-3 px-4 py-4 sm:px-8 sm:py-6">
        <button type="button" onClick={() => navigate("/")} className="p-0">
          <img
            src={matpickLogo}
            alt={ui.header.logoAlt}
            className="h-8 w-8 object-contain opacity-75"
          />
        </button>

        <div className="flex flex-wrap items-start justify-end gap-2 sm:gap-3">
          {isLoggedIn ? (
            <>
              <button
                type="button"
                onClick={() => navigate("/explore")}
                className="flex h-10 items-center justify-center rounded-full border border-[#ffd1d7] bg-white/90 px-4 text-xs font-semibold text-[#4a4a4a] shadow-[0_10px_24px_rgba(0,0,0,0.05)] backdrop-blur transition hover:bg-white sm:h-11 sm:px-5 sm:text-sm"
              >
                <Compass className="mr-2 h-4 w-4" />
                {ui.header.exploreLabel}
              </button>
              <button
                type="button"
                onClick={() => navigate("/my/favorites")}
                className="flex h-10 items-center justify-center rounded-full border border-[#ffd1d7] bg-white/90 px-4 text-xs font-semibold text-[#4a4a4a] shadow-[0_10px_24px_rgba(0,0,0,0.05)] backdrop-blur transition hover:bg-white sm:h-11 sm:px-5 sm:text-sm"
              >
                {ui.header.savedLabel} {favoritesCount}
              </button>
              <div
                ref={accountRef}
                className="relative"
                onMouseEnter={handleAccountEnter}
                onMouseLeave={handleAccountLeave}
              >
                <button
                  type="button"
                  onClick={handleAccountToggle}
                  className="flex h-10 items-center justify-center rounded-full bg-[#ff7b83] px-4 text-xs font-semibold text-white shadow-[0_12px_30px_rgba(255,108,136,0.26)] transition hover:brightness-95 sm:h-11 sm:px-5 sm:text-sm"
                >
                  {userDisplayName}
                </button>

                <div
                  className={`absolute right-0 top-full z-30 mt-3 w-[340px] origin-top-right rounded-[24px] border border-[#ffd5db] bg-white/96 p-4 shadow-[0_24px_70px_rgba(255,112,140,0.18)] backdrop-blur transition-all duration-200 ${
                    showAccountPanel
                      ? "pointer-events-auto translate-y-0 opacity-100"
                      : "pointer-events-none -translate-y-2 opacity-0"
                  }`}
                >
                  <div className="text-center">
                    <p className="text-sm font-semibold text-[#1d1d1d]">{userDisplayName}</p>
                    <div className="mt-3 flex justify-center">
                      <div className="inline-flex items-center gap-2 rounded-full border border-[#ffe0e5] bg-[#fff8f9] px-3 py-2">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full ${
                            user?.provider === "kakao"
                              ? "bg-[#FEE500] text-[#3C1E1E]"
                              : "bg-[#03C75A] text-white"
                          }`}
                        >
                          {user?.provider === "kakao" ? (
                            <KakaoProviderIcon />
                          ) : (
                            <NaverProviderIcon />
                          )}
                        </span>
                        <span className="text-xs font-semibold text-[#555555]">{providerLabel}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-[22px] border border-[#ffe2e6] bg-[#fff9fa] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        onClick={() => setShowTopicDialog(true)}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[#ffd2d8] bg-white px-4 text-sm font-semibold text-[#ff6b7b] transition hover:bg-[#fff2f4] sm:min-w-[160px] sm:flex-1"
                      >
                        <Plus className="h-4 w-4" />
                        내 주제 추가하기
                      </button>
                      {topics.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setIsTopicDeleteMode((prev) => !prev);
                            setSelectedTopicIdsForDelete([]);
                          }}
                          className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition sm:w-auto ${
                            isTopicDeleteMode
                              ? "border-[#ff9fa9] bg-[#ffeff2] text-[#ff5f70]"
                              : "border-[#ffd2d8] bg-white text-[#ff6b7b] hover:bg-[#fff2f4]"
                          }`}
                        >
                          <Trash2 className="h-4 w-4" />
                          {isTopicDeleteMode ? "삭제 취소" : "주제 삭제하기"}
                        </button>
                      ) : null}
                    </div>

                    {topics.length === 0 ? (
                      <p className="mt-3 text-xs leading-5 text-[#8d8d8d]">
                        아직 만든 주제가 없어요. 저장한 맛집을 데이트, 여행, 혼밥 같은 테마별로 나눠보세요.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {topics.map((topic) => (
                          <div
                            key={topic.id}
                            onClick={() => {
                              if (!isTopicDeleteMode) {
                                handleOpenTopicPage(topic.id);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (
                                !isTopicDeleteMode &&
                                (event.key === "Enter" || event.key === " ")
                              ) {
                                event.preventDefault();
                                handleOpenTopicPage(topic.id);
                              }
                            }}
                            role={isTopicDeleteMode ? undefined : "button"}
                            tabIndex={isTopicDeleteMode ? -1 : 0}
                            className={`flex items-center justify-between gap-3 rounded-[18px] border bg-white px-3 py-2.5 transition ${
                              isTopicDeleteMode && selectedTopicIdsForDelete.includes(topic.id)
                                ? "border-[#ffb7c0] bg-[#fff4f6]"
                                : "border-[#ffe5e9]"
                            } ${!isTopicDeleteMode ? "cursor-pointer hover:border-[#ffcad1] hover:bg-[#fff4f6]" : ""}`}
                          >
                            <div className="flex items-center gap-3">
                              {isTopicDeleteMode ? (
                                <button
                                  type="button"
                                  onClick={() => toggleTopicDeleteSelection(topic.id)}
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-[#ff6b7b]"
                                  aria-label={`${topic.name} 삭제 선택`}
                                >
                                  {selectedTopicIdsForDelete.includes(topic.id) ? (
                                    <CheckCircle2 className="h-5 w-5 fill-current" />
                                  ) : (
                                    <Circle className="h-5 w-5" />
                                  )}
                                </button>
                              ) : null}
                              <FavoriteTopicBadge topic={topic} />
                            </div>
                            <span className="flex-shrink-0 text-xs font-semibold text-[#8a8a8a]">
                              저장된 식당 : {getTopicRestaurantCount(topic.id)}곳
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {isTopicDeleteMode ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={handleDeleteSelectedTopics}
                          disabled={selectedTopicIdsForDelete.length === 0}
                          className="inline-flex h-10 w-full items-center justify-center rounded-full bg-[#ff6b7b] text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          선택한 주제 삭제하기 {selectedTopicIdsForDelete.length > 0 ? `(${selectedTopicIdsForDelete.length})` : ""}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={logout}
                    className="mt-4 flex h-10 w-full items-center justify-center rounded-full border border-[#ffd1d7] bg-[#fff8f9] text-sm font-semibold text-[#ff7b83] transition hover:bg-[#fff1f3]"
                  >
                    {ui.header.logout}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div
              ref={loginRef}
              className="relative"
              onMouseEnter={handleLoginEnter}
              onMouseLeave={handleLoginLeave}
            >
              <button
                type="button"
                onClick={handleLoginToggle}
                className="rounded-full bg-[#ff7b83] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(255,108,136,0.26)] transition hover:brightness-95 sm:px-8 sm:py-3"
              >
                {ui.header.login}
              </button>

              <div
                className={`absolute right-0 top-full z-30 mt-4 origin-top-right transition-all duration-200 ${
                  showLoginPanel
                    ? "pointer-events-auto translate-y-0 opacity-100"
                    : "pointer-events-none -translate-y-2 opacity-0"
                }`}
              >
                <GuestPanel redirectTo={redirectTo} />
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-12 pt-4 text-center sm:px-8 sm:pb-16 sm:pt-6">
        <section className="mx-auto flex w-full max-w-[980px] flex-col items-center">
          <h1
            className="inline-flex items-end justify-center gap-1 text-[68px] leading-none tracking-[-0.03em] sm:text-[114px] lg:text-[132px]"
            style={{ fontFamily: "'Black Han Sans', sans-serif", fontWeight: 400 }}
          >
            <span className="text-[#111111]">{ui.brandFirst}</span>
            <span className="text-[#ff7b83]">{ui.brandSecond}</span>
          </h1>

          <p className="mt-5 max-w-[720px] break-keep px-2 text-[18px] font-semibold leading-snug text-[#9a9a9a] sm:mt-7 sm:text-[28px] lg:max-w-none lg:whitespace-nowrap lg:text-[31px]">
            {ui.heroSubtitle}
          </p>

          <div ref={searchRef} className="relative mt-8 w-full max-w-[810px] sm:mt-10">
            <div className="overflow-hidden rounded-[30px] border border-[#ff9ea9] bg-white/96 shadow-[0_18px_60px_rgba(255,102,132,0.14)] backdrop-blur-sm">
              <div className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-9 sm:py-4">
                <input
                  type="text"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setHoveredIndex(-1);
                  }}
                  onFocus={() => setIsFocused(true)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={ui.searchPlaceholder}
                  className="w-full bg-transparent text-[15px] font-medium text-[#1f1f1f] outline-none placeholder:text-[#b6b6b6] sm:text-[21px]"
                />
                <button
                  type="button"
                  onClick={handlePrimarySearch}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[#111111] transition hover:bg-[#fff3f4] sm:h-12 sm:w-12"
                  aria-label={ui.searchButtonLabel}
                >
                  <Search className="h-7 w-7 sm:h-9 sm:w-9" strokeWidth={2.1} />
                </button>
              </div>
            </div>
            <p className="mt-3 px-3 text-center text-[13px] font-medium leading-5 text-[#9b8f92] sm:text-[15px]">
              {ui.searchHelperText}
            </p>

            <div className="mt-4 overflow-x-auto pb-2">
              <div className="flex min-w-max gap-4 px-1">
                {publicDiscoveryTopics.map((topic) => (
                  <TopicShortcutButton
                    key={topic.slug}
                    topic={topic}
                    href={topic.path}
                    onClick={() =>
                      trackMarketingEvent("topic_shortcut_click", {
                        topic_slug: topic.slug,
                        topic_name: topic.name,
                        source: "home",
                      })
                    }
                  />
                ))}
              </div>
            </div>

            {isFocused ? (
              <div className="absolute left-0 right-0 top-full z-30 mt-3 overflow-hidden rounded-[30px] border border-[#ffb2ba] bg-white shadow-[0_24px_80px_rgba(255,102,132,0.16)]">
                <div className="border-t border-[#ffb2ba] bg-white">
                  {normalizedQuery ? (
                    filteredResults.length > 0 ? (
                      <div className="py-2">
                        <div className="flex items-center justify-between px-7 py-3">
                          <p className="text-[16px] font-semibold text-[#1d1d1d]">
                            {ui.dropdown.resultsTitle}
                          </p>
                          <p className="text-[13px] text-[#8f8f8f]">
                            {filteredResults.length}
                            {ui.dropdown.resultsSuffix}
                          </p>
                        </div>
                        <div className="max-h-[384px] overflow-y-auto">
                          {filteredResults.map((item, index) => (
                            <SearchResultItem
                              key={item.id}
                              item={item}
                              isHovered={hoveredIndex === index}
                              onHover={() => setHoveredIndex(index)}
                              onLeave={() => setHoveredIndex(-1)}
                              onSelect={() => handleSelect(item)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="px-7 py-10 text-left">
                        <p className="text-[17px] font-semibold text-[#1f1f1f]">
                          {ui.dropdown.emptyResultsTitle}
                        </p>
                        <p className="mt-2 text-[14px] leading-6 text-[#8d8d8d]">
                          {ui.dropdown.emptyResultsDescription}
                        </p>
                      </div>
                    )
                  ) : recentSearches.length > 0 ? (
                    <div className="py-2">
                      <div className="flex items-center justify-between px-7 py-3">
                        <p className="text-[16px] font-semibold text-[#1d1d1d]">
                          {ui.dropdown.recentTitle}
                        </p>
                        <button
                          type="button"
                          onClick={handleClearAll}
                          className="text-[14px] font-medium text-[#1f1f1f] transition hover:text-[#ff7b83]"
                        >
                          {ui.dropdown.clearAll}
                        </button>
                      </div>
                      <div className="max-h-[384px] overflow-y-auto">
                        {recentSearches.map((item, index) => (
                          <SearchResultItem
                            key={item.id}
                            item={item}
                            isHovered={hoveredIndex === index}
                            onHover={() => setHoveredIndex(index)}
                            onLeave={() => setHoveredIndex(-1)}
                            onSelect={() => handleSelect(item)}
                            showDelete
                            onDelete={() => handleDeleteRecent(item.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="px-7 py-10 text-left">
                      <p className="text-[16px] font-semibold text-[#1f1f1f]">
                        {ui.dropdown.noRecentTitle}
                      </p>
                      <p className="mt-2 text-[14px] leading-6 text-[#8d8d8d]">
                        {ui.dropdown.noRecentDescription}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <FeaturedCollectionMarquee
          label={ui.collectionMarqueeLabel}
          collections={featuredMapCollections}
        />

        <div className="mt-8 w-full max-w-[840px] sm:mt-10">
          <AdsenseSlot label="Sponsored" />
        </div>
      </main>

      <div
        className={`relative z-10 transition-opacity duration-150 ${
          isFocused ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <SiteFooter />
      </div>
    </div>
  );
}

function FeaturedCollectionMarquee({
  label,
  collections,
}: {
  label: string;
  collections: MapCollectionTopic[];
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeIndex]);

  const openCollection = useCallback(
    (index: number) => {
      if (collections.length === 0) {
        return;
      }

      setActiveIndex(index % collections.length);
    },
    [collections.length]
  );

  return (
    <>
      <section className="relative left-1/2 mt-9 w-screen -translate-x-1/2 overflow-hidden border-y border-[#ffe1e7] bg-[#fff0f3] py-5 text-left sm:mt-11 sm:py-6">
        <div className="mx-auto mb-4 flex w-full max-w-[980px] items-center justify-between px-4 sm:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff7b83]">
            {label}
          </p>
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#fff0f3] to-transparent sm:w-28" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#fff0f3] to-transparent sm:w-28" />
        <div className="overflow-hidden px-3 sm:px-4">
          <div className="matpick-marquee-track">
            {[0, 1].map((groupIndex) => (
              <div className="matpick-marquee-group" key={groupIndex}>
                {collections.map((collection, index) => (
                  <MapCollectionCard
                    key={`${collection.slug}_${groupIndex}`}
                    collection={collection}
                    duplicateIndex={groupIndex * collections.length + index}
                    onOpen={() => openCollection(index)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {activeIndex !== null && portalRoot
        ? createPortal(
            <FeaturedCollectionModal
              collection={collections[activeIndex]}
              onClose={() => setActiveIndex(null)}
            />,
            portalRoot
          )
        : null}
    </>
  );
}

function MapCollectionCard({
  collection,
  duplicateIndex,
  onOpen,
}: {
  collection: MapCollectionTopic;
  duplicateIndex: number;
  onOpen: () => void;
}) {
  const ui = useHomeUi();

  return (
    <button
      type="button"
      onClick={() => {
        trackMarketingEvent("home_collection_marquee_click", {
          collection_slug: collection.slug,
          collection_title: collection.title,
          duplicate_index: duplicateIndex,
        });
        onOpen();
      }}
      className="group relative flex aspect-[9/16] h-[300px] w-[169px] flex-shrink-0 overflow-hidden rounded-[20px] border border-white/70 bg-[#2b2525] p-5 text-white shadow-[0_16px_36px_rgba(255,98,124,0.18)] transition hover:-translate-y-1 hover:shadow-[0_22px_44px_rgba(255,98,124,0.24)] sm:h-[326px] sm:w-[183px]"
      style={{ background: collection.palette.background }}
      aria-label={`${collection.title} ${ui.collectionModal.openAria}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(255,255,255,0.32),transparent_20%),linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.48))]" />
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/15 blur-sm" />
      <div className="relative z-10 flex h-full w-full flex-col justify-between">
        <div>
          <p className="text-[12px] font-semibold leading-5 text-white/80">
            {collection.eyebrow}
          </p>
          <h2 className="mt-2 break-keep text-[23px] font-black leading-tight tracking-normal text-white sm:text-[25px]">
            {collection.title}
          </h2>
        </div>
        <div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {collection.purposeTags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/20 px-2 py-1 text-[10px] font-semibold text-white/90 backdrop-blur"
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="line-clamp-2 text-[12px] font-medium leading-5 text-white/80">
            {collection.description}
          </p>
          <span
            className="mt-4 inline-flex items-center rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-[#ff6f7b] transition group-hover:bg-[#fff5f7]"
            style={{ color: collection.palette.accent }}
          >
            {ui.collectionModal.openCta}
          </span>
        </div>
      </div>
    </button>
  );
}

function FeaturedCollectionModal({
  collection,
  onClose,
}: {
  collection: MapCollectionTopic;
  onClose: () => void;
}) {
  const ui = useHomeUi();
  const slides = getCollectionStorySlides(collection);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [socialState, setSocialState] = useState<CollectionSocialState>(
    getCollectionSocialState
  );
  const [commentDraft, setCommentDraft] = useState("");
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const comments = socialState.commentsBySlug[collection.slug] ?? [];
  const isLiked = socialState.likedSlugs.includes(collection.slug);
  const likeCount = isLiked ? 1 : 0;
  const commentCount = comments.length;
  const shareCount = socialState.shareCountsBySlug[collection.slug] ?? 0;

  const goToSlide = useCallback(
    (index: number) => {
      const nextIndex = (index + slides.length) % slides.length;
      setActiveSlideIndex(nextIndex);
    },
    [slides.length]
  );

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (event.key === "Escape") {
        onClose();
      }

      if (isTyping) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToSlide(activeSlideIndex + 1);
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToSlide(activeSlideIndex - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSlideIndex, goToSlide, onClose]);

  const updateSocialState = useCallback((nextState: CollectionSocialState) => {
    setSocialState(nextState);
    saveCollectionSocialState(nextState);
  }, []);

  const handleLike = useCallback(() => {
    const nextLikedSlugs = isLiked
      ? socialState.likedSlugs.filter((slug) => slug !== collection.slug)
      : [...socialState.likedSlugs, collection.slug];

    updateSocialState({
      ...socialState,
      likedSlugs: nextLikedSlugs,
    });

    toast(isLiked ? ui.collectionModal.likeRemoved : ui.collectionModal.likeAdded, {
      duration: 1400,
    });

    trackMarketingEvent("home_collection_like_toggle", {
      collection_slug: collection.slug,
      liked: !isLiked,
    });
  }, [collection.slug, isLiked, socialState, ui.collectionModal, updateSocialState]);

  const handleCommentSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const text = commentDraft.trim();

      if (!text) {
        toast(ui.collectionModal.commentEmpty, { duration: 1400 });
        return;
      }

      const newComment: CollectionComment = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}`,
        text,
        createdAt: new Date().toISOString(),
      };

      updateSocialState({
        ...socialState,
        commentsBySlug: {
          ...socialState.commentsBySlug,
          [collection.slug]: [newComment, ...comments].slice(0, 8),
        },
      });
      setCommentDraft("");
      toast.success(ui.collectionModal.commentAdded, { duration: 1400 });

      trackMarketingEvent("home_collection_comment_add", {
        collection_slug: collection.slug,
      });
    },
    [
      collection.slug,
      commentDraft,
      comments,
      socialState,
      ui.collectionModal,
      updateSocialState,
    ]
  );

  const handleShare = useCallback(async () => {
    const sharePath = getMapCollectionPath(collection.slug);
    const shareUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${sharePath}`
        : sharePath;

    try {
      if (navigator.share) {
        await navigator.share({
          title: collection.title,
          text: collection.description,
          url: shareUrl,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success(ui.collectionModal.shareCopied, { duration: 1500 });
      } else {
        throw new Error("Share is not available");
      }

      trackMarketingEvent("home_collection_share", {
        collection_slug: collection.slug,
      });

      updateSocialState({
        ...socialState,
        shareCountsBySlug: {
          ...socialState.shareCountsBySlug,
          [collection.slug]: shareCount + 1,
        },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      toast(ui.collectionModal.shareFailed, { duration: 1600 });
    }
  }, [collection, shareCount, socialState, ui.collectionModal, updateSocialState]);

  const handleTouchEnd = (clientX: number) => {
    if (touchStartX === null) {
      return;
    }

    const deltaX = touchStartX - clientX;
    setTouchStartX(null);

    if (Math.abs(deltaX) < 48) {
      return;
    }

    goToSlide(activeSlideIndex + (deltaX > 0 ? 1 : -1));
  };

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex items-center justify-center overflow-hidden bg-[rgba(17,17,17,0.42)] px-3 py-4 text-white backdrop-blur-sm sm:px-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={collection.title}
    >
      <div
        className="relative h-[min(720px,calc(100vh-2rem))] w-full max-w-[640px] overflow-hidden rounded-[24px] bg-[#070b10] shadow-[0_28px_90px_rgba(0,0,0,0.32)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute left-4 top-4 z-30 flex h-12 w-12 items-center justify-center rounded-full text-white transition hover:bg-white/10 sm:left-6 sm:top-6"
          aria-label={ui.collectionModal.close}
        >
          <ChevronLeft className="h-9 w-9" strokeWidth={2.1} />
        </button>

        <div className="grid h-full grid-cols-[minmax(0,1fr)_104px] gap-3 px-4 pb-4 pt-14 sm:grid-cols-[minmax(0,1fr)_132px] sm:gap-4 sm:px-5 sm:pb-5">
          <div className="flex min-w-0 flex-col items-center">
            <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
              <div
                className="relative aspect-[9/16] h-full max-h-[590px] max-w-full overflow-hidden rounded-[6px] bg-white shadow-[0_26px_80px_rgba(0,0,0,0.45)]"
                onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
                onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
              >
                <div
                  className="flex h-full transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(-${activeSlideIndex * 100}%)` }}
                >
                  {slides.map((slide) => (
                    <CollectionInstagramSlide
                      key={slide.id}
                      slide={slide}
                      collection={collection}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => goToSlide(activeSlideIndex - 1)}
                  className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur transition hover:bg-black/50"
                  aria-label={ui.collectionModal.previous}
                >
                  <ChevronLeft className="h-6 w-6" strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  onClick={() => goToSlide(activeSlideIndex + 1)}
                  className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur transition hover:bg-black/50"
                  aria-label={ui.collectionModal.next}
                >
                  <ChevronRight className="h-6 w-6" strokeWidth={2.2} />
                </button>

                <div className="absolute bottom-7 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/20 px-3 py-2 backdrop-blur">
                  {slides.map((slide, index) => (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => goToSlide(index)}
                      className={`h-2 rounded-full transition-all ${
                        index === activeSlideIndex ? "w-5 bg-white" : "w-2 bg-white/55"
                      }`}
                      aria-label={`${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <form
              onSubmit={handleCommentSubmit}
              className="mt-3 flex w-full max-w-[336px] items-center gap-2"
            >
              <input
                ref={commentInputRef}
                type="text"
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                placeholder={ui.collectionModal.commentPlaceholder}
                className="min-w-0 flex-1 rounded-full border border-white/5 bg-[#252a30] px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/72 focus:border-white/35"
              />
              <button
                type="submit"
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#101418] transition hover:bg-[#ffe8ed]"
                aria-label={ui.collectionModal.commentSubmit}
              >
                <Send className="h-5 w-5" />
              </button>
            </form>
          </div>

          <aside className="flex min-h-0 flex-col pt-2">
            <div className="flex flex-col items-center gap-4">
              <InstagramActionButton
                icon={<Heart className={`h-7 w-7 ${isLiked ? "fill-current" : ""}`} />}
                label={likeCount.toLocaleString()}
                active={isLiked}
                ariaLabel={ui.collectionModal.like}
                onClick={handleLike}
              />
              <InstagramActionButton
                icon={<MessageCircleMore className="h-7 w-7" />}
                label={commentCount.toLocaleString()}
                ariaLabel={ui.collectionModal.comment}
                onClick={() => commentInputRef.current?.focus()}
              />
              <InstagramActionButton
                icon={<Share2 className="h-7 w-7" />}
                label={shareCount.toLocaleString()}
                ariaLabel={ui.collectionModal.share}
                onClick={handleShare}
              />
              <Link
                href={getMapCollectionPath(collection.slug)}
                onClick={() =>
                  trackMarketingEvent("home_collection_modal_map_click", {
                    collection_slug: collection.slug,
                  })
                }
                className="flex flex-col items-center gap-1 text-center text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)] transition hover:text-[#ff9ea9]"
                aria-label={ui.collectionModal.viewMap}
              >
                <MapPin className="h-7 w-7" />
                <span className="text-[11px] font-bold leading-4">
                  {ui.collectionModal.viewMap}
                </span>
              </Link>
            </div>

            <div className="mt-4 max-h-[190px] overflow-hidden rounded-[16px] border border-white/10 bg-white/10 p-3 text-left">
              <p className="text-xs font-black text-white">
                {ui.collectionModal.commentsTitle} {comments.length}
              </p>
              <div className="mt-3 max-h-[142px] space-y-2 overflow-y-auto pr-1">
                {comments.length > 0 ? (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded-[14px] bg-white/10 px-3 py-2 text-xs font-semibold leading-5 text-white/90"
                    >
                      {comment.text}
                    </div>
                  ))
                ) : (
                  <p className="break-keep text-xs font-medium leading-5 text-white/55">
                    {ui.collectionModal.noComments}
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>

        <div className="pointer-events-none absolute bottom-[72px] left-5 z-20 max-w-[360px] text-left sm:left-6">
          <p className="line-clamp-1 text-xs font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]">
            matpick · {collection.shortTitle}
          </p>
        </div>
      </div>
    </div>
  );
}

function InstagramActionButton({
  icon,
  label,
  ariaLabel,
  active = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  ariaLabel: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)] transition hover:text-[#ff9ea9] ${
        active ? "text-[#ff7b83]" : ""
      }`}
      aria-label={ariaLabel}
    >
      {icon}
      <span className="text-xs font-bold">{label}</span>
    </button>
  );
}

function CollectionInstagramSlide({
  slide,
  collection,
}: {
  slide: CollectionStorySlide;
  collection: MapCollectionTopic;
}) {
  const isCover = slide.variant === "cover";
  const isMap = slide.variant === "map";

  return (
    <article
      className={`relative h-full w-full flex-shrink-0 overflow-hidden ${
        isCover ? "text-white" : "text-[#202020]"
      }`}
      style={{ background: isCover ? collection.palette.background : "#ffffff" }}
    >
      {isCover ? (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(255,255,255,0.32),transparent_22%),linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.58))]" />
      ) : (
        <div className="absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(180deg,#f5f5f5_0%,#ffffff_72%)]" />
      )}
      <div className="absolute -right-16 top-10 h-44 w-44 rounded-full bg-[#ff7b83]/18 blur-2xl" />
      <div className="relative z-10 flex h-full flex-col justify-between px-7 py-8 sm:px-10 sm:py-11">
        <div>
          <p
            className={`break-keep text-[15px] font-black leading-6 ${
              isCover ? "text-white/85" : "text-[#777777]"
            }`}
          >
            {slide.eyebrow}
          </p>
          <h3
            className={`mt-10 break-keep font-black leading-[1.12] tracking-normal ${
              isCover
                ? "text-[42px] text-white sm:text-[54px]"
                : "text-[40px] text-[#242424] sm:text-[52px]"
            }`}
          >
            {slide.title}
          </h3>
        </div>

        <div>
          {slide.tags ? (
            <div className="mb-5 flex flex-wrap gap-2">
              {slide.tags.map((tag) => (
                <span
                  key={tag}
                  className={`rounded-full px-3 py-1.5 text-xs font-black ${
                    isCover
                      ? "bg-white/20 text-white"
                      : "bg-[#fff0f3] text-[#ff6576]"
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          <p
            className={`break-keep text-[22px] font-bold leading-[1.45] ${
              isCover ? "text-white/90" : "text-[#343434]"
            } ${isMap ? "text-[27px] sm:text-[32px]" : ""}`}
          >
            {slide.body}
          </p>
        </div>
      </div>
    </article>
  );
}

function KakaoProviderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3C6.48 3 2 6.38 2 10.5c0 2.65 1.8 4.99 4.49 6.32l-1 3.59a.43.43 0 0 0 .65.47l4.19-2.79c.55.08 1.11.12 1.67.12 5.52 0 10-3.38 10-7.71S17.52 3 12 3Z" />
    </svg>
  );
}

function NaverProviderIcon() {
  return <span className="text-sm font-black leading-none">N</span>;
}

