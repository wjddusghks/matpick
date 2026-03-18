import { useEffect, useMemo, useState } from "react";
import { Compass, Search } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import {
  creators,
  discoveryTopics,
  getDiscoveryTopicBySlug,
  getDiscoveryTopicEpisodeBySlug,
  getDiscoveryTopicEpisodes,
  getBroadRegion,
  getCuisineCategories,
  getCuisineCategory,
  getCreatorDisplayName,
  getCreatorsByRestaurant,
  getRecommendationCount,
  getRegions,
  getRestaurantMenuSummary,
  getRestaurantsByCreator,
  getSourceRestaurantCount,
  getSourcesByRestaurant,
  restaurants,
  sources,
  type Restaurant,
} from "@/data";
import HeartButton from "@/components/HeartButton";
import { FavoriteTopicBadge } from "@/components/FavoriteTopicDialog";
import MonetizationSlot from "@/components/monetization/MonetizationSlot";
import { useFavorites } from "@/contexts/FavoritesContext";
import {
  getRestaurantDisplayImage,
  getRestaurantPrimaryPrice,
} from "@/lib/restaurantPresentation";
import { useSeo } from "@/lib/seo";

const ALL_FILTER = "all";

type DiscoveryKind = "creator" | "source";

type DiscoveryOption = {
  key: string;
  id: string;
  kind: DiscoveryKind;
  name: string;
  imageUrl?: string;
  count: number;
};

type ExploreProps = {
  topicSlug?: string;
  episodeSlug?: string;
};

type AvatarOption = {
  name: string;
  imageUrl?: string | null;
};

function sortText(a: string, b: string) {
  return a.localeCompare(b, "ko-KR");
}

function buildDiscoveryKey(kind: DiscoveryKind, id: string) {
  return `${kind}:${id}`;
}

function dedupeRestaurantsById(items: Restaurant[]) {
  return Array.from(new Map(items.map((restaurant) => [restaurant.id, restaurant])).values());
}

