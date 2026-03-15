import { useEffect, useMemo, useState } from "react";
import { Compass, Search } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import {
  creators,
  getBroadRegion,
  getCuisineCategories,
  getCuisineCategory,
  getCreatorsByRestaurant,
  getRecommendationCount,
  getRegions,
  getRestaurantMenuSummary,
  getRestaurantsByCreator,
  getRestaurantsBySource,
  getSourceRestaurantCount,
  getSourcesByRestaurant,
  restaurants,
  sources,
  type Restaurant,
} from "@/data";
import HeartButton from "@/components/HeartButton";

const ALL_FILTER = "all";
const FALLBACK_RESTAURANT_IMAGE =
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=400&fit=crop";

type DiscoveryKind = "creator" | "source";

type DiscoveryOption = {
  key: string;
  id: string;
  kind: DiscoveryKind;
  name: string;
  imageUrl?: string;
  count: number;
};

function sortText(a: string, b: string) {
  return a.localeCompare(b, "ko-KR");
}

function buildDiscoveryKey(kind: DiscoveryKind, id: string) {
  return `${kind}:${id}`;
}

function DiscoveryChip({
  option,
  selected,
  onClick,
}: {
  option: DiscoveryOption | null;
  selected: boolean;
  onClick: () => void;
}) {
  const label = option?.name ?? "전체";

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`group flex h-12 items-center gap-2.5 rounded-full border px-4 text-sm font-semibold transition-all ${
        selected
          ? "border-[#FD7979] bg-[#fff7f8] text-[#FD7979] shadow-[0_10px_24px_rgba(253,121,121,0.16)]"
          : "border-[#ece7e8] bg-white text-[#555] hover:border-[#ffd0d5] hover:bg-[#fff8f9]"
      }`}
    >
      {option?.imageUrl ? (
        <img
          src={option.imageUrl}
          alt={option.name}
          className="h-7 w-7 rounded-full border border-[#f1d8dc] object-cover"
        />
      ) : (
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
            selected ? "bg-[#FD7979] text-white" : "bg-[#f5f5f5] text-[#999]"
          }`}
        >
          {option ? "#" : "All"}
        </span>
      )}
      <span className="max-w-[128px] truncate">{label}</span>
    </button>
  );
}

function FilterChip({
  label,
  selected,
  onClick,
  tone = "pink",
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  tone?: "pink" | "peach";
}) {
  const activeClasses =
    tone === "pink"
      ? "bg-[#FD7979] text-white shadow-[0_8px_18px_rgba(253,121,121,0.24)]"
      : "bg-[#FDACAC] text-white shadow-[0_8px_18px_rgba(253,172,172,0.24)]";

  const idleClasses =
    tone === "pink"
      ? "bg-white text-[#666] hover:border-[#ffd0d5] hover:text-[#FD7979]"
      : "bg-white text-[#666] hover:border-[#ffd7db] hover:text-[#FDACAC]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
        selected ? activeClasses : `border-[#eee] ${idleClasses}`
      }`}
    >
      {label}
    </button>
  );
}

function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const [, navigate] = useLocation();
  const recommendationCount = getRecommendationCount(restaurant.id);
  const creatorsForRestaurant = getCreatorsByRestaurant(restaurant.id);
  const sourcesForRestaurant = getSourcesByRestaurant(restaurant.id);
  const cardImage =
    restaurant.imageUrl || sourcesForRestaurant[0]?.imageUrl || FALLBACK_RESTAURANT_IMAGE;

  return (
    <button
      type="button"
      onClick={() => navigate(`/restaurant/${restaurant.id}`)}
      className="group overflow-hidden rounded-[26px] border border-[#f0ebec] bg-white text-left shadow-[0_8px_28px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-0.5 hover:border-[#ffd0d5] hover:shadow-[0_16px_42px_rgba(253,121,121,0.14)]"
    >
      <div className="relative h-52 overflow-hidden">
        <img
          src={cardImage}
          alt={restaurant.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,16,16,0.02)_0%,rgba(16,16,16,0.18)_100%)]" />

        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/92 px-3 py-1 text-xs font-semibold text-[#555] backdrop-blur">
            {getCuisineCategory(restaurant.category)}
          </span>
          {restaurant.foundingYear ? (
            <span className="rounded-full bg-[#fff3f4] px-3 py-1 text-xs font-semibold text-[#FD7979]">
              {restaurant.foundingYear}년
            </span>
          ) : null}
        </div>

        <div className="absolute right-4 top-4">
          <HeartButton restaurantId={restaurant.id} size="sm" className="shadow-md" />
        </div>

        {recommendationCount > 1 ? (
          <div className="absolute bottom-4 left-4 rounded-full bg-[#111111]/72 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            추천 {recommendationCount}곳
          </div>
        ) : null}
      </div>

      <div className="space-y-4 p-5">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-[#181818]">{restaurant.name}</h3>
              <p className="mt-1 text-sm text-[#8a8a8a]">{restaurant.address}</p>
            </div>
          </div>

          <p className="text-sm font-medium text-[#FD7979]">
            {getRestaurantMenuSummary(restaurant) || "메뉴 정보는 아직 준비 중이에요."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {creatorsForRestaurant.map((creator) => (
            <span
              key={creator.id}
              title={creator.name}
              className="inline-flex max-w-[140px] items-center rounded-full border border-[#ffd2d8] bg-[#fff7f8] px-3 py-1 text-xs font-semibold text-[#FD7979]"
            >
              <span className="truncate">{creator.name}</span>
            </span>
          ))}

          {sourcesForRestaurant.map((source) => (
            <span
              key={source.id}
              title={source.name}
              className="inline-flex max-w-[170px] items-center rounded-full border border-[#f1ddaf] bg-[#fff8e8] px-3 py-1 text-xs font-semibold text-[#b67b19]"
            >
              <span className="truncate">{source.name}</span>
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

export default function Explore() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const categories = getCuisineCategories();
  const regions = getRegions();

  const discoveryOptions = useMemo<DiscoveryOption[]>(() => {
    const creatorOptions = creators
      .map((creator) => ({
        key: buildDiscoveryKey("creator", creator.id),
        id: creator.id,
        kind: "creator" as const,
        name: creator.name,
        imageUrl: creator.profileImage,
        count: getRestaurantsByCreator(creator.id).length,
      }))
      .filter((entry) => entry.count > 0);

    const sourceOptions = sources
      .map((source) => ({
        key: buildDiscoveryKey("source", source.id),
        id: source.id,
        kind: "source" as const,
        name: source.name,
        imageUrl: source.imageUrl,
        count: getSourceRestaurantCount(source.id),
      }))
      .filter((entry) => entry.count > 0);

    return [...creatorOptions, ...sourceOptions].sort(
      (a, b) => b.count - a.count || sortText(a.name, b.name)
    );
  }, []);

  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const initialSelectedKeys = useMemo(() => {
    const nextKeys: string[] = [];
    const creatorId = searchParams.get("creator");
    const sourceId = searchParams.get("source");

    if (creatorId) {
      const nextKey = buildDiscoveryKey("creator", creatorId);
      if (discoveryOptions.some((option) => option.key === nextKey)) {
        nextKeys.push(nextKey);
      }
    }

    if (sourceId) {
      const nextKey = buildDiscoveryKey("source", sourceId);
      if (discoveryOptions.some((option) => option.key === nextKey)) {
        nextKeys.push(nextKey);
      }
    }

    return nextKeys;
  }, [discoveryOptions, searchParams]);

  const [selectedDiscoveryKeys, setSelectedDiscoveryKeys] = useState<string[]>(initialSelectedKeys);
  const [selectedCategory, setSelectedCategory] = useState(ALL_FILTER);
  const [selectedRegion, setSelectedRegion] = useState(ALL_FILTER);

  useEffect(() => {
    setSelectedDiscoveryKeys(initialSelectedKeys);
  }, [initialSelectedKeys]);

  const filteredRestaurants = useMemo(() => {
    let nextRestaurants = [...restaurants];

    if (selectedDiscoveryKeys.length > 0) {
      const selectedSet = new Set(selectedDiscoveryKeys);

      nextRestaurants = nextRestaurants.filter((restaurant) => {
        const creatorMatch = getCreatorsByRestaurant(restaurant.id).some((creator) =>
          selectedSet.has(buildDiscoveryKey("creator", creator.id))
        );
        const sourceMatch = getSourcesByRestaurant(restaurant.id).some((source) =>
          selectedSet.has(buildDiscoveryKey("source", source.id))
        );

        return creatorMatch || sourceMatch;
      });
    }

    if (selectedCategory !== ALL_FILTER) {
      nextRestaurants = nextRestaurants.filter(
        (restaurant) => getCuisineCategory(restaurant.category) === selectedCategory
      );
    }

    if (selectedRegion !== ALL_FILTER) {
      nextRestaurants = nextRestaurants.filter(
        (restaurant) => getBroadRegion(restaurant.region) === selectedRegion
      );
    }

    nextRestaurants.sort(
      (a, b) =>
        getRecommendationCount(b.id) - getRecommendationCount(a.id) || sortText(a.name, b.name)
    );

    return nextRestaurants;
  }, [selectedCategory, selectedDiscoveryKeys, selectedRegion]);

  const toggleDiscovery = (key: string) => {
    setSelectedDiscoveryKeys((prev) =>
      prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key]
    );
  };

  const clearFilters = () => {
    setSelectedDiscoveryKeys([]);
    setSelectedCategory(ALL_FILTER);
    setSelectedRegion(ALL_FILTER);
    navigate("/explore");
  };

  const hasActiveDiscovery = selectedDiscoveryKeys.length > 0;
  const hasActiveFilters =
    hasActiveDiscovery || selectedCategory !== ALL_FILTER || selectedRegion !== ALL_FILTER;

  return (
    <div className="min-h-screen bg-[#fffdfd]">
      <nav className="sticky top-0 z-40 border-b border-[#f0ebec] bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff1f3] text-[#FD7979]">
              <Compass className="h-4 w-4" />
            </div>
            <span className="text-xl font-bold tracking-[-0.03em]">
              <span className="text-[#111111]">맛</span>
              <span className="text-[#FD7979]">픽</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 rounded-full border border-[#ece7e8] bg-white px-4 py-2 text-sm font-semibold text-[#666] transition hover:border-[#ffd0d5] hover:bg-[#fff8f9]"
          >
            <Search className="h-4 w-4" />
            홈으로 돌아가기
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-[#171717]">맛집 탐색</h1>
          <p className="mt-2 text-base text-[#7f7f7f]">
            보고 싶은 채널이나 소스를 먼저 고른 뒤, 카테고리와 지역으로 원하는 맛집을 더 좁혀보세요.
          </p>
        </header>

        <section className="mb-8 rounded-[28px] border border-[#f0ebec] bg-white p-5 shadow-[0_10px_36px_rgba(0,0,0,0.04)]">
          <div className="flex flex-wrap gap-3">
            <DiscoveryChip
              option={null}
              selected={!hasActiveDiscovery}
              onClick={() => setSelectedDiscoveryKeys([])}
            />
            {discoveryOptions.map((option) => (
              <DiscoveryChip
                key={option.key}
                option={option}
                selected={selectedDiscoveryKeys.includes(option.key)}
                onClick={() => toggleDiscovery(option.key)}
              />
            ))}
          </div>

          <div className="mt-5 space-y-4 border-t border-[#f5f0f1] pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-semibold text-[#666]">카테고리</span>
              <FilterChip
                label="전체"
                selected={selectedCategory === ALL_FILTER}
                onClick={() => setSelectedCategory(ALL_FILTER)}
              />
              {categories.map((category) => (
                <FilterChip
                  key={category}
                  label={category}
                  selected={selectedCategory === category}
                  onClick={() => setSelectedCategory(category)}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-semibold text-[#666]">지역</span>
              <FilterChip
                label="전체"
                tone="peach"
                selected={selectedRegion === ALL_FILTER}
                onClick={() => setSelectedRegion(ALL_FILTER)}
              />
              {regions.map((region) => (
                <FilterChip
                  key={region}
                  label={region}
                  tone="peach"
                  selected={selectedRegion === region}
                  onClick={() => setSelectedRegion(region)}
                />
              ))}
            </div>
          </div>
        </section>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#888]">
            총 <span className="font-bold text-[#FD7979]">{filteredRestaurants.length}</span>곳의
            맛집
          </p>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-semibold text-[#FD7979] transition hover:opacity-75"
            >
              필터 전체 초기화
            </button>
          ) : null}
        </div>

        {filteredRestaurants.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRestaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-[#ecdfe2] bg-white px-6 py-20 text-center">
            <p className="text-5xl">🍽️</p>
            <p className="mt-4 text-lg font-semibold text-[#333]">
              해당 조건에 맞는 맛집이 아직 없어요.
            </p>
            <p className="mt-2 text-sm leading-6 text-[#8a8a8a]">
              선택한 소스나 카테고리, 지역 조건을 조금 넓혀서 다시 찾아보세요.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
