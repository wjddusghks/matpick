import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  LocateFixed,
  LoaderCircle,
  MapPin,
  Search,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";
import {
  creators,
  getCreatorDisplayName,
  getCreatorsByRestaurant,
  getDiscoveryTopicBySlug,
  getDiscoveryTopicEpisodeBySlug,
  getRestaurantBroadcastMeta,
  getRestaurantMenuSummary,
  getRestaurantsByCreator,
  getRestaurantsBySource,
  getSearchSuggestions,
  getSourceById,
  getSourceDisplayName,
  getSourcesByRestaurant,
  restaurants,
  searchRestaurants,
  type Restaurant,
  type SearchResult,
} from "@/data";
import {
  getMapCollectionTopicBySlug,
  getRestaurantsForMapCollection,
} from "@/data/mapCollections";
import {
  getMapTopicDisplayName,
  getMapTopicPath,
  mapTopicShortcuts,
  type MapTopicShortcut,
} from "@/data/mapTopicShortcuts";
import NaverMap from "@/components/NaverMap";
import HeartButton from "@/components/HeartButton";
import { useLocale } from "@/contexts/LocaleContext";
import {
  clearStoredLocation,
  getDistanceInMeters,
  loadStoredLocation,
  LocationRequestError,
  LOCATION_UPDATED_EVENT,
  requestBestCurrentLocation,
  saveStoredLocation,
  type StoredLocation,
} from "@/lib/location";
import { translateCuisineLabel, type AppLocale } from "@/lib/locale";
import {
  formatRestaurantBroadcastBadge,
  getRestaurantDisplayImage,
  formatRestaurantFoundingBadge,
  getRestaurantPrimaryPrice,
} from "@/lib/restaurantPresentation";
import { useSeo } from "@/lib/seo";

const RELATED_TOPICS_LABEL: Record<AppLocale, string> = {
  ko: "\uAD00\uB828 \uC8FC\uC81C",
  en: "Related topics",
};

const NEARBY_RESTAURANT_LIMIT = 100;

const MAP_COPY = {
  ko: {
    searchResults: "검색 결과",
    allRestaurants: "전체 맛집",
    nearbyRestaurants: "내 주변 유명 맛집",
    nearbyDescription:
      "현재 위치에서 가까운 순서로 유명 맛집 100곳을 보여드려요.",
    regionRestaurants: (value: string) => `${value} 맛집`,
    cuisineRestaurants: (value: string) => `${value} 맛집`,
    sourceRestaurants: (value: string) => `${value} 맛집`,
    creatorRestaurants: (value: string) => `${value} 추천 맛집`,
    resultCount: (count: number) => `${count.toLocaleString()}개 검색 결과`,
    overseasCount: (count: number) => `해외 ${count.toLocaleString()}곳`,
    mapReadyTitle: "지도 좌표를 준비하고 있어요",
    mapReadyDescription:
      "저장된 식당 좌표를 불러오는 동안 지도가 잠시 비어 보일 수 있어요.",
    noResultsTitle: "검색 결과가 없어요",
    noResultsDescription: "다른 키워드나 채널 이름으로 다시 검색해보세요.",
    loadMore: "스크롤하면 더 많은 맛집을 불러와요.",
    listPlaceholder: "메뉴 정보가 아직 준비 중이에요.",
    detailsButton: "식당 상세 보기",
    photoPending: "사진 준비 중",
    creatorLabel: "크리에이터",
    regionLabel: "지역",
    cuisineLabel: "음식",
    sourceLabel: "주제",
    featuredByLabel: "유명한 이유",
    priceLabel: "대표 가격",
    expandResults: "목록 펼치기",
    collapseResults: "목록 접기",
    refreshLocation: "현재 위치 다시 찾기",
    locating: "정확한 위치 확인 중",
    locationUpdated: "현재 위치를 새로 확인했습니다.",
    locationDenied:
      "위치 권한이 차단되어 있습니다. 브라우저 설정에서 위치 접근을 허용해 주세요.",
    locationInaccurate:
      "정확한 위치를 확인하지 못했습니다. 휴대폰 설정에서 이 브라우저의 '정확한 위치 사용'을 켠 뒤 다시 시도해 주세요.",
    locationFailed: "현재 위치를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    pageTitle: (title: string) => `${title} 지도`,
    pageDescription: (title: string) =>
      `${title} 관련 맛집을 지도와 리스트로 한 번에 확인할 수 있는 Matpick 검색 결과 페이지입니다.`,
    pageName: (title: string) => `${title} 지도`,
  },
  en: {
    searchResults: "Search results",
    allRestaurants: "All restaurants",
    nearbyRestaurants: "Famous restaurants near me",
    nearbyDescription:
      "Browse up to 100 famous restaurants ordered by distance from your current location.",
    regionRestaurants: (value: string) => `${value} restaurants`,
    cuisineRestaurants: (value: string) => `${value} restaurants`,
    sourceRestaurants: (value: string) => `${value} restaurants`,
    creatorRestaurants: (value: string) => `${value} picks`,
    resultCount: (count: number) => `${count.toLocaleString()} results`,
    overseasCount: (count: number) => `${count.toLocaleString()} overseas`,
    mapReadyTitle: "We are preparing map coordinates",
    mapReadyDescription:
      "This may look empty for a moment while saved restaurant coordinates are loading.",
    noResultsTitle: "No result found",
    noResultsDescription: "Try another keyword, creator, or topic name.",
    loadMore: "Scroll to keep loading more restaurants.",
    listPlaceholder: "Menu details are coming soon.",
    detailsButton: "View restaurant",
    photoPending: "Photo coming soon",
    creatorLabel: "Creator",
    regionLabel: "Region",
    cuisineLabel: "Cuisine",
    sourceLabel: "Topic",
    featuredByLabel: "Featured by",
    priceLabel: "From",
    expandResults: "Expand results",
    collapseResults: "Collapse results",
    refreshLocation: "Refresh current location",
    locating: "Finding precise location",
    locationUpdated: "Your current location was refreshed.",
    locationDenied: "Location access is blocked. Allow it in your browser settings.",
    locationInaccurate:
      "A precise location was unavailable. Enable precise location for this browser in your phone settings and try again.",
    locationFailed: "Your current location could not be determined. Please try again.",
    pageTitle: (title: string) => `${title} map`,
    pageDescription: (title: string) =>
      `Browse ${title} restaurants on the map and in the list view on Matpick.`,
    pageName: (title: string) => `${title} map`,
  },
} as const;

