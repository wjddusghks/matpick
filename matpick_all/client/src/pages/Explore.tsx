import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Compass, Search } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import {
  creators,
  discoveryTopics,
  getBroadRegion,
  getRestaurantBroadcastMeta,
  getCuisineCategories,
  getCuisineCategory,
  getCreatorDisplayName,
  getCreatorsByRestaurant,
  getDiscoveryTopicBySlug,
  getDiscoveryTopicEpisodeBySlug,
  getDiscoveryTopicEpisodes,
  getRecommendationCount,
  getRegions,
  getRestaurantMenuSummary,
  getRestaurantsByCreator,
  getSourceRestaurantCount,
  getSourcesByRestaurant,
  restaurants,
  sources,
  type DiscoveryTopic,
  type DiscoveryTopicEpisode,
  type Restaurant,
} from "@/data";
import HeartButton from "@/components/HeartButton";
import { FavoriteTopicBadge } from "@/components/FavoriteTopicDialog";
import MonetizationSlot, {
  AdsenseSlot,
} from "@/components/monetization/MonetizationSlot";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useLocale } from "@/contexts/LocaleContext";
import { translateCuisineLabel, type AppLocale } from "@/lib/locale";
import { trackMarketingEvent } from "@/lib/marketing";
import {
  formatRestaurantBroadcastBadge,
  getRestaurantDisplayImage,
  formatRestaurantFoundingBadge,
  getRestaurantPrimaryPrice,
} from "@/lib/restaurantPresentation";
import { buildAbsoluteUrl, useSeo } from "@/lib/seo";

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

const EXPLORE_COPY = {
  ko: {
    homeLabel: "홈으로",
    pageTitle: "맛집 탐색",
    pageDescription:
      "보고 싶은 채널이나 주제를 먼저 고른 뒤 카테고리와 지역 필터를 조합해서 원하는 맛집을 찾아보세요.",
    topicLine: (topic: DiscoveryTopic) => `${topic.name}만 빠르게 둘러보는 탐색 화면입니다.`,
    episodeLine: (episode: DiscoveryTopicEpisode) =>
      `${episode.episode}에 소개된 맛집만 모아보는 화면입니다.`,
    topicShortcutLabel: "주제 바로가기",
    topicHeading: "내 주제",
    episodeHeading: "회차",
    categoryHeading: "카테고리",
    regionHeading: "지역",
    allLabel: "전체",
    episodeOpen: (count: number) => `${count}개 보기`,
    episodeClose: "닫기",
    clearFilters: "필터 전체 초기화",
    contextExploreAll: "전체 탐색",
    contextMapView: "지도에서 보기",
    contextTopicView: "주제 전체 보기",
    contextVideoView: "원본 영상 보기",
    resultsCount: (count: number) => `총 ${count.toLocaleString()}곳의 맛집`,
    emptyTitle: "해당 조건에 맞는 맛집이 아직 없어요.",
    emptyDescription:
      "선택한 주제, 카테고리, 지역 조건을 조금만 바꿔서 다시 찾아보세요.",
    loadMore: "스크롤하면 더 많은 맛집을 이어서 불러와요.",
    sponsoredLabel: "Sponsored",
    photoPending: "사진 준비 중",
    priceLabel: "대표 가격",
    menuFallback: "메뉴 정보가 아직 준비 중이에요.",
    recommendLabel: (count: number) => `추천 ${count}곳`,
    seoTitle: "맛집 탐색",
    seoDescription:
      "채널, 주제, 카테고리, 지역 필터를 조합해서 원하는 맛집을 탐색해보세요.",
  },
  en: {
    homeLabel: "Home",
    pageTitle: "Explore restaurants",
    pageDescription:
      "Start with a creator or curated topic, then combine cuisine and region filters to narrow the list.",
    topicLine: (topic: DiscoveryTopic) =>
      `You are browsing restaurants curated under ${topic.name}.`,
    episodeLine: (episode: DiscoveryTopicEpisode) =>
      `You are browsing only the restaurants featured in ${episode.episode}.`,
    topicShortcutLabel: "Topic shortcuts",
    topicHeading: "My topics",
    episodeHeading: "Episodes",
    categoryHeading: "Cuisine",
    regionHeading: "Region",
    allLabel: "All",
    episodeOpen: (count: number) => `${count} episodes`,
    episodeClose: "Close",
    clearFilters: "Clear all filters",
    contextExploreAll: "All explore",
    contextMapView: "View on map",
    contextTopicView: "Topic overview",
    contextVideoView: "Watch original video",
    resultsCount: (count: number) => `${count.toLocaleString()} restaurants`,
    emptyTitle: "No restaurant matches these filters yet.",
    emptyDescription:
      "Try another topic, cuisine, or region combination to broaden the results.",
    loadMore: "Scroll to load more restaurants.",
    sponsoredLabel: "Sponsored",
    photoPending: "Photo coming soon",
    priceLabel: "From",
    menuFallback: "Menu details are coming soon.",
    recommendLabel: (count: number) => `${count} picks`,
    seoTitle: "Explore restaurants",
    seoDescription:
      "Browse restaurants by creator, topic, cuisine, and region on Matpick.",
  },
} as const;

