import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, MapPin, Search, UtensilsCrossed } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import {
  creators,
  getCreatorsByRestaurant,
  getRecommendationCount,
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
import MonetizationSlot from "@/components/monetization/MonetizationSlot";
import {
  getDistanceInMeters,
  loadStoredLocation,
  LOCATION_UPDATED_EVENT,
  saveStoredLocation,
  type StoredLocation,
} from "@/lib/location";
import { geocodeAddress } from "@/lib/naverMaps";
import {
  getCachedRestaurantCoordinate,
  saveRestaurantCoordinate,
} from "@/lib/restaurantCoordinates";
import { useSeo } from "@/lib/seo";

function filterRestaurants(type: string, value: string): {
  restaurants: Restaurant[];
  title: string;
} {
  switch (type) {
    case "creator": {
      const creator = creators.find((item) => item.id === value || item.name === value);
      if (!creator) {
        return { restaurants: [], title: "검색 결과" };
      }

      return {
        restaurants: getRestaurantsByCreator(creator.id),
        title: `${creator.name} 추천 맛집`,
      };
    }
    case "region":
      return {
        restaurants: restaurants.filter((restaurant) => restaurant.region?.includes(value)),
        title: `${value} 맛집`,
      };
    case "food":
      return {
        restaurants: getRestaurantsByCategory(value),
        title: `${value} 맛집`,
      };
    case "source": {
      const source = getSourceById(value);
      return {
        restaurants: getRestaurantsBySource(value),
        title: source ? `${source.name} 맛집` : "검색 결과",
      };
    }
    case "restaurant": {
      const restaurant = restaurants.find((item) => item.id === value);
      return {
        restaurants: restaurant ? [restaurant] : [],
        title: restaurant?.name ?? "검색 결과",
      };
    }
    default:
      return { restaurants: [...restaurants], title: "전체 맛집" };
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
  let accentLabel = "맛집";
  let detailText = "";

  if (item.type === "creator") {
    accentLabel = item.platform ?? "채널";
    detailText = item.subscribers ?? "";
  } else if (item.type === "region") {
    accentLabel = item.parentRegion ?? "지역";
    detailText = `맛집 ${(item.restaurantCount ?? 0).toLocaleString()}개`;
  } else if (item.type === "food") {
    accentLabel = "음식종류";
    detailText = `맛집 ${(item.restaurantCount ?? 0).toLocaleString()}개`;
  } else if (item.type === "source") {
    accentLabel = item.sourceTypeLabel ?? "소스";
    detailText = `맛집 ${(item.restaurantCount ?? 0).toLocaleString()}개`;
  } else {
    accentLabel = item.category ?? "맛집";
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
          <img
            src={item.image}
            alt={item.name}
            className="h-full w-full object-cover"
          />
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
  const creatorsForRestaurant = getCreatorsByRestaurant(restaurant.id);
  const sourcesForRestaurant = getSourcesByRestaurant(restaurant.id);

  return (
    <div
      className={`border-b border-[#f1f1f1] px-4 py-4 transition-colors ${
        selected ? "bg-[#fff7f1]" : "bg-white hover:bg-[#fafafa]"
      }`}
    >
      <button type="button" onClick={onSelect} className="flex w-full items-start gap-3 text-left">
        <div className="h-20 w-20 overflow-hidden rounded-[18px] bg-[#f3f3f3]">
          {restaurant.imageUrl ? (
            <img
              src={restaurant.imageUrl}
              alt={restaurant.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#d1d1d1]">
              <UtensilsCrossed className="h-7 w-7" />
            </div>
          )}
        </div>

        <div className="pt-1">
          <HeartButton restaurantId={restaurant.id} size="sm" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-bold text-[#ff7b83]">{restaurant.name}</p>
            <span className="text-xs text-[#8c8c8c]">{restaurant.category}</span>
          </div>

          <p className="mt-1 truncate text-xs text-[#666]">{restaurant.address || restaurant.region}</p>
          <p className="mt-2 text-xs text-[#888]">
            {getRestaurantMenuSummary(restaurant) || "메뉴 정보는 아직 준비 중이에요."}
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {creatorsForRestaurant.map((creator) => (
              <span
                key={creator.id}
                className="inline-flex items-center rounded-full border border-[#ffd3d8] bg-[#fff7f8] px-2 py-0.5 text-[11px] font-medium text-[#ff7b83]"
              >
                {creator.name}
              </span>
            ))}

            {sourcesForRestaurant.map((source) => (
              <span
                key={source.id}
                title={source.name}
                className="inline-flex max-w-[180px] items-center rounded-full border border-[#eeddb0] bg-[#fff8e8] px-2 py-0.5 text-[11px] font-medium text-[#b7791f]"
              >
                <span className="truncate">
                  {source.name}
                </span>
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
            className="inline-flex min-w-[234px] items-center justify-center rounded-xl bg-[#ff7b83] px-8 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
          >
            식당 상세 보기
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function SearchMap() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const type = params.get("type") || "all";
  const value = params.get("value") || "";

  const { restaurants: filteredRestaurants, title } = useMemo(
    () => filterRestaurants(type, value),
    [type, value]
  );

  useSeo({
    title: `${title} 지도`,
    description: `${title}과 관련된 맛집을 지도와 리스트로 함께 확인할 수 있는 맛픽 검색 결과 페이지입니다.`,
    path: `/map?type=${encodeURIComponent(type)}&value=${encodeURIComponent(value)}`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SearchResultsPage",
      name: `${title} 지도`,
      description: `${title}과 관련된 맛집 검색 결과 페이지`,
    },
  });

  const domesticRestaurants = useMemo(
    () => filteredRestaurants.filter((restaurant) => !restaurant.isOverseas),
    [filteredRestaurants]
  );
  const overseasCount = useMemo(
    () => filteredRestaurants.filter((restaurant) => restaurant.isOverseas === true).length,
    [filteredRestaurants]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<StoredLocation | null>(() =>
    loadStoredLocation()
  );
  const [resolvedRestaurantCoords, setResolvedRestaurantCoords] = useState<
    Record<string, { lat: number; lng: number }>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const nextCachedCoords: Record<string, { lat: number; lng: number }> = {};

    domesticRestaurants.forEach((restaurant) => {
      const hasOwnCoords =
        restaurant.lat != null &&
        restaurant.lng != null &&
        restaurant.lat !== 0 &&
        restaurant.lng !== 0;

      if (hasOwnCoords) {
        return;
      }

      const cached = getCachedRestaurantCoordinate(restaurant);
      if (cached) {
        nextCachedCoords[restaurant.id] = cached;
      }
    });

    if (Object.keys(nextCachedCoords).length > 0) {
      setResolvedRestaurantCoords((prev) => ({ ...nextCachedCoords, ...prev }));
    }
  }, [domesticRestaurants]);

  useEffect(() => {
    let cancelled = false;

    const unresolvedRestaurants = domesticRestaurants.filter((restaurant) => {
      const hasOwnCoords =
        restaurant.lat != null &&
        restaurant.lng != null &&
        restaurant.lat !== 0 &&
        restaurant.lng !== 0;

      return !hasOwnCoords && Boolean(restaurant.address) && !resolvedRestaurantCoords[restaurant.id];
    });

    if (unresolvedRestaurants.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    async function resolveMissingCoordinates() {
      for (const restaurant of unresolvedRestaurants) {
        try {
          const coords = await geocodeAddress(restaurant.address);
          if (!coords || cancelled) {
            continue;
          }

          saveRestaurantCoordinate(restaurant, coords);
          setResolvedRestaurantCoords((prev) =>
            prev[restaurant.id]
              ? prev
              : {
                  ...prev,
                  [restaurant.id]: coords,
                }
          );
        } catch {
          // Ignore address lookup failures and keep other results available.
        }
      }
    }

    void resolveMissingCoordinates();

    return () => {
      cancelled = true;
    };
  }, [domesticRestaurants, resolvedRestaurantCoords]);

  const restaurantsForMap = useMemo(
    () =>
      domesticRestaurants.map((restaurant) => {
        const resolved = resolvedRestaurantCoords[restaurant.id];
        const hasOwnCoords =
          restaurant.lat != null &&
          restaurant.lng != null &&
          restaurant.lat !== 0 &&
          restaurant.lng !== 0;

        if (hasOwnCoords || !resolved) {
          return restaurant;
        }

        return {
          ...restaurant,
          lat: resolved.lat,
          lng: resolved.lng,
        };
      }),
    [domesticRestaurants, resolvedRestaurantCoords]
  );

  const nearestRestaurant = useMemo<{ restaurant: Restaurant; distanceMeters: number } | null>(() => {
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

    let closestRestaurant: Restaurant | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    validRestaurants.forEach((restaurant) => {
      const distance = getDistanceInMeters(currentLocation, {
        lat: restaurant.lat,
        lng: restaurant.lng,
      });

      if (distance < closestDistance) {
        closestRestaurant = restaurant;
        closestDistance = distance;
      }
    });

    if (!closestRestaurant) {
      return null;
    }

    return {
      restaurant: closestRestaurant,
      distanceMeters: closestDistance,
    };
  }, [currentLocation, restaurantsForMap]);

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

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="flex flex-1 flex-col lg:flex-row lg:overflow-hidden">
        <aside className="flex w-full flex-shrink-0 flex-col border-b border-[#f0f0f0] bg-white lg:w-[390px] lg:border-b-0 lg:border-r">
          <div className="border-b border-[#f0f0f0] p-4">
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

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-bold text-[#ff7b83]">
                {filteredRestaurants.length}개
              </span>
              <span className="text-sm text-[#888]">검색 결과</span>
              {overseasCount > 0 ? (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600">
                  해외 {overseasCount}곳
                </span>
              ) : null}
            </div>

            <div className="mt-4">
              <MonetizationSlot label="Sponsored" />
            </div>
          </div>

          <div className="max-h-[52vh] flex-1 overflow-y-auto lg:max-h-none">
            {filteredRestaurants.length > 0 ? (
              filteredRestaurants.map((restaurant) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  selected={selectedId === restaurant.id}
                  onSelect={() =>
                    setSelectedId((prev) => (prev === restaurant.id ? null : restaurant.id))
                  }
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                <p className="text-4xl">🍽️</p>
                <p className="mt-4 text-sm font-semibold text-[#333]">검색 결과가 없어요.</p>
                <p className="mt-2 text-xs leading-6 text-[#8a8a8a]">
                  다른 키워드나 소스 이름으로 다시 검색해 보세요.
                </p>
              </div>
            )}
          </div>
        </aside>

        <section className="relative min-h-[42vh] flex-1 lg:min-h-0">
          <NaverMap
            restaurants={restaurantsForMap}
            selectedId={selectedId}
            currentLocation={currentLocation}
            nearestRestaurantId={nearestRestaurant?.restaurant.id ?? null}
            onMarkerClick={(id) => setSelectedId((prev) => (prev === id ? null : id))}
          />

          {restaurantsForMap.length > 0 &&
          restaurantsForMap.filter((restaurant) => restaurant.lat !== 0 && restaurant.lng !== 0)
            .length === 0 ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="pointer-events-auto rounded-2xl border border-[#f0e5e6] bg-white/96 p-6 text-center shadow-[0_20px_48px_rgba(0,0,0,0.08)] backdrop-blur">
                <p className="text-sm font-semibold text-[#1a1a1a]">지도 좌표를 준비하고 있어요.</p>
                <p className="mt-2 text-xs leading-6 text-[#888]">
                  주소 기반으로 위치를 찾는 중이라 처음엔 잠깐 비어 보일 수 있어요.
                </p>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
