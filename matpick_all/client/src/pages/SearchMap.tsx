import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  MapPin,
  Search,
  UtensilsCrossed,
} from "lucide-react";
import { useLocation, useSearch } from "wouter";
import {
  creators,
  getCreatorDisplayName,
  getCreatorsByRestaurant,
  getRestaurantBroadcastMeta,
  getRestaurantMenuSummary,
  getRestaurantsByCategory,
  getRestaurantsByCreator,
  getRestaurantsBySource,
  getSourceById,
  getSourcesByRestaurant,
  mockSearchData,
  restaurants,
  type Restaurant,
  type SearchResult,
} from "@/data";
import NaverMap from "@/components/NaverMap";
import HeartButton from "@/components/HeartButton";
import { KakaoAdfitSlot } from "@/components/monetization/MonetizationSlot";
import { useLocale } from "@/contexts/LocaleContext";
import {
  getDistanceInMeters,
  loadStoredLocation,
  LOCATION_UPDATED_EVENT,
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

const MAP_COPY = {
  ko: {
    searchResults: "검색 결과",
    allRestaurants: "전체 맛집",
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
    sponsoredLabel: "Sponsored",
    priceLabel: "대표 가격",
    expandResults: "목록 펼치기",
    collapseResults: "목록 접기",
    pageTitle: (title: string) => `${title} 지도`,
    pageDescription: (title: string) =>
      `${title} 관련 맛집을 지도와 리스트로 한 번에 확인할 수 있는 Matpick 검색 결과 페이지입니다.`,
    pageName: (title: string) => `${title} 지도`,
  },
  en: {
    searchResults: "Search results",
    allRestaurants: "All restaurants",
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
    sponsoredLabel: "Sponsored",
    priceLabel: "From",
    expandResults: "Expand results",
    collapseResults: "Collapse results",
    pageTitle: (title: string) => `${title} map`,
    pageDescription: (title: string) =>
      `Browse ${title} restaurants on the map and in the list view on Matpick.`,
    pageName: (title: string) => `${title} map`,
  },
} as const;

function filterRestaurants(
  type: string,
  value: string,
  locale: AppLocale
): {
  restaurants: Restaurant[];
  title: string;
} {
  const copy = MAP_COPY[locale];
  const isEnglish = locale === "en";

  switch (type) {
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
    case "region":
      return {
        restaurants: restaurants.filter((restaurant) => restaurant.region?.includes(value)),
        title: copy.regionRestaurants(value),
      };
    case "food":
      return {
        restaurants: getRestaurantsByCategory(value),
        title: copy.cuisineRestaurants(
          isEnglish ? translateCuisineLabel(value, "en") : value
        ),
      };
    case "source": {
      const source = getSourceById(value);
      return {
        restaurants: getRestaurantsBySource(value),
        title: source ? copy.sourceRestaurants(source.name) : copy.searchResults,
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

  if (item.type === "creator") {
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
    accentLabel = item.category
      ? translateCuisineLabel(item.category, locale)
      : copy.searchResults;
    detailText = item.address ?? "";
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
  onSelect,
}: {
  restaurant: Restaurant;
  selected: boolean;
  onSelect: () => void;
}) {
  const [, navigate] = useLocation();
  const { locale } = useLocale();
  const copy = MAP_COPY[locale];
  const creatorsForRestaurant = getCreatorsByRestaurant(restaurant.id);
  const sourcesForRestaurant = getSourcesByRestaurant(restaurant.id);
  const displayImage = getRestaurantDisplayImage(restaurant, { width: 320, height: 320 });
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
      <button type="button" onClick={onSelect} className="flex w-full items-start gap-3 text-left">
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

          <div className="mt-2 flex flex-wrap gap-1.5">
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
                title={source.name}
                className="inline-flex max-w-[180px] items-center rounded-full border border-[#eeddb0] bg-[#fff8e8] px-2 py-0.5 text-[11px] font-medium text-[#b7791f]"
              >
                <span className="truncate">{source.name}</span>
              </span>
            ))}
          </div>
        </div>
      </button>

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

export default function SearchMap() {
  const [, navigate] = useLocation();
  const { locale } = useLocale();
  const copy = MAP_COPY[locale];
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const type = params.get("type") || "all";
  const value = params.get("value") || "";

  const { restaurants: filteredRestaurants, title } = useMemo(
    () => filterRestaurants(type, value, locale),
    [locale, type, value]
  );
  const deferredRestaurants = useDeferredValue(filteredRestaurants);

  useSeo({
    title: copy.pageTitle(title),
    description: copy.pageDescription(title),
    path: `/map?type=${encodeURIComponent(type)}&value=${encodeURIComponent(value)}`,
    locale,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SearchResultsPage",
      name: copy.pageName(title),
      description: copy.pageDescription(title),
    },
  });

  const domesticRestaurants = useMemo(
    () => deferredRestaurants.filter((restaurant) => !restaurant.isOverseas),
    [deferredRestaurants]
  );
  const overseasCount = useMemo(
    () => filteredRestaurants.filter((restaurant) => restaurant.isOverseas === true).length,
    [filteredRestaurants]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<StoredLocation | null>(() =>
    loadStoredLocation()
  );
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

    if (!root || !target || visibleListCount >= deferredRestaurants.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          setVisibleListCount((prev) => Math.min(prev + resultPageSize, deferredRestaurants.length));
        });
      },
      {
        root,
        rootMargin: "160px 0px",
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [deferredRestaurants.length, resultPageSize, visibleListCount]);

  const searchResults = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    return mockSearchData
      .filter((item) => {
        const fields = [
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

        return fields.includes(normalized);
      })
      .slice(0, 8);
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
      let permissionState: PermissionState | "prompt" = "prompt";

      if ("permissions" in navigator && typeof navigator.permissions.query === "function") {
        try {
          const permission = await navigator.permissions.query({
            name: "geolocation" as PermissionName,
          });
          permissionState = permission.state;
        } catch {
          permissionState = "prompt";
        }
      }

      if (permissionState !== "granted" || cancelled) {
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (cancelled) {
            return;
          }

          const nextLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          saveStoredLocation(nextLocation);
          setCurrentLocation({
            ...nextLocation,
            updatedAt: Date.now(),
          });
        },
        () => {},
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    }

    void hydrateCurrentLocation();

    return () => {
      cancelled = true;
    };
  }, []);

  const restaurantsForMap = domesticRestaurants;
  const visibleRestaurants = useMemo(
    () => deferredRestaurants.slice(0, visibleListCount),
    [deferredRestaurants, visibleListCount]
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

  const handleSearchSelect = (item: SearchResult) => {
    setSearchQuery("");
    setIsSearchFocused(false);

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

  const restaurantsWithCoords = restaurantsForMap.filter(
    (restaurant) => restaurant.lat !== 0 && restaurant.lng !== 0
  );

  const searchControls = (
    <div className="mb-3 flex items-center gap-3">
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
          placeholder={title}
          className="w-full rounded-xl border border-[#ffd4d9] bg-white px-4 py-2.5 pr-11 text-sm text-[#1a1a1a] outline-none transition focus:border-[#ff7b83] focus:shadow-[0_0_0_3px_rgba(255,123,131,0.1)]"
        />
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b4b4b4]" />

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

  const resultSummary = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-lg font-bold text-[#ff7b83]">
        {copy.resultCount(filteredRestaurants.length)}
      </span>
      {overseasCount > 0 ? (
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600">
          {copy.overseasCount(overseasCount)}
        </span>
      ) : null}
    </div>
  );

  const restaurantList = deferredRestaurants.length > 0 ? (
    <>
      {visibleRestaurants.map((restaurant) => (
        <RestaurantCard
          key={restaurant.id}
          restaurant={restaurant}
          selected={selectedId === restaurant.id}
          onSelect={() => handleRestaurantSelect(restaurant.id)}
        />
      ))}
      {visibleListCount < deferredRestaurants.length ? (
        <div
          ref={listLoadMoreRef}
          className="px-4 py-4 text-center text-xs font-medium text-[#9a8f92]"
        >
          {copy.loadMore}
        </div>
      ) : null}
    </>
  ) : (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-4xl">🍽️</p>
      <p className="mt-4 text-sm font-semibold text-[#333]">{copy.noResultsTitle}</p>
      <p className="mt-2 text-xs leading-6 text-[#8a8a8a]">{copy.noResultsDescription}</p>
    </div>
  );

  const mapContent = (
    <>
      <NaverMap
        restaurants={restaurantsForMap}
        selectedId={selectedId}
        currentLocation={currentLocation}
        nearestRestaurantId={nearestRestaurantId}
        onMarkerClick={handleMarkerClick}
      />

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
    deferredRestaurants.length === 0 ? "26dvh" : mobileSheetExpanded ? "74dvh" : "34dvh";

  return (
    <div className="h-[100dvh] overflow-hidden bg-white">
      {isMobileLayout ? (
        <div className="relative h-full overflow-hidden bg-[#f6f6f6]">
          <section className="absolute inset-0">{mapContent}</section>

          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3">
            <div className="pointer-events-auto rounded-[28px] border border-[#f0e5e6] bg-white/96 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.12)] backdrop-blur">
              {searchControls}
              {resultSummary}
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
                  <p className="text-sm font-semibold text-[#1a1a1a]">{title}</p>
                  <p className="text-xs text-[#8d8587]">
                    {copy.resultCount(filteredRestaurants.length)}
                  </p>
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
          <aside className="flex h-full w-[390px] flex-shrink-0 flex-col border-r border-[#f0f0f0] bg-white">
            <div className="border-b border-[#f0f0f0] p-4">
              {searchControls}
              {resultSummary}

              <div className="mt-4">
                <KakaoAdfitSlot label={copy.sponsoredLabel} />
              </div>
            </div>

            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
              {restaurantList}
            </div>
          </aside>

          <section className="relative min-h-0 flex-1 overflow-hidden">{mapContent}</section>
        </div>
      )}
    </div>
  );
}
