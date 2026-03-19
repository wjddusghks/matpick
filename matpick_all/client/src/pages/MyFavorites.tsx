import { useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Bookmark, CircleUserRound, Heart, Star } from "lucide-react";
import { Link, useLocation, useSearchParams } from "wouter";
import HeartButton from "@/components/HeartButton";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { FavoriteTopicBadge } from "@/components/FavoriteTopicDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useLocale } from "@/contexts/LocaleContext";
import { restaurants, type Restaurant } from "@/data";
import { getDisplayName } from "@/lib/authProfile";
import {
  type FavoriteTopic,
} from "@/lib/favoriteTopics";
import { translateCuisineLabel, type AppLocale } from "@/lib/locale";
import { getRestaurantDisplayImage } from "@/lib/restaurantPresentation";
import { getUserRestaurantRating } from "@/lib/restaurantRatings";
import { useSeo } from "@/lib/seo";

const MY_FAVORITES_UI = {
  ko: {
    seoTitle: "저장한 맛집",
    seoDescription: "로그인한 사용자의 저장한 맛집과 주제별 맛집을 확인하는 페이지입니다.",
    ratingLabel: "나만의 평점",
    photoPending: "사진 준비 중",
    addressPending: "주소 정보 준비 중",
    representativeMenu: "대표 메뉴",
    foundedLabel: "년 시작",
    placesSuffix: "곳",
    loginRequired: "로그인이 필요합니다",
    loginDescription:
      "저장한 맛집과 내가 만든 주제는 로그인한 계정 기준으로 보관됩니다. 카카오나 네이버로 로그인하고 나만의 맛집 리스트를 모아보세요.",
    backHome: "홈으로 돌아가기",
    goBack: "뒤로 가기",
    pageTitle: "저장한 맛집",
    pageDescription: "단순 저장한 맛집과 주제별로 정리한 맛집을 한 곳에서 관리해보세요.",
    allSavedLabel: "전체 저장",
    topicCountLabel: "내 주제",
    viewAll: "전체 보기",
    plainSaved: "단순 저장",
    emptyTitle: "아직 저장한 맛집이 없어요.",
    emptyDescription: "마음에 드는 맛집을 저장하거나 주제로 나눠 담으면 여기에 정리돼요.",
    browseRestaurants: "맛집 둘러보기",
    plainSectionTitle: "단순 저장한 맛집",
    plainSectionDescription: "주제에 따로 나누지 않고 바로 저장한 맛집 목록입니다.",
    plainSectionEmpty: "단순 저장해둔 맛집은 아직 없어요.",
    topicSectionDescription: "주제에 담아둔 맛집만 모아서 보고 있어요.",
    selectedTopicDescription: "선택한 주제에 담긴 맛집만 모아본 화면입니다.",
    topicSectionEmpty: "이 주제에는 아직 담아둔 맛집이 없어요.",
  },
  en: {
    seoTitle: "Saved Restaurants",
    seoDescription: "Review your saved restaurants and topic collections in one place.",
    ratingLabel: "Your rating",
    photoPending: "Photo coming soon",
    addressPending: "Address update coming soon",
    representativeMenu: "Signature menu",
    foundedLabel: " opening",
    placesSuffix: " saved",
    loginRequired: "Sign in to view your saved places",
    loginDescription:
      "Saved restaurants and topic collections are stored for your signed-in account. Sign in with Kakao or Naver to keep your own dining list.",
    backHome: "Back to home",
    goBack: "Go back",
    pageTitle: "Saved Restaurants",
    pageDescription: "Manage your direct saves and topic-based restaurant collections from one screen.",
    allSavedLabel: "All saved",
    topicCountLabel: "My topics",
    viewAll: "View all",
    plainSaved: "Direct saves",
    emptyTitle: "You have not saved any restaurants yet.",
    emptyDescription: "Save places you like or organize them into topics and they will appear here.",
    browseRestaurants: "Browse restaurants",
    plainSectionTitle: "Direct saves",
    plainSectionDescription: "Restaurants you saved without assigning them to a topic.",
    plainSectionEmpty: "You do not have any direct saves yet.",
    topicSectionDescription: "Restaurants collected inside this topic.",
    selectedTopicDescription: "Only restaurants saved in the selected topic are shown here.",
    topicSectionEmpty: "No restaurants have been added to this topic yet.",
  },
} as const;

