import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  creators,
  getAllCategories,
  getBroadRegion,
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
  type Source,
} from "@/data";
import HeartButton from "@/components/HeartButton";

const ALL_FILTER = "all";
const FALLBACK_RESTAURANT_IMAGE =
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=400&fit=crop";

type DiscoveryKind = "all" | "creator" | "source";

type DiscoveryItem = {
  id: string;
  kind: Exclude<DiscoveryKind, "all">;
  name: string;
  imageUrl: string;
  count: number;
  badge: string;
};

function sortText(a: string, b: string) {
  return a.localeCompare(b, "ko-KR");
}

function getSourceTypeLabel(source: Source) {
  switch (source.type) {
    case "guide":
      return "가이드";
    case "tv_show":
      return "방송";
    case "michelin":
      return "미쉐린";
    case "institution":
      return "기관 선정";
    case "book":
      return "책";
    case "magazine":
      return "매거진";
    case "creator":
      return "크리에이터";
    default:
      return "소스";
  }
}

function getSelectionKey(kind: DiscoveryKind, id = ALL_FILTER) {
  return `${kind}:${id}`;
}

function DiscoveryRailItem({
  item,
  selected,
  onClick,
}: {
  item: DiscoveryItem | null;
  selected: boolean;
  onClick: () => void;
}) {
  const name = item?.name ?? "전체";
  const badge = item?.badge ?? "전체";
  const count = item?.count ?? restaurants.length;
  const imageUrl = item?.imageUrl ?? FALLBACK_RESTAURANT_IMAGE;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-[88px] flex-col items-center gap-2 text-center"
    >
      <div
        className={`relative h-[84px] w-[84px] overflow-hidden rounded-full border-4 transition-all ${
          selected
            ? "border-[#FD7979] shadow-[0_14px_30px_rgba(253,121,121,0.28)]"
            : "border-white shadow-[0_10px_24px_rgba(0,0,0,0.08)]"
        }`}
      >
        <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
      </div>
      <div className="space-y-0.5">
        <p className="line-clamp-2 text-[13px] font-semibold text-[#1a1a1a]">{name}</p>
        <p className="text-[11px] text-[#8a8a8a]">
          {badge} · {count}곳
        </p>
      </div>
    </button>
  );
}

