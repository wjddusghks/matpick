import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  CalendarCheck,
  CheckCircle2,
  Circle,
  Compass,
  Heart,
  MapPin,
  MessageCircleMore,
  Plus,
  Search,
  Star,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import FavoriteTopicDialog, { FavoriteTopicBadge } from "@/components/FavoriteTopicDialog";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import MonetizationSlot from "@/components/monetization/MonetizationSlot";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { mockSearchData, type SearchResult } from "@/data";
import { getDisplayName } from "@/lib/authProfile";
import { clearStoredLocation, saveStoredLocation } from "@/lib/location";
import { buildAbsoluteUrl, useSeo } from "@/lib/seo";
import matpickLogo from "../assets/matpick-logo-final 2.png";

const RECENT_KEY = "matpick_recent_searches";
const LOCATION_STATUS_KEY = "matpick_location_permission";
const LOCATION_DISMISSED_KEY = "matpick_location_prompt_dismissed";

const UI = {
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
    planTitle: "\uBC29\uBB38 \uACC4\uD68D",
    planDescription:
      "\uB2E4\uC74C\uC5D0 \uAC08 \uD6C4\uBCF4\uB97C \uC800\uC7A5\uD574 \uB450\uACE0 \uB0B4 \uC77C\uC815\uCC98\uB7FC \uAD00\uB9AC\uD560 \uC218 \uC788\uC5B4\uC694.",
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
    "\uC720\uD29C\uBE0C, \uC778\uC2A4\uD0C0 \uD06C\uB9AC\uC5D0\uC774\uD130\uB4E4\uC774 \uBC29\uBB38\uD55C \uB9DB\uC9D1\uC744 \uD55C\uACF3\uC5D0\uC11C \uCC3E\uC544\uBCF4\uC138\uC694!",
  searchPlaceholder:
    "\uB9DB\uC9D1, \uD06C\uB9AC\uC5D0\uC774\uD130, \uC9C0\uC5ED, \uC74C\uC2DD\uC744 \uAC80\uC0C9\uD574 \uBCF4\uC138\uC694!",
  searchButtonLabel: "\uAC80\uC0C9",
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

type LocationPermissionState =
  | "unknown"
  | "prompt"
  | "granted"
  | "denied"
  | "unsupported";

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
  let accentLabel: string = UI.restaurantLabel;
  let detailText = "";

  if (item.type === "creator") {
    accentLabel = item.platform ?? "Creator";
    detailText = `${UI.subscriberPrefix}${item.subscribers ?? "-"}`;
  } else if (item.type === "region") {
    accentLabel = item.parentRegion ?? UI.regionLabel;
    detailText = `${UI.restaurantLabel} ${(item.restaurantCount ?? 0).toLocaleString()}\uAC1C`;
  } else if (item.type === "food") {
    accentLabel = UI.foodLabel;
    detailText = `${UI.restaurantLabel} ${(item.restaurantCount ?? 0).toLocaleString()}\uAC1C`;
  } else if (item.type === "source") {
    accentLabel = item.sourceTypeLabel ?? "출처";
    detailText = `${UI.restaurantLabel} ${(item.restaurantCount ?? 0).toLocaleString()}\uAC1C`;
  } else {
    accentLabel = item.category ?? UI.restaurantLabel;
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
          aria-label={`${item.name} ${UI.recentDeleteSuffix}`}
        >
          <X className="h-8 w-8" strokeWidth={1.8} />
        </button>
      ) : null}
    </div>
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
  return (
    <div className="w-[320px] max-w-[calc(100vw-2rem)] rounded-[28px] border border-[#ffd5db] bg-white/95 p-6 shadow-[0_24px_70px_rgba(255,112,140,0.18)] backdrop-blur sm:w-[340px]">
      <h2 className="break-keep text-[28px] font-black leading-[1.05] text-[#161616]">
        {UI.guestTitle}
      </h2>
      <div className="mt-6 space-y-4">
        <BenefitItem
          icon={<Heart className="h-5 w-5 fill-current" />}
          title={UI.benefits.saveTitle}
          description={UI.benefits.saveDescription}
        />
        <BenefitItem
          icon={<MessageCircleMore className="h-5 w-5" />}
          title={UI.benefits.communityTitle}
          description={UI.benefits.communityDescription}
        />
        <BenefitItem
          icon={<Star className="h-5 w-5 fill-current" />}
          title={UI.benefits.ratingTitle}
          description={UI.benefits.ratingDescription}
        />
        <BenefitItem
          icon={<CalendarCheck className="h-5 w-5" />}
          title={UI.benefits.planTitle}
          description={UI.benefits.planDescription}
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
  if (!open) {
    return null;
  }

  const title =
    locationState === "denied"
      ? UI.location.deniedTitle
      : UI.location.promptTitle;

  const description =
    locationState === "denied"
      ? UI.location.deniedDescription
      : UI.location.promptDescription;

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
            {UI.location.laterButton}
          </button>
          <button
            type="button"
            onClick={onAllow}
            disabled={isRequesting || locationState === "unsupported"}
            className="flex-1 rounded-full bg-[#ff7b83] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRequesting ? UI.location.loadingButton : UI.location.allowButton}
          </button>
        </div>

        {locationState === "unsupported" ? (
          <p className="mt-4 text-xs leading-5 text-[#999999]">
            {UI.location.unsupportedFootnote}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>(getRecentSearches);
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const [showAccountPanel, setShowAccountPanel] = useState(false);
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

  useSeo({
    title: "맛픽 Matpick | 크리에이터와 소스 기반 맛집 탐색",
    description:
      "유튜브, 방송, 미쉐린, 가이드 같은 다양한 소스를 한곳에 모아 내 취향과 위치에 맞는 맛집을 찾는 서비스 맛픽.",
    path: "/",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "맛픽",
      url: buildAbsoluteUrl("/"),
      potentialAction: {
        "@type": "SearchAction",
        target: `${buildAbsoluteUrl("/map")}?type=all&value={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (searchRef.current && !searchRef.current.contains(target)) {
        setIsFocused(false);
      }

      if (loginRef.current && !loginRef.current.contains(target)) {
        setShowLoginPanel(false);
      }

      if (accountRef.current && !accountRef.current.contains(target)) {
        setShowAccountPanel(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    loginTimeoutRef.current = setTimeout(() => {
      setShowLoginPanel(false);
    }, 160);
  }, []);

  const handleAccountEnter = useCallback(() => {
    if (accountTimeoutRef.current) {
      clearTimeout(accountTimeoutRef.current);
      accountTimeoutRef.current = null;
    }
    setShowAccountPanel(true);
  }, []);

  const handleAccountLeave = useCallback(() => {
    accountTimeoutRef.current = setTimeout(() => {
      setShowAccountPanel(false);
    }, 160);
  }, []);

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

  const handleSelect = useCallback(
    (item: SearchResult) => {
      const normalizedItem = normalizeSearchResult(item);

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
    [navigate]
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
    const selectedItem = normalizedQuery
      ? filteredResults[hoveredIndex >= 0 ? hoveredIndex : 0] ?? filteredResults[0]
      : recentSearches[hoveredIndex >= 0 ? hoveredIndex : 0] ?? recentSearches[0];

    if (selectedItem) {
      handleSelect(selectedItem);
      return;
    }

    navigate("/explore");
  }, [filteredResults, handleSelect, hoveredIndex, navigate, normalizedQuery, recentSearches]);

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

        const selectedItem = activeItems[hoveredIndex] ?? activeItems[0];

        if (selectedItem) {
          handleSelect(selectedItem);
          return;
        }

        handlePrimarySearch();
      }
    },
    [activeItems, handlePrimarySearch, handleSelect, hoveredIndex]
  );

  const requestLocationPermission = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocationState("unsupported");
      setLocationFeedback(UI.location.unsupportedMessage);
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
          setLocationFeedback(UI.location.deniedFeedback);
          return;
        }

        setLocationState("prompt");
        persistLocationStatus("prompt");
        setLocationFeedback(UI.location.failedFeedback);
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
            alt={UI.header.logoAlt}
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
                {UI.header.exploreLabel}
              </button>
              <button
                type="button"
                onClick={() => navigate("/my/favorites")}
                className="flex h-10 items-center justify-center rounded-full border border-[#ffd1d7] bg-white/90 px-4 text-xs font-semibold text-[#4a4a4a] shadow-[0_10px_24px_rgba(0,0,0,0.05)] backdrop-blur transition hover:bg-white sm:h-11 sm:px-5 sm:text-sm"
              >
                {UI.header.savedLabel} {favoritesCount}
              </button>
              <div
                ref={accountRef}
                className="relative"
                onMouseEnter={handleAccountEnter}
                onMouseLeave={handleAccountLeave}
              >
                <button
                  type="button"
                  onClick={() => setShowAccountPanel((prev) => !prev)}
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
                        <span className="text-xs font-semibold text-[#555555]">
                          {user?.provider === "kakao" ? "카카오 계정" : "네이버 계정"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-[22px] border border-[#ffe2e6] bg-[#fff9fa] p-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowTopicDialog(true)}
                        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[#ffd2d8] bg-white text-sm font-semibold text-[#ff6b7b] transition hover:bg-[#fff2f4]"
                      >
                        <Plus className="h-4 w-4" />
                        내 주제 추가하기
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsTopicDeleteMode((prev) => !prev);
                          setSelectedTopicIdsForDelete([]);
                        }}
                        disabled={topics.length === 0}
                        className={`inline-flex h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
                          isTopicDeleteMode
                            ? "border-[#ff9fa9] bg-[#ffeff2] text-[#ff5f70]"
                            : "border-[#ffd2d8] bg-white text-[#ff6b7b] hover:bg-[#fff2f4]"
                        } disabled:cursor-not-allowed disabled:opacity-45`}
                      >
                        <Trash2 className="h-4 w-4" />
                        {isTopicDeleteMode ? "삭제 취소" : "주제 삭제하기"}
                      </button>
                    </div>

                    {topics.length === 0 ? (
                      <p className="mt-3 text-xs leading-5 text-[#8d8d8d]">
                        아직 만든 주제가 없어요. 저장한 맛집을 데이트, 여행, 야식처럼 주제별로 나눠
                        담아보세요.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {topics.map((topic) => (
                          <div
                            key={topic.id}
                            className={`flex items-center justify-between gap-3 rounded-[18px] border bg-white px-3 py-2.5 transition ${
                              isTopicDeleteMode && selectedTopicIdsForDelete.includes(topic.id)
                                ? "border-[#ffb7c0] bg-[#fff4f6]"
                                : "border-[#ffe5e9]"
                            }`}
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
                    {UI.header.logout}
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
                onClick={() => setShowLoginPanel((prev) => !prev)}
                className="rounded-full bg-[#ff7b83] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(255,108,136,0.26)] transition hover:brightness-95 sm:px-8 sm:py-3"
              >
                {UI.header.login}
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
            <span className="text-[#111111]">{UI.brandFirst}</span>
            <span className="text-[#ff7b83]">{UI.brandSecond}</span>
          </h1>

          <p className="mt-5 max-w-[720px] break-keep px-2 text-[18px] font-semibold leading-snug text-[#9a9a9a] sm:mt-7 sm:text-[28px] lg:max-w-none lg:whitespace-nowrap lg:text-[31px]">
            {UI.heroSubtitle}
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
                  placeholder={UI.searchPlaceholder}
                  className="w-full bg-transparent text-[15px] font-medium text-[#1f1f1f] outline-none placeholder:text-[#b6b6b6] sm:text-[21px]"
                />
                <button
                  type="button"
                  onClick={handlePrimarySearch}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[#111111] transition hover:bg-[#fff3f4] sm:h-12 sm:w-12"
                  aria-label={UI.searchButtonLabel}
                >
                  <Search className="h-7 w-7 sm:h-9 sm:w-9" strokeWidth={2.1} />
                </button>
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
                            {UI.dropdown.resultsTitle}
                          </p>
                          <p className="text-[13px] text-[#8f8f8f]">
                            {filteredResults.length}
                            {UI.dropdown.resultsSuffix}
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
                          {UI.dropdown.emptyResultsTitle}
                        </p>
                        <p className="mt-2 text-[14px] leading-6 text-[#8d8d8d]">
                          {UI.dropdown.emptyResultsDescription}
                        </p>
                      </div>
                    )
                  ) : recentSearches.length > 0 ? (
                    <div className="py-2">
                      <div className="flex items-center justify-between px-7 py-3">
                        <p className="text-[16px] font-semibold text-[#1d1d1d]">
                          {UI.dropdown.recentTitle}
                        </p>
                        <button
                          type="button"
                          onClick={handleClearAll}
                          className="text-[14px] font-medium text-[#1f1f1f] transition hover:text-[#ff7b83]"
                        >
                          {UI.dropdown.clearAll}
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
                        {UI.dropdown.noRecentTitle}
                      </p>
                      <p className="mt-2 text-[14px] leading-6 text-[#8d8d8d]">
                        {UI.dropdown.noRecentDescription}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <div className="mt-8 w-full max-w-[840px] sm:mt-10">
          <MonetizationSlot label="Sponsored" />
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