type MyFavoritesCopy = (typeof MY_FAVORITES_UI)[AppLocale];

function formatSavedCount(count: number, locale: AppLocale) {
  return locale === "en" ? `${count} saved` : `${count}곳`;
}

function RatingPreview({
  userId,
  restaurantId,
  label,
}: {
  userId: string;
  restaurantId: string;
  label: string;
}) {
  const rating = getUserRestaurantRating(userId, restaurantId);

  if (!rating) {
    return null;
  }

  return (
    <div className="mt-3 flex items-center gap-2 text-sm text-[#444]">
      <span className="text-[#ffb24a]">
        {Array.from({ length: rating.stars }, () => "★").join("")}
      </span>
      <span className="font-medium">{label} {rating.stars}/5</span>
    </div>
  );
}

function FavoriteRestaurantCard({
  restaurant,
  userId,
  topics,
  locale,
  ui,
}: {
  restaurant: Restaurant;
  userId: string;
  topics: FavoriteTopic[];
  locale: AppLocale;
  ui: MyFavoritesCopy;
}) {
  const displayImage = getRestaurantDisplayImage(restaurant);
  const cuisineLabel = restaurant.category
    ? translateCuisineLabel(restaurant.category, locale)
    : "";

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Link href={`/restaurant/${restaurant.id}`} className="no-underline">
        <article className="overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_16px_50px_rgba(0,0,0,0.08)] transition hover:-translate-y-1 hover:shadow-[0_20px_64px_rgba(0,0,0,0.12)]">
          <div className="relative aspect-[16/10] overflow-hidden">
            <img
              src={displayImage.src}
              alt={restaurant.name}
              className="h-full w-full object-cover"
            />
            {!displayImage.hasPhoto ? (
              <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-[#6f7280] backdrop-blur-sm">
                {ui.photoPending}
              </div>
            ) : null}
            <div className="absolute right-3 top-3">
              <HeartButton restaurantId={restaurant.id} size="md" />
            </div>
            {cuisineLabel ? (
              <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                {cuisineLabel}
              </div>
            ) : null}
          </div>

          <div className="p-5">
            <h2 className="text-lg font-bold text-[#1b1b1b]">{restaurant.name}</h2>
            <p className="mt-1 text-sm text-[#878787]">
              {restaurant.address || restaurant.region || ui.addressPending}
            </p>

            {restaurant.representativeMenu ? (
              <p className="mt-3 line-clamp-1 text-sm font-medium text-[#ff6b6b]">
                {ui.representativeMenu} {restaurant.representativeMenu}
              </p>
            ) : null}

            <RatingPreview
              userId={userId}
              restaurantId={restaurant.id}
              label={ui.ratingLabel}
            />

            {topics.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <FavoriteTopicBadge key={topic.id} topic={topic} />
                ))}
              </div>
            ) : null}

            {restaurant.foundingYear ? (
              <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#fff5f6] px-3 py-1 text-xs font-semibold text-[#ff7b83]">
                <Star className="h-3.5 w-3.5" />
                {locale === "en"
                  ? `${restaurant.foundingYear}${ui.foundedLabel}`
                  : `${restaurant.foundingYear}${ui.foundedLabel}`}
              </div>
            ) : null}
          </div>
        </article>
      </Link>
    </motion.div>
  );
}