function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const [, navigate] = useLocation();
  const recCount = getRecommendationCount(restaurant.id);
  const recCreators = getCreatorsByRestaurant(restaurant.id);
  const sourceBadges = getSourcesByRestaurant(restaurant.id);
  const cardImage =
    restaurant.imageUrl || sourceBadges[0]?.imageUrl || FALLBACK_RESTAURANT_IMAGE;

  return (
    <div
      onClick={() => navigate(`/restaurant/${restaurant.id}`)}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all duration-300 hover:border-[#FFCDC9] hover:shadow-[0_8px_32px_rgba(253,121,121,0.15)]"
    >
      <div className="relative h-48 overflow-hidden">
        <img
          src={cardImage}
          alt={restaurant.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,17,17,0.02)_0%,rgba(17,17,17,0.16)_100%)]" />

        {recCount > 1 ? (
          <div
            className="absolute left-3 top-3 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-lg"
            style={{ background: "linear-gradient(135deg, #FD7979, #FDACAC)" }}
          >
            추천 {recCount}곳
          </div>
        ) : null}

        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-[#666] backdrop-blur-sm">
            {restaurant.category}
          </span>
          <HeartButton restaurantId={restaurant.id} size="sm" className="shadow-md" />
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3
              className="text-lg font-bold text-[#1a1a1a] transition-colors group-hover:text-[#FD7979]"
              style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
            >
              {restaurant.name}
            </h3>
            <p className="mt-1 text-sm text-[#888]">{restaurant.address}</p>
          </div>
          {restaurant.foundingYear ? (
            <div className="rounded-full bg-[#fff3f4] px-2.5 py-1 text-[11px] font-semibold text-[#FD7979]">
              {restaurant.foundingYear}년
            </div>
          ) : null}
        </div>

        <div
          className="mt-3 text-sm font-medium text-[#FD7979]"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          {getRestaurantMenuSummary(restaurant) || "메뉴 정보 준비 중"}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {recCreators.map((creator, index) => {
            const colors = ["#FD7979", "#FDACAC", "#FFCDC9"];
            const rotations = [-2, 1.5, -1];
            return (
              <span
                key={creator.id}
                className="inline-flex items-center gap-1 rounded-sm border-2 px-2 py-0.5 text-[11px] font-bold"
                style={{
                  borderColor: colors[index % 3],
                  color: colors[index % 3],
                  transform: `rotate(${rotations[index % 3]}deg)`,
                  opacity: 0.92,
                }}
              >
                {creator.name.length > 8 ? `${creator.name.slice(0, 8)}...` : creator.name}
              </span>
            );
          })}

          {sourceBadges.map((source) => (
            <span
              key={source.id}
              className="inline-flex items-center rounded-sm border border-[#f3d5a1] bg-[#fff7e8] px-2 py-0.5 text-[11px] font-bold text-[#b7791f]"
            >
              {source.name.length > 16 ? `${source.name.slice(0, 16)}...` : source.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Explore() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const categories = getAllCategories();
  const regions = getRegions();

  const creatorItems = useMemo<DiscoveryItem[]>(
    () =>
      creators
        .map((creator) => ({
          id: creator.id,
          kind: "creator" as const,
          name: creator.name,
          imageUrl: creator.profileImage || FALLBACK_RESTAURANT_IMAGE,
          count: getRestaurantsByCreator(creator.id).length,
          badge: creator.series || "채널",
        }))
        .filter((entry) => entry.count > 0)
        .sort((a, b) => b.count - a.count || sortText(a.name, b.name)),
    []
  );

  const sourceItems = useMemo<DiscoveryItem[]>(
    () =>
      sources
        .map((source) => ({
          id: source.id,
          kind: "source" as const,
          name: source.name,
          imageUrl: source.imageUrl || FALLBACK_RESTAURANT_IMAGE,
          count: getSourceRestaurantCount(source.id),
          badge: getSourceTypeLabel(source),
        }))
        .filter((entry) => entry.count > 0)
        .sort((a, b) => b.count - a.count || sortText(a.name, b.name)),
    []
  );

  const discoveryItems = useMemo(
    () => [...creatorItems, ...sourceItems],
    [creatorItems, sourceItems]
  );

  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const querySourceId = searchParams.get("source");
  const queryCreatorId = searchParams.get("creator");

  const initialSelectionKey = useMemo(() => {
    if (querySourceId && sourceItems.some((item) => item.id === querySourceId)) {
      return getSelectionKey("source", querySourceId);
    }

    if (queryCreatorId && creatorItems.some((item) => item.id === queryCreatorId)) {
      return getSelectionKey("creator", queryCreatorId);
    }

    return getSelectionKey("all");
  }, [creatorItems, queryCreatorId, querySourceId, sourceItems]);

  const [selectedCategory, setSelectedCategory] = useState(ALL_FILTER);
  const [selectedRegion, setSelectedRegion] = useState(ALL_FILTER);
  const [selectedDiscoveryKey, setSelectedDiscoveryKey] = useState(initialSelectionKey);

  useEffect(() => {
    setSelectedDiscoveryKey(initialSelectionKey);
  }, [initialSelectionKey]);

  const activeDiscovery =
    selectedDiscoveryKey === getSelectionKey("all")
      ? null
      : discoveryItems.find(
          (item) => selectedDiscoveryKey === getSelectionKey(item.kind, item.id)
        ) ?? null;

  const filteredRestaurants = useMemo(() => {
    let nextRestaurants = [...restaurants];

    if (activeDiscovery?.kind === "creator") {
      const allowedIds = new Set(
        getRestaurantsByCreator(activeDiscovery.id).map((restaurant) => restaurant.id)
      );
      nextRestaurants = nextRestaurants.filter((restaurant) => allowedIds.has(restaurant.id));
    }

    if (activeDiscovery?.kind === "source") {
      const allowedIds = new Set(
        getRestaurantsBySource(activeDiscovery.id).map((restaurant) => restaurant.id)
      );
      nextRestaurants = nextRestaurants.filter((restaurant) => allowedIds.has(restaurant.id));
    }

    if (selectedCategory !== ALL_FILTER) {
      nextRestaurants = nextRestaurants.filter(
        (restaurant) => restaurant.category === selectedCategory
      );
    }

    if (selectedRegion !== ALL_FILTER) {
      nextRestaurants = nextRestaurants.filter(
        (restaurant) => getBroadRegion(restaurant.region) === selectedRegion
      );
    }

    nextRestaurants.sort((a, b) => {
      if (activeDiscovery?.kind === "source") {
        const foundingYearDelta = (a.foundingYear ?? 9999) - (b.foundingYear ?? 9999);
        if (foundingYearDelta !== 0) {
          return foundingYearDelta;
        }
      }

      return (
        getRecommendationCount(b.id) - getRecommendationCount(a.id) ||
        sortText(a.name, b.name)
      );
    });

    return nextRestaurants;
  }, [activeDiscovery, selectedCategory, selectedRegion]);

  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex cursor-pointer items-center gap-2" onClick={() => navigate("/")}>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FD7979]/10">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FD7979"
                strokeWidth="2.5"
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
            </div>
            <span
              className="text-xl font-bold"
              style={{ fontFamily: "'Black Han Sans', sans-serif" }}
            >
              <span className="text-[#1a1a1a]">맛</span>
              <span className="text-[#FD7979]">픽</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 transition-colors hover:border-[#FFCDC9] hover:bg-[#FEEAC9]/30"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#999"
              strokeWidth="2.5"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="text-sm text-[#999]">검색으로 돌아가기</span>
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1
            className="mb-2 text-3xl font-bold text-[#1a1a1a]"
            style={{ fontFamily: "'Black Han Sans', sans-serif" }}
          >
            맛집 탐색
          </h1>
          <p className="text-base text-[#888]">
            채널과 소스를 먼저 고르고, 그다음 카테고리와 지역으로 더 좁혀보세요.
          </p>
        </div>

        {discoveryItems.length > 0 ? (
          <section className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#1a1a1a]">채널 / 소스 탐색</h2>
                <p className="mt-1 text-sm text-[#888]">
                  인스타 스토리처럼 위에서 채널이나 소스를 먼저 골라볼 수 있어요.
                </p>
              </div>
              {activeDiscovery ? (
                <div className="rounded-full bg-[#fff3f4] px-4 py-2 text-sm font-semibold text-[#FD7979]">
                  현재 선택: {activeDiscovery.name}
                </div>
              ) : null}
            </div>

            <div className="-mx-1 overflow-x-auto pb-2">
              <div className="flex min-w-max gap-4 px-1">
                <DiscoveryRailItem
                  item={null}
                  selected={selectedDiscoveryKey === getSelectionKey("all")}
                  onClick={() => setSelectedDiscoveryKey(getSelectionKey("all"))}
                />

                {discoveryItems.map((item) => (
                  <DiscoveryRailItem
                    key={getSelectionKey(item.kind, item.id)}
                    item={item}
                    selected={selectedDiscoveryKey === getSelectionKey(item.kind, item.id)}
                    onClick={() =>
                      setSelectedDiscoveryKey(getSelectionKey(item.kind, item.id))
                    }
                  />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <div className="mb-8 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-sm font-semibold text-[#666]">카테고리</span>
            <button
              type="button"
              onClick={() => setSelectedCategory(ALL_FILTER)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                selectedCategory === ALL_FILTER
                  ? "bg-[#FD7979] text-white shadow-[0_2px_8px_rgba(253,121,121,0.3)]"
                  : "bg-white text-[#666] shadow-sm hover:bg-[#FEEAC9]/30 hover:text-[#FD7979]"
              }`}
            >
              전체
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  selectedCategory === category
                    ? "bg-[#FD7979] text-white shadow-[0_2px_8px_rgba(253,121,121,0.3)]"
                    : "bg-white text-[#666] shadow-sm hover:bg-[#FEEAC9]/30 hover:text-[#FD7979]"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-sm font-semibold text-[#666]">지역</span>
            <button
              type="button"
              onClick={() => setSelectedRegion(ALL_FILTER)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                selectedRegion === ALL_FILTER
                  ? "bg-[#FDACAC] text-white shadow-[0_2px_8px_rgba(253,172,172,0.3)]"
                  : "bg-white text-[#666] shadow-sm hover:bg-[#FFCDC9]/20 hover:text-[#FDACAC]"
              }`}
            >
              전체
            </button>
            {regions.map((region) => (
              <button
                key={region}
                type="button"
                onClick={() => setSelectedRegion(region)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  selectedRegion === region
                    ? "bg-[#FDACAC] text-white shadow-[0_2px_8px_rgba(253,172,172,0.3)]"
                    : "bg-white text-[#666] shadow-sm hover:bg-[#FFCDC9]/20 hover:text-[#FDACAC]"
                }`}
              >
                {region}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-[#888]">
            총 <span className="font-bold text-[#FD7979]">{filteredRestaurants.length}</span>개 맛집
          </p>
          {activeDiscovery ? (
            <button
              type="button"
              onClick={() => setSelectedDiscoveryKey(getSelectionKey("all"))}
              className="text-sm font-semibold text-[#FD7979] transition hover:opacity-75"
            >
              채널/소스 필터 해제
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRestaurants.map((restaurant) => (
            <RestaurantCard key={restaurant.id} restaurant={restaurant} />
          ))}
        </div>

        {filteredRestaurants.length === 0 ? (
          <div className="py-20 text-center">
            <p className="mb-4 text-6xl">🍽️</p>
            <p className="text-lg text-[#888]">해당 조건에 맞는 맛집이 아직 없어요.</p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