function sortText(a: string, b: string) {
  return a.localeCompare(b, "ko-KR");
}

function buildDiscoveryKey(kind: DiscoveryKind, id: string) {
  return `${kind}:${id}`;
}

function buildMapPathForTopic(topic: DiscoveryTopic) {
  if (topic.kind === "creator") {
    return `/map?type=creator&value=${encodeURIComponent(topic.targetId)}`;
  }

  return `/map?type=source&value=${encodeURIComponent(topic.targetId)}`;
}

function dedupeRestaurantsById(items: Restaurant[]) {
  return Array.from(new Map(items.map((restaurant) => [restaurant.id, restaurant])).values());
}

function SourceAvatarButton({
  option,
  selected,
  onClick,
  href,
  fallbackLabel,
}: {
  option: AvatarOption | null;
  selected: boolean;
  onClick?: () => void;
  href?: string;
  fallbackLabel: string;
}) {
  const label = option?.name ?? fallbackLabel;
  const inner = (
    <>
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
    </>
  );

  const className = "flex w-[74px] flex-shrink-0 flex-col items-center gap-2 text-center sm:w-[86px]";

  if (href) {
    return (
      <Link href={href} title={label} onClick={onClick} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" title={label} onClick={onClick} className={className}>
      {inner}
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

function RestaurantCard({
  restaurant,
  locale,
  copy,
  onSelect,
}: {
  restaurant: Restaurant;
  locale: AppLocale;
  copy: (typeof EXPLORE_COPY)[AppLocale];
  onSelect?: (restaurant: Restaurant) => void;
}) {
  const [, navigate] = useLocation();
  const creatorsForRestaurant = getCreatorsByRestaurant(restaurant.id);
  const sourcesForRestaurant = getSourcesByRestaurant(restaurant.id);
  const recommendationCount = getRecommendationCount(restaurant.id);
  const displayImage = getRestaurantDisplayImage(restaurant);
  const priceHint = getRestaurantPrimaryPrice(restaurant);
  const broadcastMeta = getRestaurantBroadcastMeta(restaurant.id);
  const foundingBadge = formatRestaurantFoundingBadge(restaurant.foundingYear, locale);
  const broadcastBadge = formatRestaurantBroadcastBadge(broadcastMeta, locale);

  return (
    <button
      type="button"
      onClick={() => {
        onSelect?.(restaurant);
        navigate(`/restaurant/${restaurant.id}`);
      }}
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
              {copy.photoPending}
            </span>
          ) : null}
          <span className="rounded-full bg-white/92 px-3 py-1 text-xs font-semibold text-[#555] backdrop-blur">
            {translateCuisineLabel(getCuisineCategory(restaurant.category), locale)}
          </span>
          {foundingBadge ? (
            <span className="rounded-full bg-[#fff3f4] px-3 py-1 text-xs font-semibold text-[#ff7b83]">
              {foundingBadge}
            </span>
          ) : null}
          {broadcastBadge ? (
            <span className="rounded-full bg-[#eef7ff] px-3 py-1 text-xs font-semibold text-[#3b82c4]">
              {broadcastBadge}
            </span>
          ) : null}
        </div>

        <div className="absolute right-4 top-4">
          <HeartButton restaurantId={restaurant.id} size="sm" className="shadow-md" />
        </div>

        {recommendationCount > 1 ? (
          <div className="absolute bottom-4 left-4 rounded-full bg-[#111111]/72 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            {copy.recommendLabel(recommendationCount)}
          </div>
        ) : null}
      </div>

      <div className="space-y-4 p-5">
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-[#181818]">{restaurant.name}</h3>
          <p className="text-sm text-[#8a8a8a]">{restaurant.address}</p>
          {priceHint ? (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b2a2a6]">
              {copy.priceLabel} {priceHint}
            </p>
          ) : null}
          <p className="text-sm font-medium text-[#ff7b83]">
            {getRestaurantMenuSummary(restaurant) || copy.menuFallback}
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

function buildSeoContent({
  locale,
  copy,
  presetTopic,
  presetEpisode,
}: {
  locale: AppLocale;
  copy: (typeof EXPLORE_COPY)[AppLocale];
  presetTopic: DiscoveryTopic | null;
  presetEpisode: DiscoveryTopicEpisode | null;
}) {
  const matchedCreator =
    presetTopic?.kind === "creator"
      ? creators.find((creator) => creator.id === presetTopic.targetId) ?? null
      : null;
  const topicKeyword = matchedCreator
    ? `${getCreatorDisplayName(matchedCreator)} ${presetTopic?.name ?? ""}`.trim()
    : presetTopic?.name ?? "";

  if (presetEpisode && presetTopic) {
    if (locale === "en") {
      return {
        title: `${topicKeyword} ${presetEpisode.episode} restaurant list`,
        description: `Browse the restaurant list featured in ${presetEpisode.episode} from ${topicKeyword} on Matpick.`,
      };
    }

    return {
      title: `${topicKeyword} ${presetEpisode.episode} 맛집 리스트`,
      description: `${topicKeyword} ${presetEpisode.episode}에 나온 맛집 리스트를 맛픽에서 지도와 함께 찾아보세요.`,
    };
  }

  if (presetTopic) {
    if (locale === "en") {
      return {
        title: `${topicKeyword} restaurant list`,
        description: `Explore the restaurant list curated under ${topicKeyword} on Matpick.`,
      };
    }

    return {
      title: `${topicKeyword} 맛집 리스트`,
      description: `${topicKeyword}에 포함된 맛집 리스트를 맛픽에서 지도와 함께 탐색해보세요.`,
    };
  }

  return {
    title: copy.seoTitle,
    description: copy.seoDescription,
  };
}

export default function Explore({ topicSlug, episodeSlug }: ExploreProps = {}) {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { locale } = useLocale();
  const copy = EXPLORE_COPY[locale];
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
    const sourceBackedCreatorIds = new Set(
      sources
        .map((source) => source.creatorId)
        .filter((creatorId): creatorId is string => Boolean(creatorId))
    );
    const creatorOptions = creators
      .filter((creator) => !sourceBackedCreatorIds.has(creator.id))
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
    () => discoveryOptions.filter((option) => !curatedDiscoveryKeySet.has(option.key)),
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
  const [isEpisodeMenuOpen, setIsEpisodeMenuOpen] = useState(Boolean(episodeSlug));
  const [visibleCount, setVisibleCount] = useState(60);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const seoContent = useMemo(
    () =>
      buildSeoContent({
        locale,
        copy,
        presetTopic,
        presetEpisode,
      }),
    [copy, locale, presetEpisode, presetTopic]
  );

  const seoPath = presetEpisode
    ? presetEpisode.path
    : presetTopic
      ? presetTopic.path
      : "/explore";

  const seoJsonLd = useMemo(() => {
    const items = [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: seoContent.title,
        description: seoContent.description,
        url: buildAbsoluteUrl(seoPath),
      },
    ] as Array<Record<string, unknown>>;

    if (presetTopic) {
      const breadcrumbItems: Array<Record<string, unknown>> = [
        {
          "@type": "ListItem",
          position: 1,
          name: "Matpick",
          item: buildAbsoluteUrl("/"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: copy.pageTitle,
          item: buildAbsoluteUrl("/explore"),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: presetTopic.name,
          item: buildAbsoluteUrl(presetTopic.path),
        },
      ];

      if (presetEpisode) {
        breadcrumbItems.push({
          "@type": "ListItem",
          position: 4,
          name: presetEpisode.episode,
          item: buildAbsoluteUrl(presetEpisode.path),
        });
      }

      items.push({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbItems,
      });
    }

    return items;
  }, [copy.pageTitle, presetEpisode, presetTopic, seoContent.description, seoContent.title, seoPath]);

  useSeo({
    title: seoContent.title,
    description: seoContent.description,
    path: seoPath,
    locale,
    jsonLd: seoJsonLd,
  });

  useEffect(() => {
    setSelectedDiscoveryKeys(initialSelectedKeys);
  }, [initialSelectedKeys]);

  useEffect(() => {
    setSelectedCategory(ALL_FILTER);
    setSelectedRegion(ALL_FILTER);
    setSelectedTopicId(ALL_FILTER);
  }, [episodeSlug, topicSlug]);

  useEffect(() => {
    setIsEpisodeMenuOpen(Boolean(episodeSlug));
  }, [episodeSlug, topicSlug]);

  useEffect(() => {
    setVisibleCount(60);
  }, [
    episodeSlug,
    selectedCategory,
    selectedDiscoveryKeys,
    selectedRegion,
    selectedTopicId,
    topicSlug,
  ]);

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

  const deferredRestaurants = useDeferredValue(filteredRestaurants);
  const visibleRestaurants = useMemo(
    () => deferredRestaurants.slice(0, visibleCount),
    [deferredRestaurants, visibleCount]
  );

  useEffect(() => {
    const target = loadMoreRef.current;

    if (!target || visibleCount >= deferredRestaurants.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          setVisibleCount((prev) => Math.min(prev + 60, deferredRestaurants.length));
        });
      },
      {
        rootMargin: "320px 0px",
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [deferredRestaurants.length, visibleCount]);

  const toggleDiscovery = (key: string) => {
    const option = discoveryOptions.find((entry) => entry.key === key);
    trackMarketingEvent("topic_filter_click", {
      topic_key: key,
      topic_name: option?.name ?? key,
      selected: !selectedDiscoveryKeys.includes(key),
    });

    if (presetTopic && key === presetTopic.key && selectedDiscoveryKeys.length === 1) {
      navigate("/explore");
      return;
    }

    setSelectedDiscoveryKeys((prev) =>
      prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key]
    );
  };

  const clearFilters = () => {
    trackMarketingEvent("explore_filters_clear", {
      topic_slug: presetTopic?.slug ?? "",
      episode_slug: presetEpisode?.slug ?? "",
    });
    setSelectedDiscoveryKeys([]);
    setSelectedCategory(ALL_FILTER);
    setSelectedRegion(ALL_FILTER);
    setSelectedTopicId(ALL_FILTER);
    navigate("/explore");
  };

  const hasActiveDiscovery = selectedDiscoveryKeys.length > 0;
  const hasActiveFilters =
    hasActiveDiscovery ||
    selectedCategory !== ALL_FILTER ||
    selectedRegion !== ALL_FILTER ||
    selectedTopicId !== ALL_FILTER ||
    Boolean(presetTopic) ||
    Boolean(presetEpisode);

  const topicLine = presetEpisode
    ? copy.episodeLine(presetEpisode)
    : presetTopic
      ? copy.topicLine(presetTopic)
      : "";
  const contextDescription = presetEpisode?.description || presetTopic?.description || "";
  const topicMapPath = presetTopic ? buildMapPathForTopic(presetTopic) : "";

  const handleCategorySelect = (category: string) => {
    trackMarketingEvent("category_filter_click", {
      category,
      topic_slug: presetTopic?.slug ?? "",
      episode_slug: presetEpisode?.slug ?? "",
    });
    setSelectedCategory(category);
  };

  const handleRegionSelect = (region: string) => {
    trackMarketingEvent("region_filter_click", {
      region,
      topic_slug: presetTopic?.slug ?? "",
      episode_slug: presetEpisode?.slug ?? "",
    });
    setSelectedRegion(region);
  };

  const handleFavoriteTopicSelect = (topicId: string) => {
    trackMarketingEvent("saved_topic_filter_click", {
      topic_id: topicId,
      selected: topicId !== ALL_FILTER,
    });
    setSelectedTopicId(topicId);
  };

  const handleRestaurantSelect = (restaurant: Restaurant) => {
    trackMarketingEvent("explore_restaurant_click", {
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.name,
      topic_slug: presetTopic?.slug ?? "",
      episode_slug: presetEpisode?.slug ?? "",
      category: selectedCategory,
      region: selectedRegion,
    });
  };

  useEffect(() => {
    trackMarketingEvent("explore_view", {
      topic_slug: presetTopic?.slug ?? "",
      episode_slug: presetEpisode?.slug ?? "",
      has_topic: Boolean(presetTopic),
      has_episode: Boolean(presetEpisode),
    });
  }, [presetEpisode?.slug, presetTopic?.slug]);

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
            {copy.homeLabel}
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-[#171717] sm:text-3xl">{copy.pageTitle}</h1>
          <p className="mt-2 text-sm leading-6 text-[#7f7f7f] sm:text-base">
            {copy.pageDescription}
          </p>
          {presetTopic ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-[#ff7b83] sm:text-sm">{topicLine}</p>
              {contextDescription ? (
                <p className="text-xs leading-6 text-[#8b8284] sm:text-sm">{contextDescription}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/explore"
                  onClick={() =>
                    trackMarketingEvent("explore_context_link_click", {
                      destination: "explore_all",
                      topic_slug: presetTopic.slug,
                      episode_slug: presetEpisode?.slug ?? "",
                    })
                  }
                  className="rounded-full border border-[#f0dadd] bg-white px-3 py-1.5 text-xs font-semibold text-[#6d6668] transition hover:border-[#ffc1c9] hover:text-[#ff6b7b]"
                >
                  {copy.contextExploreAll}
                </Link>
                <Link
                  href={topicMapPath}
                  onClick={() =>
                    trackMarketingEvent("explore_context_link_click", {
                      destination: "map",
                      topic_slug: presetTopic.slug,
                      episode_slug: presetEpisode?.slug ?? "",
                    })
                  }
                  className="rounded-full border border-[#f0dadd] bg-white px-3 py-1.5 text-xs font-semibold text-[#6d6668] transition hover:border-[#ffc1c9] hover:text-[#ff6b7b]"
                >
                  {copy.contextMapView}
                </Link>
                {presetEpisode ? (
                  <Link
                    href={presetTopic.path}
                    onClick={() =>
                      trackMarketingEvent("explore_context_link_click", {
                        destination: "topic_overview",
                        topic_slug: presetTopic.slug,
                        episode_slug: presetEpisode.slug,
                      })
                    }
                    className="rounded-full border border-[#f0dadd] bg-white px-3 py-1.5 text-xs font-semibold text-[#6d6668] transition hover:border-[#ffc1c9] hover:text-[#ff6b7b]"
                  >
                    {copy.contextTopicView}
                  </Link>
                ) : null}
                {presetEpisode?.videoUrl ? (
                  <a
                    href={presetEpisode.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() =>
                      trackMarketingEvent("episode_video_click", {
                        topic_slug: presetTopic.slug,
                        episode_slug: presetEpisode.slug,
                      })
                    }
                    className="rounded-full border border-[#f0dadd] bg-white px-3 py-1.5 text-xs font-semibold text-[#6d6668] transition hover:border-[#ffc1c9] hover:text-[#ff6b7b]"
                  >
                    {copy.contextVideoView}
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </header>
        <section className="mb-8 rounded-[28px] border border-[#f0ebec] bg-white p-4 shadow-[0_10px_36px_rgba(0,0,0,0.04)] sm:p-5">
          <div className="mb-4">
            <p className="mb-3 text-xs font-semibold tracking-[0.08em] text-[#b58f95]">
              {copy.topicShortcutLabel}
            </p>
            <div className="-mx-1 overflow-x-auto pb-2">
              <div className="flex min-w-max gap-4 px-1">
                <SourceAvatarButton
                  option={null}
                  selected={!presetTopic}
                  onClick={() => {
                    trackMarketingEvent("topic_shortcut_click", {
                      topic_slug: "all",
                      source: "explore",
                    });
                    navigate("/explore");
                  }}
                  fallbackLabel={copy.allLabel}
                />
                {discoveryTopics.map((topic) => (
                  <SourceAvatarButton
                    key={topic.slug}
                    option={{ name: topic.name, imageUrl: topic.imageUrl }}
                    selected={topic.slug === topicSlug}
                    href={topic.slug === topicSlug ? "/explore" : topic.path}
                    onClick={() =>
                      trackMarketingEvent("topic_shortcut_click", {
                        topic_slug: topic.slug,
                        source: "explore",
                      })
                    }
                    fallbackLabel={copy.allLabel}
                  />
                ))}
              </div>
            </div>
          </div>

          {additionalDiscoveryOptions.length > 0 ? (
            <div className="-mx-1 overflow-x-auto pb-2">
              <div className="flex min-w-max gap-4 px-1">
                {additionalDiscoveryOptions.map((option) => (
                  <SourceAvatarButton
                    key={option.key}
                    option={option}
                    selected={selectedDiscoveryKeys.includes(option.key)}
                    onClick={() => toggleDiscovery(option.key)}
                    fallbackLabel={copy.allLabel}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 space-y-4 border-t border-[#f5f0f1] pt-4 sm:mt-5 sm:pt-5">
            {presetTopic && topicEpisodes.length > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-sm font-semibold text-[#666]">{copy.episodeHeading}</span>
                  <button
                    type="button"
                    onClick={() => setIsEpisodeMenuOpen((prev) => !prev)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                      isEpisodeMenuOpen
                        ? "border-[#ff7b83] bg-[#fff4f6] text-[#ff7b83]"
                        : "border-[#ebe6e7] bg-white text-[#666] hover:border-[#ffd1d7] hover:text-[#ff7b83]"
                    }`}
                  >
                    <span>{presetEpisode ? presetEpisode.episode : copy.allLabel}</span>
                    <span className="text-[11px] text-[#b58f95]">
                      {isEpisodeMenuOpen
                        ? copy.episodeClose
                        : copy.episodeOpen(topicEpisodes.length)}
                    </span>
                  </button>
                </div>

                {isEpisodeMenuOpen ? (
                  <div className="rounded-[22px] border border-[#f1e7e9] bg-[#fffafb] p-3">
                    <div className="max-h-[230px] overflow-y-auto pr-1">
                      <div className="flex flex-wrap gap-2">
                        <FilterChip
                          label={copy.allLabel}
                          selected={!presetEpisode}
                          onClick={() => {
                            setIsEpisodeMenuOpen(false);
                            trackMarketingEvent("episode_filter_click", {
                              topic_slug: presetTopic.slug,
                              episode_slug: "all",
                            });
                            navigate(presetTopic.path);
                          }}
                        />
                        {topicEpisodes.map((episode) => (
                          <FilterChip
                            key={episode.slug}
                            label={episode.episode}
                            selected={presetEpisode?.slug === episode.slug}
                            onClick={() => {
                              setIsEpisodeMenuOpen(false);
                              trackMarketingEvent("episode_filter_click", {
                                topic_slug: presetTopic.slug,
                                episode_slug: episode.slug,
                              });
                              navigate(episode.path);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {topics.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-sm font-semibold text-[#666]">{copy.topicHeading}</span>
                <FilterChip
                  label={copy.allLabel}
                  selected={selectedTopicId === ALL_FILTER}
                  onClick={() => handleFavoriteTopicSelect(ALL_FILTER)}
                />
                {topics.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => handleFavoriteTopicSelect(topic.id)}
                    className="transition"
                    title={`${topic.name} (${getTopicRestaurantCount(topic.id)})`}
                  >
                    <FavoriteTopicBadge topic={topic} active={selectedTopicId === topic.id} />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-semibold text-[#666]">{copy.categoryHeading}</span>
              <FilterChip
                label={copy.allLabel}
                selected={selectedCategory === ALL_FILTER}
                onClick={() => handleCategorySelect(ALL_FILTER)}
              />
              {categories.map((category) => (
                <FilterChip
                  key={category}
                  label={translateCuisineLabel(category, locale)}
                  selected={selectedCategory === category}
                  onClick={() => handleCategorySelect(category)}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-semibold text-[#666]">{copy.regionHeading}</span>
              <FilterChip
                label={copy.allLabel}
                tone="peach"
                selected={selectedRegion === ALL_FILTER}
                onClick={() => handleRegionSelect(ALL_FILTER)}
              />
              {regions.map((region) => (
                <FilterChip
                  key={region}
                  label={region}
                  tone="peach"
                  selected={selectedRegion === region}
                  onClick={() => handleRegionSelect(region)}
                />
              ))}
            </div>
          </div>
        </section>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#888]">
            <span className="font-bold text-[#ff7b83]">{copy.resultsCount(filteredRestaurants.length)}</span>
          </p>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-semibold text-[#ff7b83] transition hover:opacity-75"
            >
              {copy.clearFilters}
            </button>
          ) : null}
        </div>

        <div className="mb-6">
          <MonetizationSlot label={copy.sponsoredLabel} />
        </div>

        {filteredRestaurants.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {visibleRestaurants.flatMap((restaurant, index) => {
              const items = [
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  locale={locale}
                  copy={copy}
                  onSelect={handleRestaurantSelect}
                />,
              ];

              if ((index + 1) % 12 === 0 && index + 1 < visibleRestaurants.length) {
                items.push(
                  <div
                    key={`adsense-inline-${restaurant.id}`}
                    className="sm:col-span-2 lg:col-span-3"
                  >
                    <AdsenseSlot label={copy.sponsoredLabel} />
                  </div>
                );
              }

              return items;
            })}
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-[#ecdfe2] bg-white px-6 py-16 text-center sm:py-20">
            <p className="text-5xl">⌕</p>
            <p className="mt-4 text-lg font-semibold text-[#333]">{copy.emptyTitle}</p>
            <p className="mt-2 text-sm leading-6 text-[#8a8a8a]">{copy.emptyDescription}</p>
          </div>
        )}

        {visibleCount < deferredRestaurants.length ? (
          <div ref={loadMoreRef} className="py-8 text-center text-sm font-medium text-[#9a8f92]">
            {copy.loadMore}
          </div>
        ) : null}
      </main>
    </div>
  );
}
