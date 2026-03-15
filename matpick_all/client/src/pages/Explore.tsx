import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  getAllCategories,
  getBroadRegion,
  getCreatorsByRestaurant,
  getRecommendationCount,
  getRegions,
  getRestaurantMenuSummary,
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
      return "출처";
  }
}

function SourceFilterCard({
  source,
  count,
  selected,
  onClick,
}: {
  source: Source | null;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  const label = source ? source.name : "전체 맛집";
  const typeLabel = source ? getSourceTypeLabel(source) : "전체";
  const imageUrl = source?.imageUrl ?? FALLBACK_RESTAURANT_IMAGE;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group overflow-hidden rounded-[28px] border text-left transition-all ${
        selected
          ? "border-[#FD7979] bg-[#fff6f7] shadow-[0_16px_40px_rgba(253,121,121,0.18)]"
          : "border-[#f0f0f0] bg-white hover:-translate-y-1 hover:border-[#FFCDC9] hover:shadow-[0_16px_36px_rgba(0,0,0,0.08)]"
      }`}
    >
      <div className="relative h-[132px] overflow-hidden">
        <img
          src={imageUrl}
          alt={label}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,17,17,0.05)_0%,rgba(17,17,17,0.55)_100%)]" />
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
          <div>
            <div className="inline-flex rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[#555]">
              {typeLabel}
            </div>
            <p className="mt-2 line-clamp-2 text-base font-bold text-white">{label}</p>
          </div>
          <div className="rounded-full bg-white/92 px-3 py-1 text-xs font-bold text-[#FD7979]">
            {count}곳
          </div>
        </div>
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

  const sourceSummaries = useMemo(
    () =>
      sources
        .map((source) => ({
          source,
          restaurantCount: getSourceRestaurantCount(source.id),
        }))
        .filter((entry) => entry.restaurantCount > 0)
        .sort(
          (a, b) =>
            b.restaurantCount - a.restaurantCount ||
            sortText(a.source.name, b.source.name)
        ),
    []
  );

  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const querySourceId = searchParams.get("source") ?? ALL_FILTER;
  const initialSourceId = sourceSummaries.some((entry) => entry.source.id === querySourceId)
    ? querySourceId
    : ALL_FILTER;

  const [selectedCategory, setSelectedCategory] = useState(ALL_FILTER);
  const [selectedRegion, setSelectedRegion] = useState(ALL_FILTER);
  const [selectedSourceId, setSelectedSourceId] = useState(initialSourceId);

  useEffect(() => {
    setSelectedSourceId(initialSourceId);
  }, [initialSourceId]);

  const activeSource =
    selectedSourceId === ALL_FILTER
      ? null
      : sourceSummaries.find((entry) => entry.source.id === selectedSourceId)?.source ?? null;

  const filteredRestaurants = useMemo(() => {
    let nextRestaurants = [...restaurants];

    if (selectedSourceId !== ALL_FILTER) {
      const allowedIds = new Set(
        getRestaurantsBySource(selectedSourceId).map((restaurant) => restaurant.id)
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
      if (selectedSourceId !== ALL_FILTER) {
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
  }, [selectedCategory, selectedRegion, selectedSourceId]);

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
            유튜브, 방송, 가이드, 기관 선정까지 출처별로 모아보고 원하는 맛집만 골라보세요.
          </p>
        </div>

        {sourceSummaries.length > 0 ? (
          <section className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#1a1a1a]">주제별 소스 탐색</h2>
                <p className="mt-1 text-sm text-[#888]">
                  100선처럼 특정 주제로 묶인 식당들을 한 번에 볼 수 있어요.
                </p>
              </div>
              {activeSource ? (
                <div className="rounded-full bg-[#fff3f4] px-4 py-2 text-sm font-semibold text-[#FD7979]">
                  현재 선택: {activeSource.name}
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SourceFilterCard
                source={null}
                count={restaurants.length}
                selected={selectedSourceId === ALL_FILTER}
                onClick={() => setSelectedSourceId(ALL_FILTER)}
              />

              {sourceSummaries.map((entry) => (
                <SourceFilterCard
                  key={entry.source.id}
                  source={entry.source}
                  count={entry.restaurantCount}
                  selected={selectedSourceId === entry.source.id}
                  onClick={() => setSelectedSourceId(entry.source.id)}
                />
              ))}
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
          {selectedSourceId !== ALL_FILTER ? (
            <button
              type="button"
              onClick={() => setSelectedSourceId(ALL_FILTER)}
              className="text-sm font-semibold text-[#FD7979] transition hover:opacity-75"
            >
              소스 필터 해제
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
