import {
  getTopicFilterPath,
  isComposingSearch,
  readMapView,
  withMapView,
} from "@/lib/mapNavigation";
import RecommendationCard from "@/components/RecommendationCard";
import { KakaoAdfitSlot } from "@/components/monetization/MonetizationSlot";
import {
  findNearbyRecommendations,
  sortRestaurantsByDistance,
} from "@/lib/nearbyRecommendations";
import { useTravelTimes } from "@/hooks/useTravelTimes";
import {
  isRestaurantRecommendable,
  hasUsableCoordinates,
} from "@/lib/restaurantEligibility";
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
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";
import {
  creators,
  getCreatorDisplayName,
  getRestaurantById,
  getRestaurantSearchResults,
  getDiscoveryTopicBySlug,
  getDiscoveryTopicEpisodeBySlug,
  getRestaurantsByCreator,
  getRestaurantsBySource,
  getSearchSuggestions,
  getSourceById,
  getSourceDisplayName,
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
  mapTopicShortcuts,
} from "@/data/mapTopicShortcuts";
import NaverMap from "@/components/NaverMap";
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
import { useSeo } from "@/lib/seo";

const MAP_COPY = {
  ko: {
    searchResults: "검색 결과",
    allRestaurants: "전체 맛집",
    nearbyRestaurants: "내 주변 유명 맛집",
    nearbyDescription:
      "가까운 식당부터 소개 근거를 확인하고 바로 길찾기로 이어가세요.",
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
    locationFailed:
      "현재 위치를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
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
      "Start with nearby places, check why they are featured, and get directions.",
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
    locationDenied:
      "Location access is blocked. Allow it in your browser settings.",
    locationInaccurate:
      "A precise location was unavailable. Enable precise location for this browser in your phone settings and try again.",
    locationFailed:
      "Your current location could not be determined. Please try again.",
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
        restaurants: restaurants.filter(restaurant =>
          episodeRestaurantIds.has(restaurant.id)
        ),
        title: `${topic.name} ${episode.episode}`,
        description: episode.description,
      };
    }
    case "creator": {
      const creator = creators.find(
        item => item.id === value || item.name === value
      );
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
    case "query": {
      const result = getRestaurantSearchResults(value);
      return {
        restaurants: result.matches.map(match => match.restaurant),
        title: isEnglish ? `Results for “${value}”` : `“${value}” 관련 맛집`,
        description: result.expandedArea
          ? isEnglish
            ? `Broadened to addresses in ${result.expandedArea}. Check each address before choosing.`
            : `‘${result.expandedArea}’ 지역으로 넓혀 찾았어요. 식당 주소를 확인해 주세요.`
          : undefined,
      };
    }
    case "region":
      return {
        restaurants: searchRestaurants(value)
          .filter(match => match.matchTypes.includes("location"))
          .map(match => match.restaurant),
        title: copy.regionRestaurants(value),
      };
    case "food":
      return {
        restaurants: searchRestaurants(value)
          .filter(match =>
            match.matchTypes.some(
              type => type === "menu" || type === "category"
            )
          )
          .map(match => match.restaurant),
        title: copy.cuisineRestaurants(
          isEnglish ? translateCuisineLabel(value, "en") : value
        ),
      };
    case "source": {
      const source = getSourceById(value);
      return {
        restaurants: getRestaurantsBySource(value),
        title: source
          ? copy.sourceRestaurants(getSourceDisplayName(source))
          : copy.searchResults,
      };
    }
    case "restaurant": {
      const restaurant = getRestaurantById(value);
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
    detailText =
      item.matchedText ?? copy.resultCount(item.restaurantCount ?? 0);
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
    accentLabel =
      item.matchLabel ??
      (item.category
        ? translateCuisineLabel(item.category, locale)
        : copy.searchResults);
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
          <img
            src={item.image}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : item.type === "region" ? (
          <MapPin className="h-5 w-5 text-[#777]" />
        ) : item.type === "query" ? (
          <Search className="h-5 w-5 text-[#ff7b83]" />
        ) : (
          <UtensilsCrossed className="h-5 w-5 text-[#ff7b83]" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#1a1a1a]">
          {item.name}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className="shrink-0 font-semibold text-[#ff7b83]">
            {accentLabel}
          </span>
          <span className="truncate text-[#888]">{detailText}</span>
        </div>
      </div>
    </button>
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
  const sourceFilter = params.get("source") || "";
  const queryLabel = ["query", "region", "food"].includes(type) ? value : "";
  const selectedTopicShortcut = useMemo(
    () =>
      mapTopicShortcuts.find(topicItem =>
        sourceFilter
          ? topicItem.value === sourceFilter
          : topicItem.type === type && topicItem.value === value
      ) ?? null,
    [sourceFilter, type, value]
  );

  const {
    restaurants: filteredRestaurants,
    title,
    description,
  } = useMemo(
    () => filterRestaurants(type, value, topic, locale),
    [locale, topic, type, value]
  );
  const eligibleRestaurants = useMemo(() => {
    const sourceIds = sourceFilter
      ? new Set(getRestaurantsBySource(sourceFilter).map(item => item.id))
      : null;
    return filteredRestaurants.filter(
      item =>
        isRestaurantRecommendable(item) &&
        (!sourceIds || sourceIds.has(item.id))
    );
  }, [filteredRestaurants, sourceFilter]);
  const deferredRestaurants = useDeferredValue(eligibleRestaurants);

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

  const [selectedId, setSelectedId] = useState<string | null>(
    () => readMapView(searchString).selectedId
  );
  const [currentLocation, setCurrentLocation] = useState<StoredLocation | null>(
    () => loadStoredLocation()
  );
  const [isLocating, setIsLocating] = useState(false);
  const [locationFocusRequest, setLocationFocusRequest] = useState(0);
  const [searchQuery, setSearchQuery] = useState(queryLabel);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 1023px)").matches
      : false
  );
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false);
  const resultPageSize = 6;
  const [visibleListCount, setVisibleListCount] = useState(
    () => readMapView(searchString).visibleCount
  );
  const searchRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
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
        const location = await requestBestCurrentLocation({
          signal: controller.signal,
        });
        saveStoredLocation(location);
        setCurrentLocation(location);
        hasShownLocationWarningRef.current = false;

        if (focusMap) {
          setSelectedId(null);
          setLocationFocusRequest(current => current + 1);
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

  const nearbyResults = useMemo(
    () =>
      currentLocation
        ? findNearbyRecommendations(
            deferredRestaurants,
            currentLocation,
            visibleListCount
          )
        : { restaurants: [], totalCount: 0, radiusMeters: 0, expanded: false },
    [currentLocation, deferredRestaurants, visibleListCount]
  );
  const sortedMatches = useMemo(
    () => sortRestaurantsByDistance(deferredRestaurants, currentLocation),
    [deferredRestaurants, currentLocation]
  );
  const orderedRestaurants =
    type === "nearby" ? nearbyResults.restaurants : sortedMatches;

  const domesticRestaurants = useMemo(
    () => orderedRestaurants.filter(restaurant => !restaurant.isOverseas),
    [orderedRestaurants]
  );
  const listRestaurants =
    type === "nearby" ? domesticRestaurants : orderedRestaurants;
  const totalAvailable =
    type === "nearby" ? nearbyResults.totalCount : listRestaurants.length;

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
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
      addListener?: (
        listener: (event: MediaQueryListEvent | MediaQueryList) => void
      ) => void;
      removeListener?: (
        listener: (event: MediaQueryListEvent | MediaQueryList) => void
      ) => void;
    };

    legacyMediaQuery.addListener?.(syncLayout);
    return () => legacyMediaQuery.removeListener?.(syncLayout);
  }, []);

  useEffect(() => {
    if (type === "restaurant" && filteredRestaurants.length === 1) {
      setSelectedId(filteredRestaurants[0].id);
      return;
    }

    setSelectedId(prev =>
      prev && filteredRestaurants.some(restaurant => restaurant.id === prev)
        ? prev
        : null
    );
  }, [filteredRestaurants, type]);

  useEffect(() => {
    const view = readMapView(searchString);
    setVisibleListCount(view.visibleCount);
    setSelectedId(
      view.selectedId ??
        (type === "restaurant" ? (getRestaurantById(value)?.id ?? null) : null)
    );
  }, [searchString, type, value]);

  useEffect(() => {
    setSearchQuery(queryLabel);
    setIsSearchFocused(false);
    setMobileSheetExpanded(false);
    listRef.current?.scrollTo({ top: 0 });
  }, [queryLabel, type, value, topic, sourceFilter]);

  useEffect(() => {
    if (!selectedId) return;
    const index = listRestaurants.findIndex(item => item.id === selectedId);
    if (index < 0) return;
    if (index >= visibleListCount) {
      setVisibleListCount(
        Math.ceil((index + 1) / resultPageSize) * resultPageSize
      );
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const list = listRef.current;
      const card = list?.querySelector<HTMLElement>(
        `[data-restaurant-id="${CSS.escape(selectedId)}"]`
      );
      if (list && card)
        list.scrollTo({
          top:
            list.scrollTop +
            card.getBoundingClientRect().top -
            list.getBoundingClientRect().top -
            8,
        });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedId, visibleListCount, listRestaurants, resultPageSize]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }

    return getSearchSuggestions(searchQuery, 8);
  }, [searchQuery]);

  const showSearchDropdown =
    isSearchFocused &&
    searchQuery.trim().length > 0 &&
    searchResults.length > 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
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
    return () =>
      window.removeEventListener(LOCATION_UPDATED_EVENT, syncStoredLocation);
  }, []);

  useEffect(() => {
    if (loadStoredLocation() || !("geolocation" in navigator)) return;

    let cancelled = false;

    async function hydrateCurrentLocation() {
      let permissionState: PermissionState | "unknown" = "unknown";

      if (
        "permissions" in navigator &&
        typeof navigator.permissions.query === "function"
      ) {
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
        (permissionState !== "granted" &&
          type !== "nearby" &&
          !loadStoredLocation())
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
  const travelTimes = useTravelTimes(
    visibleRestaurants,
    currentLocation,
    currentLocation?.updatedAt ?? 0
  );

  const getRestaurantDistance = useCallback(
    (restaurant: Restaurant) => {
      if (
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
    [currentLocation]
  );

  const nearestRestaurantId = useMemo<string | null>(() => {
    if (!currentLocation) {
      return null;
    }

    const validRestaurants = restaurantsForMap.filter(
      restaurant =>
        restaurant.lat != null &&
        restaurant.lng != null &&
        restaurant.lat !== 0 &&
        restaurant.lng !== 0
    );

    let closestRestaurantId: string | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    validRestaurants.forEach(restaurant => {
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

  const selectRestaurant = useCallback(
    (id: string) => {
      const nextId = selectedId === id ? null : id;
      const index = listRestaurants.findIndex(item => item.id === id);
      const shown = Math.max(
        visibleListCount,
        Math.ceil((index + 1) / resultPageSize) * resultPageSize
      );
      setSelectedId(nextId);
      setVisibleListCount(shown);
      setMobileSheetExpanded(false);
      navigate(withMapView(searchString, nextId, shown), { replace: true });
    },
    [selectedId, listRestaurants, visibleListCount, searchString, navigate]
  );

  const handleSearchSelect = (item: SearchResult) => {
    setIsSearchFocused(false);
    searchRef.current?.querySelector("input")?.blur();

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

    setIsSearchFocused(false);
    searchRef.current?.querySelector("input")?.blur();
    navigate(`/map?type=query&value=${encodeURIComponent(trimmedQuery)}`);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (isComposingSearch(event.nativeEvent)) return;
    if (event.key === "Escape") {
      setIsSearchFocused(false);
      setHoveredIdx(-1);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHoveredIdx(current =>
        searchResults.length === 0
          ? -1
          : Math.min(current + 1, searchResults.length - 1)
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHoveredIdx(current => Math.max(current - 1, 0));
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

  const restaurantsWithCoords = restaurantsForMap.filter(restaurant =>
    hasUsableCoordinates(restaurant)
  );

  const searchControls = (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => navigate("/")}
        aria-label={locale === "en" ? "Home" : "홈으로"}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[#ece7e8] bg-white text-[#666] transition hover:border-[#ffd0d5] hover:bg-[#fff8f9]"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      <div ref={searchRef} className="relative flex-1">
        <input
          type="text"
          value={searchQuery}
          onChange={event => {
            setSearchQuery(event.target.value);
            setHoveredIdx(-1);
          }}
          onFocus={() => setIsSearchFocused(true)}
          onKeyDown={handleSearchKeyDown}
          placeholder={
            locale === "en"
              ? "Area, station, food or restaurant"
              : "동네·역·음식·식당명 검색"
          }
          aria-label={locale === "en" ? "Search restaurants" : "식당 검색"}
          autoComplete="off"
          enterKeyHint="search"
          className="w-full rounded-xl border border-[#ffd4d9] bg-white px-4 py-3 pr-24 text-base text-[#1a1a1a] outline-none transition focus:border-[#ff7b83] focus:shadow-[0_0_0_3px_rgba(255,123,131,0.1)]"
        />
        {searchQuery && (
          <button
            type="button"
            aria-label={locale === "en" ? "Clear search" : "검색어 지우기"}
            onClick={() => {
              setSearchQuery("");
              setHoveredIdx(-1);
              searchRef.current?.querySelector("input")?.focus();
            }}
            className="absolute right-12 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-[#82787d]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={submitMapSearch}
          aria-label={locale === "en" ? "Search" : "검색"}
          disabled={!searchQuery.trim()}
          className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-[#9d9698] transition hover:bg-[#fff1f3] hover:text-[#ff6f7c]"
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

  const restaurantList =
    listRestaurants.length > 0 ? (
      <>
        {visibleRestaurants.map((restaurant, index) => (
          <RecommendationCard
            rank={index + 1}
            key={restaurant.id}
            restaurant={restaurant}
            selected={selectedId === restaurant.id}
            distanceMeters={getRestaurantDistance(restaurant)}
            origin={currentLocation}
            travel={travelTimes.values[restaurant.id]}
            travelLoading={
              !travelTimes.values[restaurant.id] && travelTimes.loading
            }
            onSelect={() => selectRestaurant(restaurant.id)}
          />
        ))}
        {visibleListCount < totalAvailable ? (
          <div className="p-4">
            <button
              type="button"
              onClick={() => {
                const shown = Math.min(
                  visibleListCount + resultPageSize,
                  totalAvailable
                );
                setVisibleListCount(shown);
                navigate(withMapView(searchString, selectedId, shown), {
                  replace: true,
                });
              }}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#f1becb] bg-[#fff5f8] px-4 py-3 text-center text-sm font-bold text-[#c24d63] hover:bg-[#ffe9f0]"
            >
              <ChevronDown className="h-4 w-4" />
              {locale === "en"
                ? `Show ${Math.min(resultPageSize, totalAvailable - visibleListCount)} more places`
                : `맛집 ${Math.min(resultPageSize, totalAvailable - visibleListCount)}곳 더 보기`}
            </button>
            {type === "nearby" &&
              visibleListCount >= listRestaurants.length && (
                <p className="mt-2 text-center text-xs text-[#88737d]">
                  {locale === "en"
                    ? "Expand the area to find more nearby places"
                    : "주변 범위를 넓혀 가까운 식당부터 더 찾아드려요"}
                </p>
              )}
          </div>
        ) : null}
      </>
    ) : type === "nearby" && !currentLocation && !isLocating ? (
      <div className="px-6 py-10 text-center">
        <p className="text-sm font-semibold">
          {locale === "en"
            ? "Choose an area to see nearby places"
            : "동네를 정하면 주변 식당을 추천해 드려요"}
        </p>
        <p className="mt-2 text-xs leading-6 text-[#82787d]">
          {locale === "en"
            ? "Location access is optional. Search for a neighborhood or station above."
            : "위치 권한 없이도 위 검색창에 동네나 역 이름을 입력할 수 있어요."}
        </p>
        <button
          type="button"
          onClick={() => searchRef.current?.querySelector("input")?.focus()}
          className="mt-4 rounded-xl border border-[#ffd4d9] px-4 py-3 text-sm font-semibold"
        >
          {locale === "en" ? "Enter an area" : "동네·역 입력하기"}
        </button>
      </div>
    ) : type === "nearby" && isLocating ? (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <LoaderCircle className="h-7 w-7 animate-spin text-[#ff7b83]" />
        <p className="mt-4 text-sm font-semibold text-[#333]">
          {copy.locating}
        </p>
      </div>
    ) : (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <p className="text-4xl">🍽️</p>
        <p className="mt-4 text-sm font-semibold text-[#333]">
          {copy.noResultsTitle}
        </p>
        <p className="mt-2 text-xs leading-6 text-[#8a8a8a]">
          {sourceFilter
            ? locale === "en"
              ? "Try removing the source filter in this area."
              : "이 지역에서는 선택한 방송의 식당을 찾지 못했어요."
            : copy.noResultsDescription}
        </p>
        <button
          type="button"
          className="mt-4 min-h-11 rounded-xl border border-[#ffd4d9] px-4 text-sm font-semibold"
          onClick={() =>
            sourceFilter
              ? navigate(getTopicFilterPath(searchString, null))
              : searchRef.current?.querySelector("input")?.focus()
          }
        >
          {sourceFilter
            ? locale === "en"
              ? "Show all sources here"
              : "이 지역 전체 후보 보기"
            : locale === "en"
              ? "Edit search"
              : "검색어 바꾸기"}
        </button>
      </div>
    );

  const activeFilter = selectedTopicShortcut && (
    <button
      type="button"
      onClick={() => navigate(getTopicFilterPath(searchString, null))}
      className="flex min-h-11 items-center gap-2 px-4 py-2 text-xs font-semibold text-[#a34155]"
      aria-label={locale === "en" ? "Remove source filter" : "방송 필터 해제"}
    >
      {getMapTopicDisplayName(selectedTopicShortcut, locale)}{" "}
      <X className="h-3.5 w-3.5" />
    </button>
  );

  const locationSummary = (
    <div className="flex flex-wrap items-center justify-between gap-x-2 border-b border-[#f2e9ed] px-4 py-1 text-[11px] text-[#88737d]">
      <span>
        {currentLocation
          ? locale === "en"
            ? "Nearest first · straight-line distance"
            : "내 위치에서 가까운 순 · 직선거리 기준"
          : locale === "en"
            ? `Showing ${Math.min(visibleListCount, listRestaurants.length)} places`
            : `검색 결과 ${Math.min(visibleListCount, listRestaurants.length)}곳 표시`}
      </span>
      <button
        type="button"
        disabled={isLocating}
        onClick={() => void acquireCurrentLocation({ feedback: "all" })}
        className="inline-flex min-h-11 items-center gap-1 font-semibold text-[#b64765] disabled:opacity-50"
      >
        <LocateFixed className="h-3.5 w-3.5" />
        {isLocating
          ? copy.locating
          : currentLocation
            ? locale === "en"
              ? "Refresh location"
              : "위치 새로고침"
            : locale === "en"
              ? "Distances from my location"
              : "내 위치로 거리·시간 보기"}
      </button>
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
      {type === "nearby" && currentLocation && nearbyResults.expanded && (
        <p className="mt-2 text-xs leading-5 text-[#956624]">
          {locale === "en"
            ? `Expanded to ${Math.round(nearbyResults.radiusMeters / 1000)} km to find nearby candidates. Distances are straight-line.`
            : `가까운 후보를 찾기 위해 ${Math.round(nearbyResults.radiusMeters / 1000)}km 범위로 넓혔어요. 거리는 직선 기준입니다.`}
        </p>
      )}
      {description ? (
        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#8b7f82]">
          {description}
        </p>
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
        onMarkerClick={selectRestaurant}
      />

      <button
        type="button"
        onClick={() =>
          void acquireCurrentLocation({
            feedback: "all",
            focusMap: type === "nearby",
          })
        }
        disabled={isLocating}
        aria-label={isLocating ? copy.locating : copy.refreshLocation}
        title={isLocating ? copy.locating : copy.refreshLocation}
        className={`absolute right-3 z-10 flex h-11 w-11 items-center justify-center rounded-xl border border-[#e8e1e3] bg-white text-[#ff6f7c] shadow-[0_8px_24px_rgba(15,23,42,0.16)] transition hover:bg-[#fff6f7] disabled:cursor-wait disabled:opacity-70 ${
          isMobileLayout ? "top-48" : "top-24"
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
            <p className="text-sm font-semibold text-[#1a1a1a]">
              {copy.mapReadyTitle}
            </p>
            <p className="mt-2 text-xs leading-6 text-[#888]">
              {copy.mapReadyDescription}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );

  const mobileSheetHeight = mobileSheetExpanded ? "74dvh" : "43dvh";

  return (
    <div className="h-[100dvh] overflow-hidden bg-white">
      {isMobileLayout ? (
        <div className="relative h-full overflow-hidden bg-[#f6f6f6]">
          <section className="absolute inset-0">{mapContent}</section>

          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3">
            <div className="pointer-events-auto rounded-[28px] border border-[#f0e5e6] bg-white/96 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.12)] backdrop-blur">
              {searchControls}
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-3">
            <div
              className="pointer-events-auto flex flex-col overflow-hidden rounded-[30px] border border-[#f0e5e6] bg-white/98 shadow-[0_-16px_40px_rgba(15,23,42,0.16)] backdrop-blur transition-[height] duration-300 ease-out"
              style={{ height: mobileSheetHeight }}
            >
              <button
                type="button"
                onClick={() => setMobileSheetExpanded(prev => !prev)}
                aria-label={
                  mobileSheetExpanded
                    ? copy.collapseResults
                    : copy.expandResults
                }
                className="flex items-center gap-3 border-b border-[#f4edef] px-5 py-3.5 text-left"
              >
                <div className="flex flex-1 flex-col gap-1">
                  <div className="h-1.5 w-12 rounded-full bg-[#eadfe1]" />
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[#1a1a1a]">
                      {title}
                    </p>
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

              {activeFilter}
              {locationSummary}
              {type === "query" && description && (
                <p
                  role="status"
                  className="px-4 py-2 text-xs leading-5 text-[#956624]"
                >
                  {description}
                </p>
              )}
              <div
                ref={listRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white"
              >
                <KakaoAdfitSlot
                  label={locale === "en" ? "Advertisement" : "광고"}
                  compact
                />
                {type === "nearby" && nearbyResults.expanded && (
                  <p className="px-4 pt-3 text-xs text-[#956624]">
                    {locale === "en"
                      ? `Expanded search: ${Math.round(nearbyResults.radiusMeters / 1000)} km`
                      : `가까운 후보를 찾기 위해 ${Math.round(nearbyResults.radiusMeters / 1000)}km 범위로 넓혔어요`}
                  </p>
                )}
                {restaurantList}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-row overflow-hidden">
          <aside className="flex h-full w-[420px] flex-shrink-0 flex-col border-r border-[#f0f0f0] bg-white">
            <div className="border-b border-[#f0f0f0] p-4">
              {searchControls}
            </div>

            <div className="flex min-h-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="px-3 pb-3">
                  {resultSummary}
                  {activeFilter}
                </div>
                {locationSummary}
                <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
                  <KakaoAdfitSlot
                    label={locale === "en" ? "Advertisement" : "광고"}
                    compact
                  />
                  {restaurantList}
                </div>
              </div>
            </div>
          </aside>

          <section className="relative min-h-0 flex-1 overflow-hidden">
            {mapContent}
          </section>
        </div>
      )}
    </div>
  );
}