function FavoritesSection({
  title,
  description,
  restaurants,
  userId,
  topicLookup,
  emptyMessage,
  locale,
}: {
  title: string;
  description: string;
  restaurants: Restaurant[];
  userId: string;
  topicLookup: Map<string, FavoriteTopic[]>;
  emptyMessage: string;
  locale: AppLocale;
}) {
  return (
    <section className="rounded-[30px] border border-[#ececec] bg-white px-5 py-6 shadow-[0_18px_54px_rgba(0,0,0,0.06)] sm:px-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-[#171717]">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-[#8a8a8a]">{description}</p>
        </div>
        <span className="rounded-full bg-[#ff7272] px-3 py-1 text-sm font-bold text-white">
          {formatSavedCount(restaurants.length, locale)}
        </span>
      </div>

      {restaurants.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[#f0d7dc] bg-[#fff9fa] px-5 py-8 text-center text-sm text-[#8d8d8d]">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {restaurants.map((restaurant) => (
            <FavoriteRestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              userId={userId}
              topics={topicLookup.get(restaurant.id) ?? []}
              locale={locale}
              ui={MY_FAVORITES_UI[locale]}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function MyFavorites() {
  const [, navigate] = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLoggedIn, user } = useAuth();
  const { locale } = useLocale();
  const {
    favorites,
    topics,
    getTopicRestaurantIds,
    getTopicsForRestaurant,
  } = useFavorites();
  const ui = MY_FAVORITES_UI[locale];

  useSeo({
    title: ui.seoTitle,
    description: ui.seoDescription,
    path: "/my/favorites",
    robots: "noindex,nofollow",
    locale,
  });

  const selectedTopicId = searchParams.get("topic");
  const selectedTab = searchParams.get("tab");

  const handleBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }

    navigate("/");
  }, [navigate]);

  const showAllFavorites = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const showPlainFavorites = useCallback(() => {
    setSearchParams({ tab: "plain" }, { replace: true });
  }, [setSearchParams]);

  const showTopicFavorites = useCallback(
    (topicId: string) => {
      setSearchParams({ topic: topicId }, { replace: true });
    },
    [setSearchParams]
  );

  const restaurantById = useMemo(
    () => new Map(restaurants.map((restaurant) => [restaurant.id, restaurant])),
    []
  );

  const favoriteRestaurants = useMemo(
    () => restaurants.filter((restaurant) => favorites.has(restaurant.id)),
    [favorites]
  );

  const topicSections = useMemo(
    () =>
      topics.map((topic) => ({
        topic,
        restaurants: getTopicRestaurantIds(topic.id)
          .map((restaurantId) => restaurantById.get(restaurantId))
          .filter((restaurant): restaurant is Restaurant => restaurant != null),
      })),
    [getTopicRestaurantIds, restaurantById, topics]
  );

  const topicLookup = useMemo(
    () =>
      new Map(
        restaurants.map((restaurant) => [
          restaurant.id,
          getTopicsForRestaurant(restaurant.id),
        ])
      ),
    [getTopicsForRestaurant]
  );

  const topicRestaurantIds = useMemo(
    () => new Set(topicSections.flatMap((section) => section.restaurants.map((restaurant) => restaurant.id))),
    [topicSections]
  );

  const plainSavedRestaurants = useMemo(
    () =>
      favoriteRestaurants.filter((restaurant) => !topicRestaurantIds.has(restaurant.id)),
    [favoriteRestaurants, topicRestaurantIds]
  );

  const selectedTopicSection = useMemo(
    () => topicSections.find((section) => section.topic.id === selectedTopicId) ?? null,
    [selectedTopicId, topicSections]
  );

  const activeView =
    selectedTopicSection != null ? "topic" : selectedTab === "plain" ? "plain" : "all";

  const hasAnySavedContent =
    favoriteRestaurants.length > 0 ||
    topicSections.some((section) => section.restaurants.length > 0);

  if (!isLoggedIn || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#fffaf9_0%,#fff3f6_100%)] px-4">
        <div className="w-full max-w-md rounded-[32px] border border-[#ffd4d8] bg-white px-8 py-10 text-center shadow-[0_24px_80px_rgba(255,105,135,0.16)]">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff6a6a_0%,#ff00d4_100%)] text-white">
            <Bookmark className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black text-[#161616]">{ui.loginRequired}</h1>
          <p className="mt-3 text-sm leading-6 text-[#7f7f7f]">
            {ui.loginDescription}
          </p>
          <SocialLoginButtons redirectTo="/my/favorites" className="mt-6" />
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-4 text-sm font-semibold text-[#9b9b9b] transition hover:text-[#ff6a6a]"
          >
            {ui.backHome}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f8f9fa_0%,#f7f1f3_100%)]">
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-[#ececec] bg-white/92 px-4 py-4 shadow-[0_4px_18px_rgba(0,0,0,0.04)] backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e5e5e5] bg-white text-[#333] transition hover:border-[#ff8e8e] hover:bg-[#fff5f5]"
            aria-label={ui.goBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <Link href="/" className="no-underline">
            <span
              className="text-2xl font-black tracking-[-0.08em]"
              style={{ fontFamily: "'Black Han Sans', sans-serif" }}
            >
              <span className="text-[#111111]">맛</span>
              <span className="text-[#ff7b83]">픽</span>
            </span>
          </Link>
        </div>

        <button
          type="button"
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 rounded-full border border-[#ece7e8] bg-white px-4 py-2 text-sm font-semibold text-[#555] transition hover:border-[#ffd0d5] hover:bg-[#fff8f9]"
        >
          <CircleUserRound className="h-4 w-4 text-[#ff7b83]" />
          <span>{getDisplayName(user)}</span>
        </button>
      </nav>

      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 rounded-[32px] border border-[#f0dfe3] bg-white px-5 py-6 shadow-[0_18px_54px_rgba(0,0,0,0.06)] sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-[#171717]">{ui.pageTitle}</h1>
              <p className="mt-2 text-sm leading-6 text-[#8a8a8a]">
                {ui.pageDescription}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[#fff1f3] px-3 py-1.5 text-sm font-semibold text-[#ff6f7d]">
                {ui.allSavedLabel} {formatSavedCount(favoriteRestaurants.length, locale)}
              </span>
              <span className="rounded-full bg-[#fff7eb] px-3 py-1.5 text-sm font-semibold text-[#c77a20]">
                {ui.topicCountLabel} {locale === "en" ? topics.length : `${topics.length}개`}
              </span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={showAllFavorites}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                activeView === "all"
                  ? "border-[#ff8f99] bg-[#ff7b83] text-white"
                  : "border-[#f0d7dc] bg-white text-[#666] hover:border-[#ffcad1] hover:bg-[#fff4f6]"
              }`}
            >
              {ui.viewAll}
            </button>
            <button
              type="button"
              onClick={showPlainFavorites}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                activeView === "plain"
                  ? "border-[#ff8f99] bg-[#ff7b83] text-white"
                  : "border-[#f0d7dc] bg-white text-[#666] hover:border-[#ffcad1] hover:bg-[#fff4f6]"
              }`}
            >
              {ui.plainSaved} {locale === "en" ? plainSavedRestaurants.length : plainSavedRestaurants.length}
            </button>
            {topicSections.map((section) => (
              <button
                key={section.topic.id}
                type="button"
                onClick={() => showTopicFavorites(section.topic.id)}
                className="rounded-full transition"
              >
                <FavoriteTopicBadge
                  topic={section.topic}
                  active={selectedTopicSection?.topic.id === section.topic.id}
                />
              </button>
            ))}
          </div>
        </div>

        {!hasAnySavedContent ? (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[28px] border border-[#ececec] bg-white px-8 py-16 text-center shadow-[0_18px_54px_rgba(0,0,0,0.06)]"
          >
            <div className="flex justify-center text-[#ff7272]">
              <Heart className="h-14 w-14" />
            </div>
            <p className="mt-5 text-xl font-semibold text-[#202020]">
              {ui.emptyTitle}
            </p>
            <p className="mt-2 text-sm text-[#8a8a8a]">
              {ui.emptyDescription}
            </p>
            <button
              type="button"
              onClick={() => navigate("/explore")}
              className="mt-6 rounded-full bg-[#ff7272] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-95"
            >
              {ui.browseRestaurants}
            </button>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {activeView === "all" ? (
              <>
                <FavoritesSection
                  title={ui.plainSectionTitle}
                  description={ui.plainSectionDescription}
                  restaurants={plainSavedRestaurants}
                  userId={user.id}
                  topicLookup={topicLookup}
                  emptyMessage={ui.plainSectionEmpty}
                  locale={locale}
                />

                {topicSections.map((section) => (
                  <FavoritesSection
                    key={section.topic.id}
                    title={section.topic.name}
                    description={ui.topicSectionDescription}
                    restaurants={section.restaurants}
                    userId={user.id}
                    topicLookup={topicLookup}
                    emptyMessage={ui.topicSectionEmpty}
                    locale={locale}
                  />
                ))}
              </>
            ) : null}

            {activeView === "plain" ? (
              <FavoritesSection
                title={ui.plainSectionTitle}
                description={ui.plainSectionDescription}
                restaurants={plainSavedRestaurants}
                userId={user.id}
                topicLookup={topicLookup}
                emptyMessage={ui.plainSectionEmpty}
                locale={locale}
              />
            ) : null}

            {activeView === "topic" && selectedTopicSection ? (
              <FavoritesSection
                title={selectedTopicSection.topic.name}
                description={ui.selectedTopicDescription}
                restaurants={selectedTopicSection.restaurants}
                userId={user.id}
                topicLookup={topicLookup}
                emptyMessage={ui.topicSectionEmpty}
                locale={locale}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