function filterRestaurants(
  type: string,
  value: string,
  topicSlug: string,
  locale: AppLocale
): {
  restaurants: Restaurant[];
  title: string;
  description?: string;
} {
  const copy = MAP_COPY[locale];
  const isEnglish = locale === "en";

  switch (type) {
    case "nearby":
      return {
        restaurants: [...restaurants],
        title: copy.nearbyRestaurants,
        description: copy.nearbyDescription,
      };
    case "collection": {
      const collection = getMapCollectionTopicBySlug(value);
      if (!collection) {
        return {
          restaurants: [],
          title: copy.searchResults,
        };
      }

      return {
        restaurants: getRestaurantsForMapCollection(collection, {
          restaurants,
          getRestaurantsBySource,
        }),
        title: collection.title,
        description: collection.description,
      };
    }
    case "episode": {
      const resolvedTopicSlug = topicSlug || "ttoganjip";
      const topic = getDiscoveryTopicBySlug(resolvedTopicSlug);
      const episode = getDiscoveryTopicEpisodeBySlug(resolvedTopicSlug, value);

      if (!topic || !episode) {
        return {
          restaurants: [],
          title: copy.searchResults,
        };
      }

      const episodeRestaurantIds = new Set(episode.restaurantIds);
      return {
        restaurants: restaurants.filter((restaurant) =>
          episodeRestaurantIds.has(restaurant.id)
        ),
        title: `${topic.name} ${episode.episode}`,
        description: episode.description,
      };
    }
    case "creator": {
      const creator = creators.find((item) => item.id === value || item.name === value);
      if (!creator) {
        return {
          restaurants: [],
          title: copy.searchResults,
        };
      }

      return {
        restaurants: getRestaurantsByCreator(creator.id),
        title: copy.creatorRestaurants(getCreatorDisplayName(creator)),
      };
    }
    case "query":
      return {
        restaurants: searchRestaurants(value).map((match) => match.restaurant),
        title: isEnglish ? `Results for “${value}”` : `“${value}” 관련 맛집`,
      };
    case "region":
      return {
        restaurants: searchRestaurants(value)
          .filter((match) => match.matchTypes.includes("location"))
          .map((match) => match.restaurant),
        title: copy.regionRestaurants(value),
      };
    case "food":
      return {
        restaurants: searchRestaurants(value)
          .filter((match) =>
            match.matchTypes.some((type) => type === "menu" || type === "category")
          )
          .map((match) => match.restaurant),
        title: copy.cuisineRestaurants(
          isEnglish ? translateCuisineLabel(value, "en") : value
        ),
      };
    case "source": {
      const source = getSourceById(value);
      return {
        restaurants: getRestaurantsBySource(value),
        title: source ? copy.sourceRestaurants(getSourceDisplayName(source)) : copy.searchResults,
      };
    }
    case "restaurant": {
      const restaurant = restaurants.find((item) => item.id === value);
      return {
        restaurants: restaurant ? [restaurant] : [],
        title: restaurant?.name ?? copy.searchResults,
      };
    }
    default:
      return {
        restaurants: [...restaurants],
        title: copy.allRestaurants,
      };
  }
}

