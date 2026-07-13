import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  Heart,
  MapPin,
  MessageCircleMore,
  PlayCircle,
  Search,
  Send,
  Share2,
} from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import ttoganjipCardAssets from "@/data/generated/ttoganjip-card-assets.json";
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
  getDiscoveryTopicByTarget,
  getDiscoveryTopicEpisodeBySlug,
  getDiscoveryTopicEpisodes,
  getRecommendationCount,
  getRegions,
  getRestaurantMenuSummary,
  getRestaurantsByCreator,
  getSourceRestaurantCount,
  getSourceDisplayName,
  getSourceSubdivisions,
  getSourcesByRestaurant,
  publicDiscoveryTopics,
  restaurantMatchesSourceSubdivision,
  restaurants,
  sources,
  type DiscoveryTopic,
  type DiscoveryTopicEpisode,
  type Restaurant,
} from "@/data";
import {
  featuredMapCollections,
  getMapCollectionPath,
  type MapCollectionTopic,
} from "@/data/mapCollections";
import HeartButton from "@/components/HeartButton";
import { FavoriteTopicBadge } from "@/components/FavoriteTopicDialog";
import { RevenuePlacement } from "@/components/monetization/MonetizationSlot";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useLocale } from "@/contexts/LocaleContext";
import { translateCuisineLabel, type AppLocale } from "@/lib/locale";
import { trackMarketingEvent } from "@/lib/marketing";
import { getOptimizedCardImageUrl } from "@/lib/imagePreviews";
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

type EpisodeStorySlide = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  tags: string[];
  background: string;
  imageUrl?: string;
};

type TtoganjipCardAssetEpisode = {
  episodeNumber: number;
  label: string;
  mainImageUrl?: string | null;
  cards: Array<{
    ordinal: number;
    title: string;
    originalFileName: string;
    imageUrl: string;
  }>;
};

type EpisodeComment = {
  id: string;
  text: string;
  createdAt: string;
};

type EpisodeSocialState = {
  likedEpisodeSlugs: string[];
  commentsByEpisodeSlug: Record<string, EpisodeComment[]>;
  shareCountsByEpisodeSlug: Record<string, number>;
};

const EPISODE_CARD_PALETTES = [
  "linear-gradient(145deg, #261f3f 0%, #6d4ec1 48%, #ff8aa4 100%)",
  "linear-gradient(145deg, #18324a 0%, #2878a5 52%, #8fd8ff 100%)",
  "linear-gradient(145deg, #24362d 0%, #3d8265 52%, #ffd47f 100%)",
  "linear-gradient(145deg, #3b211b 0%, #aa5138 52%, #ffd0b4 100%)",
  "linear-gradient(145deg, #252525 0%, #59606b 52%, #f7b267 100%)",
];

const EPISODE_SOCIAL_STORAGE_KEY = "matpick:episode-card-social:v1";
const ttoganjipCardAssetsByLabel = new Map(
  (ttoganjipCardAssets.episodes as TtoganjipCardAssetEpisode[]).map((episode) => [
    episode.label,
    episode,
  ])
);
const POPULAR_RESTAURANT_TOPIC_EXCLUDED_COLLECTION_SLUGS = new Set([
  "popular-dongtan-best7",
]);

const emptyEpisodeSocialState: EpisodeSocialState = {
  likedEpisodeSlugs: [],
  commentsByEpisodeSlug: {},
  shareCountsByEpisodeSlug: {},
};

function getEpisodeSocialState(): EpisodeSocialState {
  if (typeof window === "undefined") {
    return emptyEpisodeSocialState;
  }

  try {
    const raw = window.localStorage.getItem(EPISODE_SOCIAL_STORAGE_KEY);
    if (!raw) {
      return emptyEpisodeSocialState;
    }

    const parsed = JSON.parse(raw) as Partial<EpisodeSocialState>;
    return {
      likedEpisodeSlugs: Array.isArray(parsed.likedEpisodeSlugs)
        ? parsed.likedEpisodeSlugs
        : [],
      commentsByEpisodeSlug:
        parsed.commentsByEpisodeSlug && typeof parsed.commentsByEpisodeSlug === "object"
          ? parsed.commentsByEpisodeSlug
          : {},
      shareCountsByEpisodeSlug:
        parsed.shareCountsByEpisodeSlug && typeof parsed.shareCountsByEpisodeSlug === "object"
          ? parsed.shareCountsByEpisodeSlug
          : {},
    };
  } catch {
    return emptyEpisodeSocialState;
  }
}

function saveEpisodeSocialState(nextState: EpisodeSocialState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(EPISODE_SOCIAL_STORAGE_KEY, JSON.stringify(nextState));
}