function SourceAvatarButton({
  option,
  selected,
  onClick,
}: {
  option: AvatarOption | null;
  selected: boolean;
  onClick: () => void;
}) {
  const label = option?.name ?? "전체";

  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className="flex w-[74px] flex-shrink-0 flex-col items-center gap-2 text-center sm:w-[86px]"
    >
      <span
        className={`flex h-[64px] w-[64px] items-center justify-center rounded-full p-[2px] transition-all sm:h-[72px] sm:w-[72px] ${
          selected
            ? "bg-[linear-gradient(135deg,#ff6a6a_0%,#ff00d4_100%)] shadow-[0_18px_38px_rgba(255,105,135,0.24)]"
            : "bg-[linear-gradient(135deg,#ffd8de_0%,#ffe7f6_100%)]"
        }`}
      >
        <span className="flex h-full w-full items-center justify-center rounded-full bg-white">
          {option?.imageUrl ? (
            <img
              src={option.imageUrl}
              alt={option.name}
              className="h-[54px] w-[54px] rounded-full object-cover sm:h-[62px] sm:w-[62px]"
            />
          ) : (
            <span className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#fff3f5] text-xs font-black text-[#ff7b83] sm:h-[62px] sm:w-[62px] sm:text-sm">
              ALL
            </span>
          )}
        </span>
      </span>

      <span
        className={`max-w-[74px] truncate text-[11px] font-semibold leading-tight sm:max-w-[86px] ${
          selected ? "text-[#ff5d76]" : "text-[#4f4f4f]"
        }`}
      >
        {label}
      </span>
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
      ? "border-[#ff7b83] bg-[#ff7b83] text-white shadow-[0_10px_22px_rgba(255,123,131,0.18)]"
      : "border-[#fca5a5] bg-[#fda4af] text-white shadow-[0_10px_22px_rgba(252,165,165,0.18)]";

  const idleClasses =
    tone === "pink"
      ? "border-[#ebe6e7] bg-white text-[#666] hover:border-[#ffd1d7] hover:text-[#ff7b83]"
      : "border-[#ebe6e7] bg-white text-[#666] hover:border-[#ffd7dc] hover:text-[#f08e8e]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
        selected ? activeClasses : idleClasses
      }`}
    >
      {label}
    </button>
  );
}

function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const [, navigate] = useLocation();
  const creatorsForRestaurant = getCreatorsByRestaurant(restaurant.id);
  const sourcesForRestaurant = getSourcesByRestaurant(restaurant.id);
  const recommendationCount = getRecommendationCount(restaurant.id);
  const displayImage = getRestaurantDisplayImage(restaurant);
  const priceHint = getRestaurantPrimaryPrice(restaurant);

  return (
    <button
      type="button"
      onClick={() => navigate(`/restaurant/${restaurant.id}`)}
      className="group overflow-hidden rounded-[26px] border border-[#f0ebec] bg-white text-left shadow-[0_8px_28px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-0.5 hover:border-[#ffd0d5] hover:shadow-[0_16px_42px_rgba(253,121,121,0.14)]"
    >
      <div className="relative h-52 overflow-hidden">
        <img
          src={displayImage.src}
          alt={restaurant.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,16,16,0.02)_0%,rgba(16,16,16,0.18)_100%)]" />

        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {!displayImage.hasPhoto ? (
            <span className="rounded-full bg-white/92 px-3 py-1 text-xs font-semibold text-[#6f7280] backdrop-blur">
              사진 준비 중
            </span>
          ) : null}
          <span className="rounded-full bg-white/92 px-3 py-1 text-xs font-semibold text-[#555] backdrop-blur">
            {getCuisineCategory(restaurant.category)}
          </span>
          {restaurant.foundingYear ? (
            <span className="rounded-full bg-[#fff3f4] px-3 py-1 text-xs font-semibold text-[#ff7b83]">
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
          <h3 className="text-lg font-bold text-[#181818]">{restaurant.name}</h3>
          <p className="text-sm text-[#8a8a8a]">{restaurant.address}</p>
          {priceHint ? (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b2a2a6]">
              대표 가격 {priceHint}
            </p>
          ) : null}
          <p className="text-sm font-medium text-[#ff7b83]">
            {getRestaurantMenuSummary(restaurant) || "메뉴 정보는 아직 준비 중이에요."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {creatorsForRestaurant.map((creator) => (
            <span
              key={creator.id}
              title={getCreatorDisplayName(creator)}
              className="inline-flex max-w-[140px] items-center rounded-full border border-[#ffd2d8] bg-[#fff7f8] px-3 py-1 text-xs font-semibold text-[#ff7b83]"
            >
              <span className="truncate">{getCreatorDisplayName(creator)}</span>
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

export default function Explore({ topicSlug, episodeSlug }: ExploreProps = {}) {
  const [, navigate] = useLocation();
  const search = useSearch();
  const categories = getCuisineCategories();
  const regions = getRegions();
  const { topics, isRestaurantInTopic, getTopicRestaurantCount } = useFavorites();
  const presetTopic = useMemo(
    () => (topicSlug ? getDiscoveryTopicBySlug(topicSlug) : null),
    [topicSlug]
  );
  const curatedDiscoveryKeySet = useMemo(
    () => new Set(discoveryTopics.map((topic) => topic.key)),
    []
  );
  const topicEpisodes = useMemo(
    () => (topicSlug ? getDiscoveryTopicEpisodes(topicSlug) : []),
    [topicSlug]
  );
  const presetEpisode = useMemo(
    () =>
      topicSlug && episodeSlug
        ? getDiscoveryTopicEpisodeBySlug(topicSlug, episodeSlug)
        : null,
    [episodeSlug, topicSlug]
  );

  const discoveryOptions = useMemo<DiscoveryOption[]>(() => {
    const creatorOptions = creators
      .map((creator) => ({
        key: buildDiscoveryKey("creator", creator.id),
        id: creator.id,
        kind: "creator" as const,
        name: getCreatorDisplayName(creator),
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
  const additionalDiscoveryOptions = useMemo(
    () =>
      discoveryOptions.filter((option) => !curatedDiscoveryKeySet.has(option.key)),
    [curatedDiscoveryKeySet, discoveryOptions]
  );

  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const initialSelectedKeys = useMemo(() => {
    if (presetTopic) {
      return [presetTopic.key];
    }

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
  }, [discoveryOptions, presetTopic, searchParams]);

  const [selectedDiscoveryKeys, setSelectedDiscoveryKeys] = useState<string[]>(initialSelectedKeys);
  const [selectedCategory, setSelectedCategory] = useState(ALL_FILTER);
  const [selectedRegion, setSelectedRegion] = useState(ALL_FILTER);
  const [selectedTopicId, setSelectedTopicId] = useState(ALL_FILTER);

  const seoTitle = presetEpisode
    ? `${presetTopic?.name ?? ""} ${presetEpisode.episode} 맛집 탐색`
    : presetTopic
      ? `${presetTopic.name} 맛집 탐색`
      : "맛집 탐색";
  const seoDescription = presetEpisode
    ? presetEpisode.description
    : presetTopic
      ? presetTopic.description
      : "채널과 소스, 카테고리, 지역 필터를 조합해서 원하는 스타일의 맛집을 한눈에 탐색해보세요.";
  const seoPath = presetEpisode
    ? presetEpisode.path
    : presetTopic
      ? presetTopic.path
      : "/explore";
  const topicLine = presetEpisode
    ? `${presetEpisode.episode}에 소개된 맛집만 모아보는 화면입니다.`
    : presetTopic
      ? `${presetTopic.name}만 빠르게 둘러볼 수 있는 탐색 화면입니다.`
      : "";

  useSeo({
    title: seoTitle,
    description: seoDescription,
    path: seoPath,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: seoTitle,
      description: seoDescription,
      url: `https://matpick.co.kr${seoPath}`,
    },
  });

  useEffect(() => {
    setSelectedDiscoveryKeys(initialSelectedKeys);
  }, [initialSelectedKeys]);

  useEffect(() => {
    setSelectedCategory(ALL_FILTER);
    setSelectedRegion(ALL_FILTER);
    setSelectedTopicId(ALL_FILTER);
  }, [episodeSlug, topicSlug]);

  const filteredRestaurants = useMemo(() => {
    let nextRestaurants = [...restaurants];

    if (selectedDiscoveryKeys.length > 0) {
      const selectedCreatorKeys = new Set(
        selectedDiscoveryKeys.filter((key) => key.startsWith("creator:"))
      );
      const selectedSourceKeys = new Set(
        selectedDiscoveryKeys.filter((key) => key.startsWith("source:"))
      );

      nextRestaurants = nextRestaurants.filter((restaurant) => {
        const creatorMatch =
          selectedCreatorKeys.size === 0 ||
          getCreatorsByRestaurant(restaurant.id).some((creator) =>
            selectedCreatorKeys.has(buildDiscoveryKey("creator", creator.id))
          );
        const sourceMatch =
          selectedSourceKeys.size === 0 ||
          getSourcesByRestaurant(restaurant.id).some((source) =>
            selectedSourceKeys.has(buildDiscoveryKey("source", source.id))
          );

        return creatorMatch && sourceMatch;
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

    if (presetEpisode) {
      const episodeRestaurantIds = new Set(presetEpisode.restaurantIds);
      nextRestaurants = nextRestaurants.filter((restaurant) =>
        episodeRestaurantIds.has(restaurant.id)
      );
    }

    if (selectedTopicId !== ALL_FILTER) {
      nextRestaurants = nextRestaurants.filter((restaurant) =>
        isRestaurantInTopic(selectedTopicId, restaurant.id)
      );
    }

    return dedupeRestaurantsById(nextRestaurants).sort(
      (a, b) =>
        getRecommendationCount(b.id) - getRecommendationCount(a.id) || sortText(a.name, b.name)
    );
  }, [
    isRestaurantInTopic,
    presetEpisode,
    selectedCategory,
    selectedDiscoveryKeys,
    selectedRegion,
    selectedTopicId,
  ]);

  const toggleDiscovery = (key: string) => {
    if (presetTopic && key === presetTopic.key && selectedDiscoveryKeys.length === 1) {
      navigate("/explore");
      return;
    }

    setSelectedDiscoveryKeys((prev) =>
      prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key]
    );
  };

  const clearDiscoverySelection = () => {
    setSelectedDiscoveryKeys(presetTopic ? [presetTopic.key] : []);
  };

  const clearFilters = () => {
    setSelectedDiscoveryKeys([]);
    setSelectedCategory(ALL_FILTER);
    setSelectedRegion(ALL_FILTER);
    setSelectedTopicId(ALL_FILTER);
    if (presetEpisode && presetTopic) {
      navigate(presetTopic.path);
      return;
    }

    navigate("/explore");
  };

  const hasActiveDiscovery = selectedDiscoveryKeys.length > 0;
  const hasAdditionalDiscovery = selectedDiscoveryKeys.some(
    (key) => !curatedDiscoveryKeySet.has(key)
  );
  const hasActiveFilters =
    hasActiveDiscovery ||
    selectedCategory !== ALL_FILTER ||
    selectedRegion !== ALL_FILTER ||
    selectedTopicId !== ALL_FILTER;

  return (
    <div className="min-h-screen bg-[#fffdfd]">
      <nav className="sticky top-0 z-40 border-b border-[#f0ebec] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff1f3] text-[#ff7b83]">
              <Compass className="h-4 w-4" />
            </div>
            <span
              className="text-xl font-bold tracking-[-0.03em]"
              style={{ fontFamily: "'Black Han Sans', sans-serif" }}
            >
              <span className="text-[#111111]">맛</span>
              <span className="text-[#ff7b83]">픽</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 rounded-full border border-[#ece7e8] bg-white px-3 py-2 text-xs font-semibold text-[#666] transition hover:border-[#ffd0d5] hover:bg-[#fff8f9] sm:px-4 sm:text-sm"
          >
            <Search className="h-4 w-4" />
            홈으로
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-[#171717] sm:text-3xl">맛집 탐색</h1>
          <p className="mt-2 text-sm leading-6 text-[#7f7f7f] sm:text-base">
            먼저 보고 싶은 채널이나 소스를 고른 뒤, 카테고리와 지역으로 결과를 더
            좁혀보세요.
          </p>
          {presetTopic ? (
            <p className="mt-3 text-xs font-medium text-[#ff7b83] sm:text-sm">{topicLine}</p>
          ) : null}
        </header>

        <section className="mb-8 rounded-[28px] border border-[#f0ebec] bg-white p-4 shadow-[0_10px_36px_rgba(0,0,0,0.04)] sm:p-5">
          <div className="mb-4">
            <p className="mb-3 text-xs font-semibold tracking-[0.08em] text-[#b58f95]">
              주제 바로가기
            </p>
            <div className="-mx-1 overflow-x-auto pb-2">
              <div className="flex min-w-max gap-4 px-1">
                {discoveryTopics.map((topic) => (
                  <SourceAvatarButton
                    key={topic.slug}
                    option={{ name: topic.name, imageUrl: topic.imageUrl }}
                    selected={topic.slug === topicSlug}
                    onClick={() => navigate(topic.path)}
                  />
                ))}
              </div>
            </div>
          </div>

          {additionalDiscoveryOptions.length > 0 ? (
            <div className="-mx-1 overflow-x-auto pb-2">
              <div className="flex min-w-max gap-4 px-1">
                <SourceAvatarButton
                  option={null}
                  selected={!hasAdditionalDiscovery}
                  onClick={clearDiscoverySelection}
                />
                {additionalDiscoveryOptions.map((option) => (
                  <SourceAvatarButton
                    key={option.key}
                    option={option}
                    selected={selectedDiscoveryKeys.includes(option.key)}
                    onClick={() => toggleDiscovery(option.key)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 space-y-4 border-t border-[#f5f0f1] pt-4 sm:mt-5 sm:pt-5">
            {presetTopic && topicEpisodes.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-sm font-semibold text-[#666]">회차</span>
                <FilterChip
                  label="전체"
                  selected={!presetEpisode}
                  onClick={() => navigate(presetTopic.path)}
                />
                {topicEpisodes.map((episode) => (
                  <FilterChip
                    key={episode.slug}
                    label={episode.episode}
                    selected={presetEpisode?.slug === episode.slug}
                    onClick={() => navigate(episode.path)}
                  />
                ))}
              </div>
            ) : null}

            {topics.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-sm font-semibold text-[#666]">내 주제</span>
                <FilterChip
                  label="전체"
                  selected={selectedTopicId === ALL_FILTER}
                  onClick={() => setSelectedTopicId(ALL_FILTER)}
                />
                {topics.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => setSelectedTopicId(topic.id)}
                    className="transition"
                    title={`${topic.name} (${getTopicRestaurantCount(topic.id)}곳)`}
                  >
                    <FavoriteTopicBadge
                      topic={topic}
                      active={selectedTopicId === topic.id}
                    />
                  </button>
                ))}
              </div>
            ) : null}

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
            총 <span className="font-bold text-[#ff7b83]">{filteredRestaurants.length}</span>곳의
            맛집
          </p>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-semibold text-[#ff7b83] transition hover:opacity-75"
            >
              필터 전체 초기화
            </button>
          ) : null}
        </div>

        <div className="mb-6">
          <MonetizationSlot label="Sponsored" />
        </div>

        {filteredRestaurants.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {filteredRestaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-[#ecdfe2] bg-white px-6 py-16 text-center sm:py-20">
            <p className="text-5xl">🍽️</p>
            <p className="mt-4 text-lg font-semibold text-[#333]">
              해당 조건에 맞는 맛집이 아직 없어요.
            </p>
            <p className="mt-2 text-sm leading-6 text-[#8a8a8a]">
              선택한 소스, 카테고리, 지역 조건을 조금만 넓혀서 다시 찾아보세요.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