function SearchDropdownItem({
  item,
  isHovered,
  onHover,
  onLeave,
  onSelect,
}: {
  item: SearchResult;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onSelect: () => void;
}) {
  const { locale, isEnglish } = useLocale();
  const copy = MAP_COPY[locale];

  let accentLabel: string = copy.creatorLabel;
  let detailText = "";

  if (item.type === "query") {
    accentLabel = item.matchLabel ?? (isEnglish ? "All matches" : "통합 검색");
    detailText = item.matchedText ?? copy.resultCount(item.restaurantCount ?? 0);
  } else if (item.type === "creator") {
    accentLabel = item.platform ?? copy.creatorLabel;
    detailText = item.subscribers ?? "";
  } else if (item.type === "region") {
    accentLabel = item.parentRegion ?? copy.regionLabel;
    detailText = isEnglish
      ? `${(item.restaurantCount ?? 0).toLocaleString()} restaurants`
      : `맛집 ${(item.restaurantCount ?? 0).toLocaleString()}곳`;
  } else if (item.type === "food") {
    accentLabel = copy.cuisineLabel;
    detailText = isEnglish
      ? `${(item.restaurantCount ?? 0).toLocaleString()} restaurants`
      : `맛집 ${(item.restaurantCount ?? 0).toLocaleString()}곳`;
  } else if (item.type === "source") {
    accentLabel = item.sourceTypeLabel ?? copy.sourceLabel;
    detailText = isEnglish
      ? `${(item.restaurantCount ?? 0).toLocaleString()} restaurants`
      : `맛집 ${(item.restaurantCount ?? 0).toLocaleString()}곳`;
  } else {
    accentLabel = item.matchLabel ?? (
      item.category ? translateCuisineLabel(item.category, locale) : copy.searchResults
    );
    detailText = item.matchedText ?? item.address ?? "";
  }

  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
        isHovered ? "bg-[#fff7f8]" : "bg-white"
      }`}
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f4f4f4]">
        {item.image ? (
          <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
        ) : item.type === "region" ? (
          <MapPin className="h-5 w-5 text-[#777]" />
        ) : item.type === "query" ? (
          <Search className="h-5 w-5 text-[#ff7b83]" />
        ) : (
          <UtensilsCrossed className="h-5 w-5 text-[#ff7b83]" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#1a1a1a]">{item.name}</p>
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className="shrink-0 font-semibold text-[#ff7b83]">{accentLabel}</span>
          <span className="truncate text-[#888]">{detailText}</span>
        </div>
      </div>
    </button>
  );
}

function RestaurantCard({
  restaurant,
  selected,
  distanceMeters,
  onSelect,
}: {
  restaurant: Restaurant;
  selected: boolean;
  distanceMeters?: number | null;
  onSelect: () => void;
}) {
  const [, navigate] = useLocation();
  const { locale } = useLocale();
  const copy = MAP_COPY[locale];
  const creatorsForRestaurant = getCreatorsByRestaurant(restaurant.id);
  const sourcesForRestaurant = getSourcesByRestaurant(restaurant.id);
  const displayImage = getRestaurantDisplayImage(restaurant, {
    width: 320,
    height: 320,
  });
  const priceHint = getRestaurantPrimaryPrice(restaurant);
  const broadcastMeta = getRestaurantBroadcastMeta(restaurant.id);
  const foundingBadge = formatRestaurantFoundingBadge(restaurant.foundingYear, locale);
  const broadcastBadge = formatRestaurantBroadcastBadge(broadcastMeta, locale);

  return (
    <div
      className={`border-b border-[#f1f1f1] px-4 py-4 transition-colors ${
        selected ? "bg-[#fff7f1]" : "bg-white hover:bg-[#fafafa]"
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (
            event.target === event.currentTarget &&
            (event.key === "Enter" || event.key === " ")
          ) {
            event.preventDefault();
            onSelect();
          }
        }}
        className="flex w-full items-start gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#ffb8bf]"
      >
        <div className="h-20 w-20 overflow-hidden rounded-[18px] bg-[#f3f3f3]">
          <img src={displayImage.src} alt={restaurant.name} className="h-full w-full object-cover" />
        </div>

        <div className="pt-1">
          <HeartButton restaurantId={restaurant.id} size="sm" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-bold text-[#ff7b83]">{restaurant.name}</p>
            <span className="text-xs text-[#8c8c8c]">
              {translateCuisineLabel(restaurant.category, locale)}
            </span>
            {distanceMeters != null ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1f3] px-2 py-0.5 text-[11px] font-bold text-[#ff6f7c]">
                <MapPin className="h-3 w-3" strokeWidth={2.2} />
                {formatDistance(distanceMeters, locale)}
              </span>
            ) : null}
          </div>

          <p className="mt-1 truncate text-xs text-[#666]">{restaurant.address || restaurant.region}</p>
          {foundingBadge || broadcastBadge ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {foundingBadge ? (
                <span className="inline-flex items-center rounded-full bg-[#fff4f5] px-2 py-0.5 text-[11px] font-semibold text-[#ff6f7c]">
                  {foundingBadge}
                </span>
              ) : null}
              {broadcastBadge ? (
                <span className="inline-flex items-center rounded-full bg-[#eef7ff] px-2 py-0.5 text-[11px] font-semibold text-[#3b82c4]">
                  {broadcastBadge}
                </span>
              ) : null}
            </div>
          ) : null}
          {priceHint ? (
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b1a5a8]">
              {copy.priceLabel} {priceHint}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-[#888]">
            {getRestaurantMenuSummary(restaurant) || copy.listPlaceholder}
          </p>

          {!displayImage.hasPhoto ? (
            <p className="mt-1 text-[11px] font-medium text-[#9b9b9b]">{copy.photoPending}</p>
          ) : null}

          {creatorsForRestaurant.length > 0 || sourcesForRestaurant.length > 0 ? (
            <div className="mt-2.5">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#a69a9d]">
                {copy.featuredByLabel}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {creatorsForRestaurant.map((creator) => (
                  <span
                    key={creator.id}
                    className="inline-flex items-center rounded-full border border-[#ffd3d8] bg-[#fff7f8] px-2 py-0.5 text-[11px] font-medium text-[#ff7b83]"
                  >
                    {getCreatorDisplayName(creator)}
                  </span>
                ))}

                {sourcesForRestaurant.map((source) => (
                  <span
                    key={source.id}
                    title={getSourceDisplayName(source)}
                    className="inline-flex max-w-[180px] items-center rounded-full border border-[#eeddb0] bg-[#fff8e8] px-2 py-0.5 text-[11px] font-medium text-[#b7791f]"
                  >
                    <span className="truncate">{getSourceDisplayName(source)}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {selected ? (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => navigate(`/restaurant/${restaurant.id}`)}
            className="inline-flex min-w-[234px] max-w-full items-center justify-center rounded-xl bg-[#ff7b83] px-8 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
          >
            {copy.detailsButton}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function formatDistance(distanceMeters: number, locale: AppLocale) {
  if (distanceMeters < 1000) {
    return locale === "en"
      ? `${Math.round(distanceMeters).toLocaleString()} m`
      : `${Math.round(distanceMeters).toLocaleString()}m`;
  }

  const distanceKm = distanceMeters / 1000;
  const formattedDistance = distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm).toString();
  return locale === "en" ? `${formattedDistance} km` : `${formattedDistance}km`;
}

function TopicNavigation({
  locale,
  selectedTopic,
  variant,
  onSelect,
}: {
  locale: AppLocale;
  selectedTopic: MapTopicShortcut | null;
  variant: "rail" | "strip";
  onSelect: (topic: MapTopicShortcut) => void;
}) {
  const isRail = variant === "rail";

  return (
    <nav
      aria-label={RELATED_TOPICS_LABEL[locale]}
      className={isRail ? "flex h-full min-h-0 flex-col" : "mt-3"}
    >
      {isRail ? (
        <p className="px-3 pb-2 pt-4 text-center text-[10px] font-black uppercase tracking-[0.15em] text-[#a29699]">
          {RELATED_TOPICS_LABEL[locale]}
        </p>
      ) : null}
      <div
        className={
          isRail
            ? "min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-4"
            : "-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        }
      >
        {mapTopicShortcuts.map((topicItem) => {
          const selected = selectedTopic?.slug === topicItem.slug;
          const label = getMapTopicDisplayName(topicItem, locale);

          return (
            <button
              key={topicItem.slug}
              type="button"
              onClick={() => onSelect(topicItem)}
              aria-current={selected ? "page" : undefined}
              title={label}
              className={`group flex flex-shrink-0 flex-col items-center gap-1.5 rounded-2xl border px-2 py-2 text-center transition ${
                isRail ? "w-full" : "w-[68px]"
              } ${
                selected
                  ? "border-[#ffb8c1] bg-[#fff2f4] text-[#ff6071] shadow-[0_8px_20px_rgba(255,123,131,0.12)]"
                  : "border-transparent text-[#6c6164] hover:border-[#f1e3e5] hover:bg-[#fff8f9]"
              }`}
            >
              <span
                className={`overflow-hidden rounded-full border-2 bg-white transition ${
                  selected
                    ? "border-[#ff8f9c]"
                    : "border-white shadow-[0_4px_14px_rgba(31,20,23,0.12)] group-hover:border-[#ffd0d6]"
                } ${isRail ? "h-12 w-12" : "h-11 w-11"}`}
              >
                <img
                  src={topicItem.imageUrl}
                  alt=""
                  width={48}
                  height={48}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </span>
              <span
                className={`line-clamp-2 break-keep font-semibold leading-[1.2] ${
                  isRail ? "text-[11px]" : "text-[10px]"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function SearchMap() {
  const [, navigate] = useLocation();
  const { locale } = useLocale();
  const copy = MAP_COPY[locale];
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const type = params.get("type") || "all";
  const value = params.get("value") || "";
  const topic = params.get("topic") || "";
  const selectedTopicShortcut = useMemo(
    () =>
      mapTopicShortcuts.find(
        (topicItem) => topicItem.type === type && topicItem.value === value
      ) ?? null,
    [type, value]
  );

  const { restaurants: filteredRestaurants, title, description } = useMemo(
    () => filterRestaurants(type, value, topic, locale),
    [locale, topic, type, value]
  );
  const deferredRestaurants = useDeferredValue(filteredRestaurants);

  useSeo({
    title: copy.pageTitle(title),
    description: description || copy.pageDescription(title),
    path: `/map?type=${encodeURIComponent(type)}${
      topic ? `&topic=${encodeURIComponent(topic)}` : ""
    }&value=${encodeURIComponent(value)}`,
    locale,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SearchResultsPage",
      name: copy.pageName(title),
      description: description || copy.pageDescription(title),
    },
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<StoredLocation | null>(() =>
    loadStoredLocation()
  );
  const [isLocating, setIsLocating] = useState(false);
  const [locationFocusRequest, setLocationFocusRequest] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 1023px)").matches
      : false
  );
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false);
  const resultPageSize = isMobileLayout ? 24 : 60;
  const [visibleListCount, setVisibleListCount] = useState(resultPageSize);
  const searchRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listLoadMoreRef = useRef<HTMLDivElement>(null);
  const locationRequestRef = useRef<AbortController | null>(null);
  const hasShownLocationWarningRef = useRef(false);

  const acquireCurrentLocation = useCallback(
    async ({
      feedback = "silent",
      focusMap = false,
    }: {
      feedback?: "silent" | "errors" | "all";
      focusMap?: boolean;
    } = {}) => {
      if (!("geolocation" in navigator)) {
        if (feedback !== "silent") {
          toast.error(copy.locationFailed);
        }
        return null;
      }

      locationRequestRef.current?.abort();
      const controller = new AbortController();
      locationRequestRef.current = controller;
      setIsLocating(true);

      try {
        const location = await requestBestCurrentLocation({ signal: controller.signal });
        saveStoredLocation(location);
        setCurrentLocation(location);
        hasShownLocationWarningRef.current = false;

        if (focusMap) {
          setSelectedId(null);
          setLocationFocusRequest((current) => current + 1);
        }

        if (feedback === "all") {
          toast.success(copy.locationUpdated);
        }

        return location;
      } catch (error) {
        if (error instanceof LocationRequestError && error.code === "aborted") {
          return null;
        }

        const errorCode =
          error instanceof LocationRequestError ? error.code : "unavailable";

        if (errorCode === "permission-denied" || errorCode === "inaccurate") {
          clearStoredLocation();
          setCurrentLocation(null);
        }

        if (
          feedback !== "silent" &&
          (feedback === "all" || !hasShownLocationWarningRef.current)
        ) {
          const message =
            errorCode === "permission-denied"
              ? copy.locationDenied
              : errorCode === "inaccurate"
                ? copy.locationInaccurate
                : copy.locationFailed;
          toast.error(message);
          if (feedback !== "all") {
            hasShownLocationWarningRef.current = true;
          }
        }

        return null;
      } finally {
        if (locationRequestRef.current === controller) {
          locationRequestRef.current = null;
          setIsLocating(false);
        }
      }
    },
    [copy]
  );

  const orderedRestaurants = useMemo(() => {
    if (type !== "nearby") {
      return deferredRestaurants;
    }

    if (!currentLocation) {
      return [];
    }

    return deferredRestaurants
      .filter(
        (restaurant) =>
          !restaurant.isOverseas &&
          restaurant.lat != null &&
          restaurant.lng != null &&
          restaurant.lat !== 0 &&
          restaurant.lng !== 0
      )
      .map((restaurant, index) => ({
        restaurant,
        index,
        distance: getDistanceInMeters(currentLocation, {
          lat: restaurant.lat,
          lng: restaurant.lng,
        }),
      }))
      .sort((left, right) => left.distance - right.distance || left.index - right.index)
      .slice(0, NEARBY_RESTAURANT_LIMIT)
      .map(({ restaurant }) => restaurant);
  }, [currentLocation, deferredRestaurants, type]);

  const domesticRestaurants = useMemo(
    () => orderedRestaurants.filter((restaurant) => !restaurant.isOverseas),
    [orderedRestaurants]
  );
  const listRestaurants = type === "nearby" ? domesticRestaurants : orderedRestaurants;

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const syncLayout = () => {
      setIsMobileLayout(mediaQuery.matches);
    };

    syncLayout();

    if ("addEventListener" in mediaQuery) {
      mediaQuery.addEventListener("change", syncLayout);
      return () => mediaQuery.removeEventListener("change", syncLayout);
    }

    const legacyMediaQuery = mediaQuery as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent | MediaQueryList) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent | MediaQueryList) => void) => void;
    };

    legacyMediaQuery.addListener?.(syncLayout);
    return () => legacyMediaQuery.removeListener?.(syncLayout);
  }, []);

  useEffect(() => {
    if (type === "restaurant" && filteredRestaurants.length === 1) {
      setSelectedId(filteredRestaurants[0].id);
      return;
    }

    setSelectedId((prev) =>
      prev && filteredRestaurants.some((restaurant) => restaurant.id === prev) ? prev : null
    );
  }, [filteredRestaurants, type]);

  useEffect(() => {
    setVisibleListCount(resultPageSize);
    setMobileSheetExpanded(false);
  }, [resultPageSize, type, value]);

  useEffect(() => {
    const root = listRef.current;
    const target = listLoadMoreRef.current;

    if (!root || !target || visibleListCount >= listRestaurants.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          setVisibleListCount((prev) => Math.min(prev + resultPageSize, listRestaurants.length));
        });
      },
      {
        root,
        rootMargin: "160px 0px",
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [listRestaurants.length, resultPageSize, visibleListCount]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }

    return getSearchSuggestions(searchQuery, 8);
  }, [searchQuery]);

  const showSearchDropdown =
    isSearchFocused && searchQuery.trim().length > 0 && searchResults.length > 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const syncStoredLocation = () => {
      setCurrentLocation(loadStoredLocation());
    };

    syncStoredLocation();
    window.addEventListener(LOCATION_UPDATED_EVENT, syncStoredLocation);
    return () => window.removeEventListener(LOCATION_UPDATED_EVENT, syncStoredLocation);
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      return;
    }

    let cancelled = false;

    async function hydrateCurrentLocation() {
      let permissionState: PermissionState | "unknown" = "unknown";

      if ("permissions" in navigator && typeof navigator.permissions.query === "function") {
        try {
          const permission = await navigator.permissions.query({
            name: "geolocation" as PermissionName,
          });
          permissionState = permission.state;
        } catch {
          permissionState = "unknown";
        }
      }

      if (
        cancelled ||
        permissionState === "denied" ||
        (permissionState !== "granted" && type !== "nearby" && !loadStoredLocation())
      ) {
        return;
      }

      await acquireCurrentLocation({
        feedback: type === "nearby" ? "errors" : "silent",
        focusMap: type === "nearby",
      });
    }

    void hydrateCurrentLocation();

    return () => {
      cancelled = true;
      locationRequestRef.current?.abort();
    };
  }, [acquireCurrentLocation, type]);

  const restaurantsForMap = domesticRestaurants;
  const visibleRestaurants = useMemo(
    () => listRestaurants.slice(0, visibleListCount),
    [listRestaurants, visibleListCount]
  );

  const getRestaurantDistance = useCallback(
    (restaurant: Restaurant) => {
      if (
        type !== "nearby" ||
        !currentLocation ||
        restaurant.isOverseas ||
        restaurant.lat == null ||
        restaurant.lng == null ||
        restaurant.lat === 0 ||
        restaurant.lng === 0
      ) {
        return null;
      }

      return getDistanceInMeters(currentLocation, {
        lat: restaurant.lat,
        lng: restaurant.lng,
      });
    },
    [currentLocation, type]
  );

  const nearestRestaurantId = useMemo<string | null>(() => {
    if (!currentLocation) {
      return null;
    }

    const validRestaurants = restaurantsForMap.filter(
      (restaurant) =>
        restaurant.lat != null &&
        restaurant.lng != null &&
        restaurant.lat !== 0 &&
        restaurant.lng !== 0
    );

    let closestRestaurantId: string | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    validRestaurants.forEach((restaurant) => {
      const distance = getDistanceInMeters(currentLocation, {
        lat: restaurant.lat,
        lng: restaurant.lng,
      });

      if (distance < closestDistance) {
        closestRestaurantId = restaurant.id;
        closestDistance = distance;
      }
    });

    return closestRestaurantId;
  }, [currentLocation, restaurantsForMap]);

  const handleMarkerClick = useCallback(
    (id: string) => {
      setSelectedId((prev) => (prev === id ? null : id));
      if (isMobileLayout) {
        setMobileSheetExpanded(false);
      }
    },
    [isMobileLayout]
  );

  const handleRestaurantSelect = useCallback(
    (restaurantId: string) => {
      setSelectedId((prev) => (prev === restaurantId ? null : restaurantId));
      if (isMobileLayout) {
        setMobileSheetExpanded(false);
      }
    },
    [isMobileLayout]
  );

  const handleTopicSelect = useCallback(
    (topicItem: MapTopicShortcut) => {
      setSelectedId(null);
      navigate(getMapTopicPath(topicItem));
    },
    [navigate]
  );

  const handleSearchSelect = (item: SearchResult) => {
    setSearchQuery("");
    setIsSearchFocused(false);

    if (item.type === "query") {
      navigate(`/map?type=query&value=${encodeURIComponent(item.name)}`);
      return;
    }

    if (item.type === "restaurant") {
      navigate(`/map?type=restaurant&value=${encodeURIComponent(item.id)}`);
      return;
    }

    if (item.type === "creator") {
      navigate(`/map?type=creator&value=${encodeURIComponent(item.id)}`);
      return;
    }

    if (item.type === "region") {
      navigate(`/map?type=region&value=${encodeURIComponent(item.name)}`);
      return;
    }

    if (item.type === "food") {
      navigate(`/map?type=food&value=${encodeURIComponent(item.name)}`);
      return;
    }

    if (item.type === "source") {
      navigate(`/map?type=source&value=${encodeURIComponent(item.id)}`);
    }
  };

  const submitMapSearch = () => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      return;
    }

    setSearchQuery("");
    setIsSearchFocused(false);
    navigate(`/map?type=query&value=${encodeURIComponent(trimmedQuery)}`);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHoveredIdx((current) =>
        searchResults.length === 0 ? -1 : Math.min(current + 1, searchResults.length - 1)
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHoveredIdx((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    const selected = hoveredIdx >= 0 ? searchResults[hoveredIdx] : undefined;
    if (selected) {
      handleSearchSelect(selected);
      return;
    }

    submitMapSearch();
  };

  const restaurantsWithCoords = restaurantsForMap.filter(
    (restaurant) => restaurant.lat !== 0 && restaurant.lng !== 0
  );

  const searchControls = (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => navigate("/")}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[#ece7e8] bg-white text-[#666] transition hover:border-[#ffd0d5] hover:bg-[#fff8f9]"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      <div ref={searchRef} className="relative flex-1">
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setHoveredIdx(-1);
          }}
          onFocus={() => setIsSearchFocused(true)}
          onKeyDown={handleSearchKeyDown}
          placeholder={title}
          className="w-full rounded-xl border border-[#ffd4d9] bg-white px-4 py-2.5 pr-11 text-sm text-[#1a1a1a] outline-none transition focus:border-[#ff7b83] focus:shadow-[0_0_0_3px_rgba(255,123,131,0.1)]"
        />
        <button
          type="button"
          onClick={submitMapSearch}
          aria-label={locale === "en" ? "Search" : "검색"}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#9d9698] transition hover:bg-[#fff1f3] hover:text-[#ff6f7c]"
        >
          <Search className="h-4 w-4" />
        </button>

        {showSearchDropdown ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-[#ffd4d9] bg-white shadow-[0_12px_36px_rgba(255,123,131,0.12)]">
            <div className="max-h-[384px] overflow-y-auto">
              {searchResults.map((item, index) => (
                <SearchDropdownItem
                  key={`${item.id}_${index}`}
                  item={item}
                  isHovered={hoveredIdx === index}
                  onHover={() => setHoveredIdx(index)}
                  onLeave={() => setHoveredIdx(-1)}
                  onSelect={() => handleSearchSelect(item)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  const restaurantList = listRestaurants.length > 0 ? (
    <>
      {visibleRestaurants.map((restaurant) => (
        <RestaurantCard
          key={restaurant.id}
          restaurant={restaurant}
          selected={selectedId === restaurant.id}
          distanceMeters={getRestaurantDistance(restaurant)}
          onSelect={() => handleRestaurantSelect(restaurant.id)}
        />
      ))}
      {visibleListCount < listRestaurants.length ? (
        <div
          ref={listLoadMoreRef}
          className="px-4 py-4 text-center text-xs font-medium text-[#9a8f92]"
        >
          {copy.loadMore}
        </div>
      ) : null}
    </>
  ) : type === "nearby" && isLocating ? (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <LoaderCircle className="h-7 w-7 animate-spin text-[#ff7b83]" />
      <p className="mt-4 text-sm font-semibold text-[#333]">{copy.locating}</p>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-4xl">🍽️</p>
      <p className="mt-4 text-sm font-semibold text-[#333]">{copy.noResultsTitle}</p>
      <p className="mt-2 text-xs leading-6 text-[#8a8a8a]">{copy.noResultsDescription}</p>
    </div>
  );

  const resultSummary = (
    <div className="mt-4 rounded-2xl border border-[#f1e7e9] bg-[#fffafa] px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-bold text-[#282426]">{title}</p>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#ff6f7c] shadow-sm">
          {copy.resultCount(listRestaurants.length)}
        </span>
      </div>
      {description ? (
        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#8b7f82]">{description}</p>
      ) : null}
    </div>
  );

  const mapContent = (
    <>
      <NaverMap
        restaurants={restaurantsForMap}
        selectedId={selectedId}
        currentLocation={currentLocation}
        nearestRestaurantId={nearestRestaurantId}
        focusCurrentLocation={type === "nearby"}
        locationFocusRequest={locationFocusRequest}
        onMarkerClick={handleMarkerClick}
      />

      <button
        type="button"
        onClick={() =>
          void acquireCurrentLocation({
            feedback: "all",
            focusMap: true,
          })
        }
        disabled={isLocating}
        aria-label={isLocating ? copy.locating : copy.refreshLocation}
        title={isLocating ? copy.locating : copy.refreshLocation}
        className={`absolute right-3 z-10 flex h-11 w-11 items-center justify-center rounded-xl border border-[#e8e1e3] bg-white text-[#ff6f7c] shadow-[0_8px_24px_rgba(15,23,42,0.16)] transition hover:bg-[#fff6f7] disabled:cursor-wait disabled:opacity-70 ${
          isMobileLayout ? "top-44" : "top-24"
        }`}
      >
        {isLocating ? (
          <LoaderCircle className="h-5 w-5 animate-spin" />
        ) : (
          <LocateFixed className="h-5 w-5" />
        )}
      </button>

      {restaurantsForMap.length > 0 && restaurantsWithCoords.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto rounded-2xl border border-[#f0e5e6] bg-white/96 p-6 text-center shadow-[0_20px_48px_rgba(0,0,0,0.08)] backdrop-blur">
            <p className="text-sm font-semibold text-[#1a1a1a]">{copy.mapReadyTitle}</p>
            <p className="mt-2 text-xs leading-6 text-[#888]">{copy.mapReadyDescription}</p>
          </div>
        </div>
      ) : null}
    </>
  );

  const mobileSheetHeight =
    listRestaurants.length === 0 ? "22dvh" : mobileSheetExpanded ? "74dvh" : "18dvh";

  return (
    <div className="h-[100dvh] overflow-hidden bg-white">
      {isMobileLayout ? (
        <div className="relative h-full overflow-hidden bg-[#f6f6f6]">
          <section className="absolute inset-0">{mapContent}</section>

          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3">
            <div className="pointer-events-auto rounded-[28px] border border-[#f0e5e6] bg-white/96 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.12)] backdrop-blur">
              {searchControls}
              <TopicNavigation
                locale={locale}
                selectedTopic={selectedTopicShortcut}
                variant="strip"
                onSelect={handleTopicSelect}
              />
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-3">
            <div
              className="pointer-events-auto flex flex-col overflow-hidden rounded-[30px] border border-[#f0e5e6] bg-white/98 shadow-[0_-16px_40px_rgba(15,23,42,0.16)] backdrop-blur transition-[height] duration-300 ease-out"
              style={{ height: mobileSheetHeight }}
            >
              <button
                type="button"
                onClick={() => setMobileSheetExpanded((prev) => !prev)}
                aria-label={mobileSheetExpanded ? copy.collapseResults : copy.expandResults}
                className="flex items-center gap-3 border-b border-[#f4edef] px-5 py-3.5 text-left"
              >
                <div className="flex flex-1 flex-col gap-1">
                  <div className="h-1.5 w-12 rounded-full bg-[#eadfe1]" />
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[#1a1a1a]">{title}</p>
                    <span className="shrink-0 text-xs font-bold text-[#ff6f7c]">
                      {copy.resultCount(listRestaurants.length)}
                    </span>
                  </div>
                </div>
                <span className="rounded-full border border-[#f1d8db] bg-[#fff6f7] p-2 text-[#ff7b83]">
                  {mobileSheetExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </span>
              </button>

              <div
                ref={listRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white"
              >
                {restaurantList}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-row overflow-hidden">
          <aside className="flex h-full w-[500px] flex-shrink-0 flex-col border-r border-[#f0f0f0] bg-white">
            <div className="border-b border-[#f0f0f0] p-4">
              {searchControls}
            </div>

            <div className="flex min-h-0 flex-1">
              <div className="h-full w-[126px] flex-shrink-0 border-r border-[#f3edef] bg-[#fffdfd]">
                <TopicNavigation
                  locale={locale}
                  selectedTopic={selectedTopicShortcut}
                  variant="rail"
                  onSelect={handleTopicSelect}
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="px-3 pb-3">{resultSummary}</div>
                <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
                  {restaurantList}
                </div>
              </div>
            </div>
          </aside>

          <section className="relative min-h-0 flex-1 overflow-hidden">{mapContent}</section>
        </div>
      )}
    </div>
  );
}