const EXPLORE_COPY = {
  ko: {
    homeLabel: "홈으로",
    pageTitle: "맛집 탐색",
    pageDescription:
      "또간집부터 미쉐린까지, 앞으로 추가될 주제별 맛집 카드를 골라 보고 지도에서 바로 확인해보세요.",
    topicLine: (topic: DiscoveryTopic) => `${topic.name}만 빠르게 둘러보는 탐색 화면입니다.`,
    episodeLine: (episode: DiscoveryTopicEpisode) =>
      `${episode.episode}에 소개된 맛집만 모아보는 화면입니다.`,
    topicShortcutLabel: "주제 바로가기",
    topicHeading: "내 주제",
    episodeHeading: "회차",
    subdivisionHeading: "구분",
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
      "Choose a theme like Ttoganjip or Michelin, browse its restaurant cards, then open the matching places on the map.",
    topicLine: (topic: DiscoveryTopic) =>
      `You are browsing restaurants curated under ${topic.name}.`,
    episodeLine: (episode: DiscoveryTopicEpisode) =>
      `You are browsing only the restaurants featured in ${episode.episode}.`,
    topicShortcutLabel: "Topic shortcuts",
    topicHeading: "My topics",
    episodeHeading: "Episodes",
    subdivisionHeading: "Distinction",
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

function buildMapPathForEpisode(episode: DiscoveryTopicEpisode) {
  return `/map?type=episode&topic=${encodeURIComponent(
    episode.topicSlug
  )}&value=${encodeURIComponent(episode.slug)}`;
}

function dedupeRestaurantsById(items: Restaurant[]) {
  return Array.from(new Map(items.map((restaurant) => [restaurant.id, restaurant])).values());
}

function getRestaurantsForEpisode(episode: DiscoveryTopicEpisode) {
  const restaurantIds = new Set(episode.restaurantIds);
  return restaurants.filter((restaurant) => restaurantIds.has(restaurant.id));
}

function getEpisodeDisplayTitle(episode: DiscoveryTopicEpisode) {
  return episode.title || episode.videoTitle || episode.episode;
}

function getEpisodeCardTitle(episode: DiscoveryTopicEpisode) {
  const title = getEpisodeDisplayTitle(episode);
  return title.replace(/^\[[^\]]+\]\s*/, "").trim() || episode.episode;
}

function getEpisodeCardPalette(index: number) {
  return EPISODE_CARD_PALETTES[index % EPISODE_CARD_PALETTES.length];
}

function getEpisodeMainImageUrl(episode: DiscoveryTopicEpisode) {
  if (episode.topicSlug !== "ttoganjip") {
    return "";
  }

  return ttoganjipCardAssetsByLabel.get(episode.episode)?.mainImageUrl ?? "";
}

function buildEpisodeStorySlides({
  episode,
  topic,
  locale,
}: {
  episode: DiscoveryTopicEpisode;
  topic: DiscoveryTopic;
  locale: AppLocale;
}): EpisodeStorySlide[] {
  const episodeRestaurants = getRestaurantsForEpisode(episode);
  const restaurantSlides = episodeRestaurants.map((restaurant, index) => ({
    id: `restaurant-${restaurant.id}`,
    eyebrow: locale === "en" ? `Pick ${index + 1}` : `맛집 ${index + 1}`,
    title: restaurant.name,
    description:
      getRestaurantMenuSummary(restaurant) ||
      restaurant.address ||
      (locale === "en" ? "Restaurant details are coming soon." : "식당 정보를 정리 중입니다."),
    tags: [
      restaurant.category || (locale === "en" ? "Restaurant" : "맛집"),
      getRestaurantPrimaryPrice(restaurant) || restaurant.region || "",
    ].filter(Boolean),
    background: getEpisodeCardPalette(index + 1),
    imageUrl: getRestaurantDisplayImage(restaurant).src,
  }));

  return [
    {
      id: "cover",
      eyebrow: `${topic.name} ${episode.episode}`,
      title: getEpisodeCardTitle(episode),
      description:
        episode.description ||
        (locale === "en"
          ? `${episode.count} restaurants featured in this episode.`
          : `이 회차에 소개된 맛집 ${episode.count}곳을 모았습니다.`),
      tags: [
        locale === "en" ? `${episode.count} places` : `${episode.count}곳`,
        locale === "en" ? "Episode" : "회차별 카드",
      ],
      background: getEpisodeCardPalette(0),
      imageUrl: getEpisodeMainImageUrl(episode) || undefined,
    },
    ...restaurantSlides,
  ];
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
  imageIndex,
  locale,
  copy,
  onSelect,
}: {
  restaurant: Restaurant;
  imageIndex: number;
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
      className="group self-start overflow-hidden rounded-[26px] border border-[#f0ebec] bg-white text-left shadow-[0_8px_28px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-0.5 hover:border-[#ffd0d5] hover:shadow-[0_16px_42px_rgba(253,121,121,0.14)]"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-[#211f22]">
        <img
          src={displayImage.src}
          alt={restaurant.name}
          className="h-full w-full object-contain"
          width={1122}
          height={1402}
          loading={imageIndex < 3 ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={imageIndex === 0 ? "high" : imageIndex < 3 ? "auto" : "low"}
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
          <h3 className="line-clamp-1 text-lg font-bold text-[#181818]">{restaurant.name}</h3>
          <p className="line-clamp-2 min-h-[2.625rem] text-sm text-[#8a8a8a]">
            {restaurant.address}
          </p>
          {priceHint ? (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b2a2a6]">
              {copy.priceLabel} {priceHint}
            </p>
          ) : null}
          <p className="line-clamp-3 min-h-[3.9375rem] text-sm font-medium text-[#ff7b83]">
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
              title={getSourceDisplayName(source)}
              className="inline-flex max-w-[170px] items-center rounded-full border border-[#f1ddaf] bg-[#fff8e8] px-3 py-1 text-xs font-semibold text-[#b67b19]"
            >
              <span className="truncate">{getSourceDisplayName(source)}</span>
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

function TtoganjipEpisodeGrid({
  topic,
  episodes,
  locale,
  onOpen,
}: {
  topic: DiscoveryTopic;
  episodes: DiscoveryTopicEpisode[];
  locale: AppLocale;
  onOpen: (index: number) => void;
}) {
  const title =
    locale === "en" ? `${topic.name} episode cards` : `${topic.name} 회차별 맛집 카드`;
  const description =
    locale === "en"
      ? "Ttoganjip is the first theme here. More themes such as Michelin will be added later in the same card format."
      : "지금은 또간집 회차별 맛집을 먼저 보여드리고, 이후 미쉐린 같은 주제도 같은 카드 형식으로 추가할 예정입니다.";

  if (episodes.length === 0) {
    return (
      <section className="rounded-[28px] border border-dashed border-[#ecdfe2] bg-white px-6 py-16 text-center sm:py-20">
        <p className="text-lg font-semibold text-[#333]">
          {locale === "en" ? "Episode cards are coming soon." : "회차 카드가 준비 중입니다."}
        </p>
      </section>
    );
  }

  return (
    <section className="mb-10">
      <div className="mb-5 flex flex-col gap-2 sm:mb-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff7b83]">
          Ttoganjip
        </p>
        <h2 className="break-keep text-2xl font-black leading-tight text-[#171717] sm:text-3xl">
          {title}
        </h2>
        <p className="max-w-3xl break-keep text-sm leading-6 text-[#7f7f7f] sm:text-base">
          {description}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {episodes.map((episode, index) => (
          <EpisodeCollectionCard
            key={episode.slug}
            episode={episode}
            index={index}
            locale={locale}
            onOpen={() => onOpen(index)}
          />
        ))}
      </div>
    </section>
  );
}

function PopularRestaurantCollectionGrid({
  topic,
  collections,
  locale,
}: {
  topic: DiscoveryTopic;
  collections: MapCollectionTopic[];
  locale: AppLocale;
}) {
  const visibleCollections = collections.filter(
    (collection) => !POPULAR_RESTAURANT_TOPIC_EXCLUDED_COLLECTION_SLUGS.has(collection.slug)
  );
  const title =
    locale === "en" ? `${topic.name} card collections` : `${topic.name} 카드 묶음`;
  const description =
    locale === "en"
      ? "Popular restaurant content is organized as card collections first. Open a card to see only the matching restaurants on the map."
      : "인기맛집은 식당을 한꺼번에 늘어놓지 않고 카드 묶음 단위로 정리합니다. 카드를 열면 해당 카드에 연결된 맛집만 지도에서 볼 수 있어요.";

  return (
    <section className="mb-10">
      <div className="mb-5 flex flex-col gap-2 sm:mb-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff7b83]">
          Popular
        </p>
        <h2 className="break-keep text-2xl font-black leading-tight text-[#171717] sm:text-3xl">
          {title}
        </h2>
        <p className="max-w-3xl break-keep text-sm leading-6 text-[#7f7f7f] sm:text-base">
          {description}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visibleCollections.map((collection, index) => (
          <Link
            key={collection.slug}
            href={getMapCollectionPath(collection.slug)}
            onClick={() =>
              trackMarketingEvent("popular_collection_card_click", {
                collection_slug: collection.slug,
                collection_title: collection.title,
              })
            }
            className="group relative aspect-[1122/1402] w-full overflow-hidden rounded-[8px] text-left text-white shadow-[0_18px_45px_rgba(28,24,34,0.16)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_60px_rgba(28,24,34,0.22)]"
            style={{ background: collection.palette.background }}
            aria-label={`${collection.title} ${locale === "en" ? "open map" : "지도 보기"}`}
          >
            {collection.imageUrl ? (
              <img
                src={getOptimizedCardImageUrl(collection.imageUrl)}
                alt=""
                className="absolute inset-0 h-full w-full object-contain"
                width={1122}
                height={1402}
                loading={index < 3 ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={index === 0 ? "high" : index < 3 ? "auto" : "low"}
              />
            ) : null}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.22)_44%,rgba(0,0,0,0.62))]" />
            <div className="relative z-10 flex h-full flex-col justify-between p-5 sm:p-6">
              <div>
                <p className="text-sm font-black leading-5 text-white/80">
                  {locale === "en" ? `Card ${index + 1}` : `카드 ${index + 1}`}
                </p>
                <h3 className="mt-8 break-keep text-[28px] font-black leading-[1.08] tracking-normal sm:text-[31px]">
                  {collection.title}
                </h3>
              </div>

              <div>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-black">
                    {locale === "en"
                      ? `${collection.targetCount} places`
                      : `${collection.targetCount}곳`}
                  </span>
                  {collection.purposeTags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-black"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="line-clamp-2 break-keep text-[13px] font-semibold leading-5 text-white/80">
                  {collection.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SourceRestaurantCollectionGrid({
  topic,
  restaurants,
  totalCount,
  locale,
  copy,
  onSelect,
}: {
  topic: DiscoveryTopic;
  restaurants: Restaurant[];
  totalCount: number;
  locale: AppLocale;
  copy: (typeof EXPLORE_COPY)[AppLocale];
  onSelect: (restaurant: Restaurant) => void;
}) {
  const eyebrow =
    topic.slug === "old-korean-100"
      ? "Korean 100"
      : topic.slug === "baekjong-wok"
        ? "Baekjong"
        : topic.slug === "michelin"
          ? "Michelin"
          : "Topic";
  const title =
    locale === "en" ? `${topic.name} restaurant cards` : `${topic.name} 맛집 카드`;
  const description =
    topic.description ||
    (locale === "en"
      ? "Browse the restaurants in this topic as visual cards."
      : "이 주제에 포함된 맛집을 카드 형태로 모아봤어요.");

  if (restaurants.length === 0) {
    return (
      <section className="rounded-[28px] border border-dashed border-[#ecdfe2] bg-white px-6 py-16 text-center sm:py-20">
        <p className="text-lg font-semibold text-[#333]">{copy.emptyTitle}</p>
        <p className="mt-2 text-sm leading-6 text-[#8a8a8a]">{copy.emptyDescription}</p>
      </section>
    );
  }

  return (
    <section className="mb-10">
      <div className="mb-5 flex flex-col gap-2 sm:mb-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff7b83]">
          {eyebrow}
        </p>
        <h2 className="break-keep text-2xl font-black leading-tight text-[#171717] sm:text-3xl">
          {title}
        </h2>
        <p className="max-w-3xl break-keep text-sm leading-6 text-[#7f7f7f] sm:text-base">
          {description}
        </p>
        <p className="text-sm font-bold text-[#ff7b83]">
          {copy.resultsCount(totalCount)}
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {restaurants.map((restaurant, index) => (
          <RestaurantCard
            key={restaurant.id}
            restaurant={restaurant}
            imageIndex={index}
            locale={locale}
            copy={copy}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

function EpisodeCollectionCard({
  episode,
  index,
  locale,
  onOpen,
}: {
  episode: DiscoveryTopicEpisode;
  index: number;
  locale: AppLocale;
  onOpen: () => void;
}) {
  const mainImageUrl = getEpisodeMainImageUrl(episode);

  return (
    <button
      type="button"
      onClick={() => {
        trackMarketingEvent("ttoganjip_episode_card_click", {
          episode_slug: episode.slug,
          episode_label: episode.episode,
        });
        onOpen();
      }}
      className="group relative aspect-[2/3] w-full overflow-hidden rounded-[8px] text-left text-white shadow-[0_18px_45px_rgba(28,24,34,0.16)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_60px_rgba(28,24,34,0.22)]"
      style={{ background: getEpisodeCardPalette(index) }}
      aria-label={`${episode.episode} ${locale === "en" ? "open card" : "카드 보기"}`}
    >
      {mainImageUrl ? (
        <img
          src={getOptimizedCardImageUrl(mainImageUrl)}
          alt=""
          className="absolute inset-0 h-full w-full object-contain"
          width={1122}
          height={1402}
          loading={index < 4 ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={index === 0 ? "high" : index < 4 ? "auto" : "low"}
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.16),rgba(0,0,0,0.28)_42%,rgba(0,0,0,0.72))]" />
      {!mainImageUrl ? (
        <div className="absolute -right-10 top-8 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
      ) : null}
      <div className="relative z-10 flex h-full flex-col justify-between p-5 sm:p-6">
        <div>
          <p className="text-sm font-black leading-5 text-white/80">{episode.episode}</p>
          <h3 className="mt-8 break-keep text-[28px] font-black leading-[1.08] tracking-normal sm:text-[31px]">
            {getEpisodeCardTitle(episode)}
          </h3>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-black">
              {locale === "en" ? `${episode.count} places` : `${episode.count}곳`}
            </span>
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-black">
              {locale === "en" ? "Map ready" : "지도 보기"}
            </span>
          </div>
          <p className="line-clamp-2 break-keep text-[13px] font-semibold leading-5 text-white/80">
            {episode.description}
          </p>
        </div>
      </div>
    </button>
  );
}

function EpisodeStoryModal({
  topic,
  episode,
  locale,
  onClose,
}: {
  topic: DiscoveryTopic;
  episode: DiscoveryTopicEpisode;
  locale: AppLocale;
  onClose: () => void;
}) {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [socialState, setSocialState] = useState<EpisodeSocialState>(getEpisodeSocialState);
  const [commentDraft, setCommentDraft] = useState("");
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const slides = useMemo(
    () => buildEpisodeStorySlides({ episode, topic, locale }),
    [episode, locale, topic]
  );
  const mapPath = buildMapPathForEpisode(episode);
  const episodeKey = `${episode.topicSlug}:${episode.slug}`;
  const comments = socialState.commentsByEpisodeSlug[episodeKey] ?? [];
  const isLiked = socialState.likedEpisodeSlugs.includes(episodeKey);
  const likeCount = isLiked ? 1 : 0;
  const commentCount = comments.length;
  const shareCount = socialState.shareCountsByEpisodeSlug[episodeKey] ?? 0;

  const goToSlide = useCallback(
    (index: number) => {
      setActiveSlideIndex((index + slides.length) % slides.length);
    },
    [slides.length]
  );

  const updateSocialState = useCallback((nextState: EpisodeSocialState) => {
    setSocialState(nextState);
    saveEpisodeSocialState(nextState);
  }, []);

  const handleLike = useCallback(() => {
    const nextLikedEpisodeSlugs = isLiked
      ? socialState.likedEpisodeSlugs.filter((slug) => slug !== episodeKey)
      : [...socialState.likedEpisodeSlugs, episodeKey];

    updateSocialState({
      ...socialState,
      likedEpisodeSlugs: nextLikedEpisodeSlugs,
    });

    trackMarketingEvent("ttoganjip_episode_like_toggle", {
      episode_slug: episode.slug,
      liked: !isLiked,
    });
  }, [episode.slug, episodeKey, isLiked, socialState, updateSocialState]);

  const handleCommentSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const text = commentDraft.trim();

      if (!text) {
        return;
      }

      const newComment: EpisodeComment = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}`,
        text,
        createdAt: new Date().toISOString(),
      };

      updateSocialState({
        ...socialState,
        commentsByEpisodeSlug: {
          ...socialState.commentsByEpisodeSlug,
          [episodeKey]: [newComment, ...comments].slice(0, 8),
        },
      });
      setCommentDraft("");

      trackMarketingEvent("ttoganjip_episode_comment_add", {
        episode_slug: episode.slug,
      });
    },
    [commentDraft, comments, episode.slug, episodeKey, socialState, updateSocialState]
  );

  const handleShare = useCallback(async () => {
    const shareUrl =
      typeof window !== "undefined" ? `${window.location.origin}${mapPath}` : mapPath;

    try {
      if (navigator.share) {
        await navigator.share({
          title: getEpisodeDisplayTitle(episode),
          text: episode.description,
          url: shareUrl,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        throw new Error("Share is not available");
      }

      updateSocialState({
        ...socialState,
        shareCountsByEpisodeSlug: {
          ...socialState.shareCountsByEpisodeSlug,
          [episodeKey]: shareCount + 1,
        },
      });

      trackMarketingEvent("ttoganjip_episode_share", {
        episode_slug: episode.slug,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
    }
  }, [episode, episodeKey, mapPath, shareCount, socialState, updateSocialState]);

  const handleTouchEnd = (clientX: number) => {
    if (touchStartX === null) {
      return;
    }

    const deltaX = touchStartX - clientX;
    setTouchStartX(null);

    if (Math.abs(deltaX) < 48) {
      return;
    }

    goToSlide(activeSlideIndex + (deltaX > 0 ? 1 : -1));
  };

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (event.key === "Escape") {
        if (isCommentsOpen) {
          setIsCommentsOpen(false);
          return;
        }

        onClose();
      }

      if (isTyping) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToSlide(activeSlideIndex + 1);
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToSlide(activeSlideIndex - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSlideIndex, goToSlide, isCommentsOpen, onClose]);

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex items-center justify-center overflow-hidden bg-[#070b10] px-3 py-4 text-white sm:px-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={getEpisodeDisplayTitle(episode)}
    >
      <div
        className="relative h-[min(740px,calc(100vh-2rem))] w-full max-w-[720px] overflow-hidden rounded-[24px] bg-[#070b10] shadow-[0_28px_90px_rgba(0,0,0,0.32)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute left-4 top-4 z-30 flex h-12 w-12 items-center justify-center rounded-full text-white transition hover:bg-white/10 sm:left-6 sm:top-6"
          aria-label={locale === "en" ? "Close" : "닫기"}
        >
          <ChevronLeft className="h-9 w-9" strokeWidth={2.1} />
        </button>

        <div className="grid h-full grid-cols-[minmax(0,1fr)_86px] gap-3 px-4 pb-4 pt-14 sm:grid-cols-[minmax(0,1fr)_112px] sm:gap-5 sm:px-5 sm:pb-5">
          <div className="flex min-w-0 flex-col items-center">
            <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
              <div
                className="relative aspect-[2/3] h-full max-h-[640px] max-w-full overflow-hidden rounded-[6px] bg-[#070b10] shadow-[0_26px_80px_rgba(0,0,0,0.45)]"
                onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
                onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
              >
                <div
                  className="flex h-full transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(-${activeSlideIndex * 100}%)` }}
                >
                  {slides.map((slide) => (
                    <EpisodeStorySlideView key={slide.id} slide={slide} />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => goToSlide(activeSlideIndex - 1)}
                  className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur transition hover:bg-black/50"
                  aria-label={locale === "en" ? "Previous card" : "이전 카드"}
                >
                  <ChevronLeft className="h-6 w-6" strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  onClick={() => goToSlide(activeSlideIndex + 1)}
                  className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur transition hover:bg-black/50"
                  aria-label={locale === "en" ? "Next card" : "다음 카드"}
                >
                  <ChevronRight className="h-6 w-6" strokeWidth={2.2} />
                </button>

                <div className="absolute bottom-7 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/20 px-3 py-2 backdrop-blur">
                  {slides.map((slide, index) => (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => goToSlide(index)}
                      className={`h-2 rounded-full transition-all ${
                        index === activeSlideIndex ? "w-5 bg-white" : "w-2 bg-white/55"
                      }`}
                      aria-label={`${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCommentsOpen(true)}
              className="mt-3 flex w-full max-w-[336px] items-center rounded-full bg-[#252a30] px-4 py-3 text-left text-sm font-semibold text-white/72 transition hover:bg-[#2d333a]"
            >
              {locale === "en" ? "Leave a comment" : "댓글을 남겨보세요"}
            </button>
          </div>

          <aside className="flex min-h-0 flex-col pt-2">
            <div className="flex flex-col items-center gap-4">
              <EpisodeStoryActionButton
                icon={<Heart className={`h-7 w-7 ${isLiked ? "fill-current" : ""}`} />}
                label={likeCount.toLocaleString()}
                active={isLiked}
                ariaLabel={locale === "en" ? "Like" : "좋아요"}
                onClick={handleLike}
              />
              <EpisodeStoryActionButton
                icon={<MessageCircleMore className="h-7 w-7" />}
                label={commentCount.toLocaleString()}
                ariaLabel={locale === "en" ? "Comment" : "댓글"}
                onClick={() => setIsCommentsOpen(true)}
              />
              <EpisodeStoryActionButton
                icon={<Share2 className="h-7 w-7" />}
                label={shareCount.toLocaleString()}
                ariaLabel={locale === "en" ? "Share" : "공유"}
                onClick={handleShare}
              />
              <Link
                href={mapPath}
                onClick={() =>
                  trackMarketingEvent("ttoganjip_episode_modal_map_click", {
                    episode_slug: episode.slug,
                  })
                }
                className="flex flex-col items-center gap-1 text-center text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)] transition hover:text-[#ff9ea9]"
                aria-label={locale === "en" ? "View on map" : "지도에서 보기"}
              >
                <MapPin className="h-7 w-7" />
                <span className="text-[11px] font-bold leading-4">
                  {locale === "en" ? "View on map" : "지도에서 보기"}
                </span>
              </Link>

              {episode.videoUrl ? (
                <a
                  href={episode.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() =>
                    trackMarketingEvent("ttoganjip_episode_modal_video_click", {
                      episode_slug: episode.slug,
                    })
                  }
                  className="flex flex-col items-center gap-1 text-center text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)] transition hover:text-[#ff9ea9]"
                >
                  <PlayCircle className="h-7 w-7" />
                  <span className="text-[11px] font-bold leading-4">
                    {locale === "en" ? "Video" : "영상"}
                  </span>
                </a>
              ) : null}
            </div>
          </aside>
        </div>

        <div className="pointer-events-none absolute bottom-5 left-5 z-20 max-w-[360px] text-left sm:left-6">
          <p className="line-clamp-1 text-xs font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]">
            {topic.name} · {episode.episode}
          </p>
        </div>

        {isCommentsOpen ? (
          <div
            className="absolute inset-0 z-40 flex items-end bg-black/45"
            onClick={() => setIsCommentsOpen(false)}
          >
            <section
              className="flex max-h-[78%] w-full flex-col overflow-hidden rounded-t-[28px] border-t border-white/10 bg-[#181c1f] shadow-[0_-28px_80px_rgba(0,0,0,0.36)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-white/35" />
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-black text-white">
                    {locale === "en" ? "Comments" : "댓글"} {comments.length}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs font-semibold text-white/55">
                    {episode.episode}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCommentsOpen(false)}
                  className="rounded-full px-3 py-1.5 text-sm font-bold text-white/80 transition hover:bg-white/10"
                >
                  {locale === "en" ? "Close" : "닫기"}
                </button>
              </div>

              <div className="min-h-[240px] flex-1 space-y-3 overflow-y-auto px-5 pb-4">
                {comments.length > 0 ? (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-black text-white">
                        M
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-white">matpick_user</p>
                        <p className="mt-1 break-keep text-sm font-semibold leading-6 text-white/85">
                          {comment.text}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-white/45">
                          {locale === "en" ? "Reply" : "답글 달기"}
                        </p>
                      </div>
                      <Heart className="mt-2 h-5 w-5 flex-shrink-0 text-white/55" />
                    </div>
                  ))
                ) : (
                  <div className="flex min-h-[220px] items-center justify-center text-center">
                    <p className="break-keep text-sm font-semibold leading-6 text-white/55">
                      {locale === "en"
                        ? "No comments yet. Be the first to leave one."
                        : "아직 댓글이 없어요. 첫 댓글을 남겨보세요."}
                    </p>
                  </div>
                )}
              </div>

              <form
                onSubmit={handleCommentSubmit}
                className="flex items-center gap-2 border-t border-white/10 px-4 py-3"
              >
                <input
                  ref={commentInputRef}
                  type="text"
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder={locale === "en" ? "Leave a comment" : "댓글을 남겨보세요"}
                  className="min-w-0 flex-1 rounded-full border border-white/10 bg-transparent px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/55 focus:border-white/35"
                  autoFocus
                />
                <button
                  type="submit"
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#101418] transition hover:bg-[#ffe8ed]"
                  aria-label={locale === "en" ? "Post comment" : "댓글 게시"}
                >
                  <Send className="h-5 w-5" />
                </button>
              </form>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EpisodeStoryActionButton({
  icon,
  label,
  ariaLabel,
  active = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  ariaLabel: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)] transition hover:text-[#ff9ea9] ${
        active ? "text-[#ff7b83]" : ""
      }`}
      aria-label={ariaLabel}
    >
      {icon}
      <span className="text-xs font-bold">{label}</span>
    </button>
  );
}

function EpisodeStorySlideView({ slide }: { slide: EpisodeStorySlide }) {
  const hasImage = Boolean(slide.imageUrl);

  return (
    <article
      className="relative h-full w-full flex-shrink-0 overflow-hidden text-white"
      style={{ background: slide.background }}
    >
      {slide.imageUrl ? (
        <img
          src={getOptimizedCardImageUrl(slide.imageUrl)}
          alt=""
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.18)_42%,rgba(0,0,0,0.68))]" />
      {!hasImage ? (
        <div className="absolute -right-16 top-10 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
      ) : null}
      <div className="relative z-10 flex h-full flex-col justify-between px-7 py-8 sm:px-10 sm:py-11">
        <div>
          <p className="break-keep text-[15px] font-black leading-6 text-white/85">
            {slide.eyebrow}
          </p>
          <h3 className="mt-10 break-keep text-[36px] font-black leading-[1.1] tracking-normal sm:text-[43px]">
            {slide.title}
          </h3>
        </div>

        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            {slide.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/20 px-3 py-1 text-xs font-black text-white"
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="break-keep text-[15px] font-semibold leading-6 text-white/85">
            {slide.description}
          </p>
        </div>
      </div>
    </article>
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
        name: getSourceDisplayName(source),
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

  useEffect(() => {
    if (topicSlug) {
      return;
    }

    const sourceId = searchParams.get("source");
    if (!sourceId) {
      return;
    }

    const publicSourceTopic = getDiscoveryTopicByTarget("source", sourceId);
    if (
      publicSourceTopic &&
      publicDiscoveryTopics.some((topic) => topic.slug === publicSourceTopic.slug)
    ) {
      navigate(publicSourceTopic.path);
    }
  }, [navigate, searchParams, topicSlug]);

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
  const [selectedSubdivision, setSelectedSubdivision] = useState(ALL_FILTER);
  const [isEpisodeMenuOpen, setIsEpisodeMenuOpen] = useState(Boolean(episodeSlug));
  const [visibleCount, setVisibleCount] = useState(60);
  const [activeEpisodeIndex, setActiveEpisodeIndex] = useState<number | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isTtoganjipOverview = presetTopic?.slug === "ttoganjip" && !presetEpisode;
  const isPopularRestaurantsOverview =
    presetTopic?.slug === "popular-restaurants" && !presetEpisode;
  const isSourceRestaurantCardOverview =
    Boolean(presetTopic) &&
    !presetEpisode &&
    (presetTopic?.slug === "old-korean-100" ||
      presetTopic?.slug === "baekjong-wok" ||
      presetTopic?.slug === "michelin");
  const isCardTopicOverview =
    isTtoganjipOverview || isPopularRestaurantsOverview || isSourceRestaurantCardOverview;

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
    setSelectedSubdivision(ALL_FILTER);
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
    selectedSubdivision,
    selectedTopicId,
    topicSlug,
  ]);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (activeEpisodeIndex === null) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeEpisodeIndex]);

  const activeMichelinSourceId = useMemo(() => {
    if (presetTopic?.kind === "source" && presetTopic.targetId === "michelin") {
      return "michelin";
    }

    if (selectedDiscoveryKeys.includes(buildDiscoveryKey("source", "michelin"))) {
      return "michelin";
    }

    return null;
  }, [presetTopic, selectedDiscoveryKeys]);

  const activeSourceSubdivisions = useMemo(() => {
    if (!activeMichelinSourceId) {
      return [];
    }

    return getSourceSubdivisions(activeMichelinSourceId);
  }, [activeMichelinSourceId]);

  useEffect(() => {
    if (!activeMichelinSourceId && selectedSubdivision !== ALL_FILTER) {
      setSelectedSubdivision(ALL_FILTER);
    }
  }, [activeMichelinSourceId, selectedSubdivision]);

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

    if (activeMichelinSourceId && selectedSubdivision !== ALL_FILTER) {
      nextRestaurants = nextRestaurants.filter((restaurant) =>
        restaurantMatchesSourceSubdivision(
          restaurant.id,
          activeMichelinSourceId,
          selectedSubdivision
        )
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
    selectedSubdivision,
    selectedTopicId,
    activeMichelinSourceId,
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
    setSelectedSubdivision(ALL_FILTER);
    setSelectedTopicId(ALL_FILTER);
    navigate("/explore");
  };

  const openEpisodeCard = useCallback(
    (index: number) => {
      if (topicEpisodes.length === 0) {
        return;
      }

      setActiveEpisodeIndex(index % topicEpisodes.length);
    },
    [topicEpisodes.length]
  );

  const hasActiveDiscovery = selectedDiscoveryKeys.length > 0;
  const hasActiveFilters =
    hasActiveDiscovery ||
    selectedCategory !== ALL_FILTER ||
    selectedRegion !== ALL_FILTER ||
    selectedSubdivision !== ALL_FILTER ||
    selectedTopicId !== ALL_FILTER ||
    Boolean(presetTopic) ||
    Boolean(presetEpisode);

  const topicLine = presetEpisode
    ? copy.episodeLine(presetEpisode)
    : presetTopic
      ? copy.topicLine(presetTopic)
      : "";
  const pageDescription = isTtoganjipOverview
    ? locale === "en"
      ? "Ttoganjip is shown first as episode cards. More themes such as Michelin can be added here later."
      : "지금은 또간집 회차별 맛집 카드를 먼저 보여드리고, 이후 미쉐린 같은 주제도 이 영역에 추가할 예정입니다."
    : isPopularRestaurantsOverview
      ? locale === "en"
        ? "Popular restaurants are grouped into card collections instead of a long restaurant list."
        : "인기맛집은 식당을 한꺼번에 펼치지 않고 카드 묶음 단위로 정리해서 보여드립니다."
      : isSourceRestaurantCardOverview && presetTopic
        ? presetTopic.description || copy.pageDescription
        : copy.pageDescription;
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

  const handleSubdivisionSelect = (label: string) => {
    trackMarketingEvent("source_subdivision_filter_click", {
      source_id: activeMichelinSourceId ?? "",
      subdivision_label: label,
      topic_slug: presetTopic?.slug ?? "",
    });
    setSelectedSubdivision(label);
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
            {pageDescription}
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

        {isTtoganjipOverview && presetTopic ? (
          <TtoganjipEpisodeGrid
            topic={presetTopic}
            episodes={topicEpisodes}
            locale={locale}
            onOpen={openEpisodeCard}
          />
        ) : null}

        {isPopularRestaurantsOverview && presetTopic ? (
          <PopularRestaurantCollectionGrid
            topic={presetTopic}
            collections={featuredMapCollections}
            locale={locale}
          />
        ) : null}

        {isSourceRestaurantCardOverview && presetTopic ? (
          <SourceRestaurantCollectionGrid
            topic={presetTopic}
            restaurants={visibleRestaurants}
            totalCount={filteredRestaurants.length}
            locale={locale}
            copy={copy}
            onSelect={handleRestaurantSelect}
          />
        ) : null}

        <section
          className={`mb-8 rounded-[28px] border border-[#f0ebec] bg-white p-4 shadow-[0_10px_36px_rgba(0,0,0,0.04)] sm:p-5 ${
            isCardTopicOverview ? "hidden" : ""
          }`}
        >
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
                {publicDiscoveryTopics.map((topic) => (
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

            {activeMichelinSourceId && activeSourceSubdivisions.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-sm font-semibold text-[#666]">
                  {copy.subdivisionHeading}
                </span>
                <FilterChip
                  label={copy.allLabel}
                  selected={selectedSubdivision === ALL_FILTER}
                  onClick={() => handleSubdivisionSelect(ALL_FILTER)}
                />
                {activeSourceSubdivisions.map((subdivision) => (
                  <FilterChip
                    key={subdivision.label}
                    label={subdivision.label}
                    selected={selectedSubdivision === subdivision.label}
                    onClick={() => handleSubdivisionSelect(subdivision.label)}
                  />
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

        <div
          className={`mb-6 flex flex-wrap items-center justify-between gap-3 ${
            isCardTopicOverview ? "hidden" : ""
          }`}
        >
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

        <div className={`mb-6 ${isCardTopicOverview ? "hidden" : ""}`}>
          <RevenuePlacement providers={["kakao"]} label={copy.sponsoredLabel} />
        </div>

        {!isCardTopicOverview && filteredRestaurants.length > 0 ? (
          <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {visibleRestaurants.flatMap((restaurant, index) => {
              const items = [
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  imageIndex={index}
                  locale={locale}
                  copy={copy}
                  onSelect={handleRestaurantSelect}
                />,
              ];

              if (
                (index + 1 === 12 || index + 1 === 24) &&
                index + 1 < visibleRestaurants.length
              ) {
                const providers = index + 1 === 12 ? (["coupang"] as const) : (["adsense"] as const);
                items.push(
                  <div
                    key={`revenue-inline-${restaurant.id}`}
                    className="sm:col-span-2 lg:col-span-3"
                  >
                    <RevenuePlacement
                      providers={[...providers]}
                      label={copy.sponsoredLabel}
                    />
                  </div>
                );
              }

              return items;
            })}
          </div>
        ) : !isCardTopicOverview ? (
          <div className="rounded-[28px] border border-dashed border-[#ecdfe2] bg-white px-6 py-16 text-center sm:py-20">
            <p className="text-5xl">⌕</p>
            <p className="mt-4 text-lg font-semibold text-[#333]">{copy.emptyTitle}</p>
            <p className="mt-2 text-sm leading-6 text-[#8a8a8a]">{copy.emptyDescription}</p>
          </div>
        ) : null}

        {isTtoganjipOverview &&
        activeEpisodeIndex !== null &&
        portalRoot &&
        presetTopic &&
        topicEpisodes[activeEpisodeIndex]
          ? createPortal(
              <EpisodeStoryModal
                topic={presetTopic}
                episode={topicEpisodes[activeEpisodeIndex]}
                locale={locale}
                onClose={() => setActiveEpisodeIndex(null)}
              />,
              portalRoot
            )
          : null}

        {(!isCardTopicOverview || isSourceRestaurantCardOverview) &&
        visibleCount < deferredRestaurants.length ? (
          <div ref={loadMoreRef} className="py-8 text-center text-sm font-medium text-[#9a8f92]">
            {copy.loadMore}
          </div>
        ) : null}
      </main>
    </div>
  );
}
