import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  Clock3,
  Copy,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Share2,
  Utensils,
  Tv,
} from "lucide-react";
import { toast } from "sonner";
import HeartButton from "@/components/HeartButton";
import ShareSheet from "@/components/ShareSheet";
import RestaurantReviews from "@/components/RestaurantReviews";
import { RevenuePlacement } from "@/components/monetization/MonetizationSlot";
import { useLocale } from "@/contexts/LocaleContext";
import {
  getRestaurantById,
  getRestaurantMenuItems,
  getRestaurantMenuSummary,
  getSourceDisplayName,
  getSourcesByRestaurant,
  getVisitsByRestaurant,
  type Restaurant,
} from "@/data";
import {
  getOperationNotice,
  hasUsableCoordinates,
  isRestaurantRecommendable,
} from "@/lib/restaurantEligibility";
import { getRestaurantDirectionsUrl } from "@/lib/restaurantDirections";
import { getRestaurantDisplayImage } from "@/lib/restaurantPresentation";
import { summarizeReviews } from "@/lib/reviews";
import { trackMarketingEvent } from "@/lib/marketing";
import { buildAbsoluteUrl, useSeo } from "@/lib/seo";
import "./RestaurantDetail.css";

export default function RestaurantDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const restaurant = getRestaurantById(id ?? "");
  useEffect(() => {
    if (restaurant && id !== restaurant.id)
      navigate(`/restaurant/${restaurant.id}`, { replace: true });
  }, [id, restaurant, navigate]);
  return restaurant ? (
    <RestaurantDetailContent key={restaurant.id} restaurant={restaurant} />
  ) : (
    <MissingRestaurant />
  );
}

function MissingRestaurant() {
  const { isEnglish } = useLocale();
  useSeo({
    title: "식당을 찾을 수 없어요",
    description: "지도에서 다른 식당을 찾아보세요.",
    robots: "noindex,follow",
  });
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 p-5">
      <h1>{isEnglish ? "Restaurant not found" : "식당을 찾을 수 없어요"}</h1>
      <Link
        href="/map"
        className="rounded-xl bg-[#ef6479] px-5 py-3 text-white"
      >
        {isEnglish ? "Browse the map" : "지도에서 찾아보기"}
      </Link>
    </main>
  );
}

function RestaurantDetailContent({ restaurant }: { restaurant: Restaurant }) {
  const { isEnglish, locale } = useLocale();
  const [, navigate] = useLocation();
  const [shareOpen, setShareOpen] = useState(false);
  const [allMenus, setAllMenus] = useState(false);
  const [reviewSummary, setReviewSummary] = useState(() =>
    summarizeReviews([])
  );
  const menus = useMemo(() => getRestaurantMenuItems(restaurant), [restaurant]);
  const featuredMenus = useMemo(
    () =>
      [...menus].sort(
        (a, b) =>
          Number(Boolean(b.isSignature)) - Number(Boolean(a.isSignature))
      ),
    [menus]
  );
  const sources = getSourcesByRestaurant(restaurant.id);
  const visits = getVisitsByRestaurant(restaurant.id).filter(visit =>
    /^https?:\/\//i.test(visit.videoUrl)
  );
  const notice = getOperationNotice(restaurant, locale);
  const canNavigate =
    isRestaurantRecommendable(restaurant) && hasUsableCoordinates(restaurant);
  const menuSummary = getRestaurantMenuSummary(restaurant);
  const category = restaurant.category?.trim();
  const showCategory = Boolean(category && category !== "미분류");
  const mapPath = `/map?type=restaurant&value=${encodeURIComponent(restaurant.id)}`;
  const shareUrl = buildAbsoluteUrl(`/restaurant/${restaurant.id}`);
  const displayImage = getRestaurantDisplayImage(restaurant);
  const shareImage = displayImage.hasPhoto
    ? displayImage.src
    : "/og-default.png";
  const naverUrl = `https://map.naver.com/p/search/${encodeURIComponent(`${restaurant.name} ${restaurant.address}`)}`;
  const collectedDate = (
    restaurant.menuPriceVerifiedAt || restaurant.detailCollectedAt
  )?.slice(0, 10);
  const hasPrices = menus.some(menu => Boolean(menu.price?.trim()));
  const facilities = [
    { key: "parking" as const, ko: "주차 가능", en: "Parking" },
    { key: "reservation" as const, ko: "예약 가능", en: "Reservations" },
    { key: "takeout" as const, ko: "포장 가능", en: "Takeout" },
    {
      key: "accessible" as const,
      ko: "접근성 시설",
      en: "Accessible facilities",
    },
  ].filter(item => restaurant.facilities?.[item.key] === true);
  const hours =
    restaurant.weeklyHours?.filter(item => item.day && item.hours?.length) ??
    [];

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    trackMarketingEvent("restaurant_view", {
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.name,
      category: restaurant.category,
      region: restaurant.region,
      recommendation_count: sources.length,
    });
  }, [restaurant.id]);

  useSeo({
    title: `${restaurant.name} ${isEnglish ? "Menu & location" : "메뉴·후기·위치"}`,
    description: `${restaurant.name}${menuSummary ? ` · ${menuSummary}` : ""}. ${isEnglish ? "See where it was featured, visitor reviews and directions." : "소개된 방송·가이드, 방문자 후기와 길찾기를 한눈에 확인하세요."}`,
    path: `/restaurant/${restaurant.id}`,
    image: shareImage,
    type: "article",
    locale,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Restaurant",
      name: restaurant.name,
      image: buildAbsoluteUrl(shareImage),
      url: shareUrl,
      address: {
        "@type": "PostalAddress",
        streetAddress: restaurant.address,
        addressCountry: restaurant.country || "KR",
      },
      ...(showCategory ? { servesCuisine: category } : {}),
      ...(reviewSummary.count
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: reviewSummary.average.toFixed(1),
              reviewCount: reviewSummary.count,
            },
          }
        : {}),
    },
  });

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(restaurant.address);
      toast.success(isEnglish ? "Address copied." : "주소를 복사했어요.");
    } catch {
      toast.error(
        isEnglish
          ? "Select the address to copy it."
          : "주소를 길게 눌러 복사해 주세요."
      );
    }
  }
  function trackDirections(provider: string) {
    trackMarketingEvent("directions_click", {
      restaurant_id: restaurant.id,
      provider,
      placement: "restaurant_detail",
    });
  }

  return (
    <div className="restaurant-detail">
      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={restaurant.name}
        text={`${restaurant.name}${menuSummary ? ` · ${menuSummary}` : ""}`}
        url={shareUrl}
        imageUrl={shareImage}
      />
      <nav
        className="detail-nav"
        aria-label={isEnglish ? "Restaurant navigation" : "식당 탐색"}
      >
        <button
          type="button"
          className="detail-icon-button"
          aria-label={isEnglish ? "Back" : "이전 화면"}
          onClick={() =>
            window.history.length > 1
              ? window.history.back()
              : navigate(mapPath)
          }
        >
          <ArrowLeft aria-hidden="true" />
        </button>
        <Link
          href="/"
          className="detail-logo"
          aria-label={isEnglish ? "Matpick home" : "맛픽 홈"}
        >
          맛<span>픽</span>
        </Link>
        <div className="detail-nav-actions">
          <HeartButton restaurantId={restaurant.id} size="lg" />
          <button
            type="button"
            className="detail-icon-button"
            aria-label={isEnglish ? "Share restaurant" : "식당 공유"}
            onClick={() => {
              setShareOpen(true);
              trackMarketingEvent("share_open", {
                restaurant_id: restaurant.id,
              });
            }}
          >
            <Share2 aria-hidden="true" />
          </button>
        </div>
      </nav>

      <main className="detail-layout">
        <header className="detail-overview">
          <p className="detail-eyebrow">
            {[restaurant.region, showCategory ? category : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <h1>{restaurant.name}</h1>
          {menuSummary && <p className="detail-menu-headline">{menuSummary}</p>}
          <div className="detail-overview-meta">
            {sources.length > 0 && (
              <a href="#detail-sources">
                <Tv aria-hidden="true" />
                {isEnglish
                  ? `Featured by ${sources.length} sources`
                  : `${sources.length}개 방송·가이드 등에 소개`}
              </a>
            )}
            <a href="#detail-reviews-title">
              <MessageCircle aria-hidden="true" />
              {reviewSummary.count
                ? isEnglish
                  ? `Visitor rating ${reviewSummary.average.toFixed(1)} · ${reviewSummary.count} reviews`
                  : `방문자 평점 ${reviewSummary.average.toFixed(1)} · 후기 ${reviewSummary.count}개`
                : isEnglish
                  ? "Visitor reviews"
                  : "방문자 후기"}
            </a>
            {restaurant.foundingYear && (
              <span>
                {isEnglish
                  ? `Since ${restaurant.foundingYear}`
                  : `${restaurant.foundingYear}년 개업`}
              </span>
            )}
          </div>
          {notice && (
            <div role="status" className="detail-operation-notice">
              <p>{notice}</p>
              {restaurant.replacementRestaurantId &&
                getRestaurantById(restaurant.replacementRestaurantId) && (
                  <Link
                    href={`/restaurant/${restaurant.replacementRestaurantId}`}
                  >
                    {isEnglish ? "View the new location" : "이전한 식당 보기"}
                    <ChevronRight aria-hidden="true" />
                  </Link>
                )}
            </div>
          )}
        </header>

        <aside className="detail-visit" aria-labelledby="detail-visit-title">
          <section className="detail-section detail-location">
            <div className="detail-section-heading">
              <h2 id="detail-visit-title">
                <MapPin aria-hidden="true" />
                {notice
                  ? isEnglish
                    ? "Recorded location"
                    : "기록된 위치"
                  : isEnglish
                    ? "Location & directions"
                    : "위치와 길찾기"}
              </h2>
            </div>
            <p className="detail-address">
              {restaurant.address ||
                (isEnglish ? "Address not available" : "주소 정보가 없어요")}
            </p>
            {restaurant.address && (
              <button
                type="button"
                onClick={() => void copyAddress()}
                className="detail-text-button detail-copy"
              >
                <Copy aria-hidden="true" />
                {isEnglish ? "Copy address" : "주소 복사"}
              </button>
            )}
            {canNavigate && (
              <div className="detail-map-actions">
                <a
                  className="detail-primary-button"
                  href={getRestaurantDirectionsUrl(restaurant)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackDirections("kakao")}
                >
                  <Navigation aria-hidden="true" />
                  {isEnglish ? "Directions" : "길찾기"}
                </a>
                <Link className="detail-secondary-button" href={mapPath}>
                  <MapPin aria-hidden="true" />
                  {isEnglish ? "Map" : "지도 보기"}
                </Link>
              </div>
            )}
            {canNavigate && (
              <a
                className="detail-naver-link"
                href={naverUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackDirections("naver")}
              >
                {isEnglish ? "Open in Naver Map" : "네이버지도에서 보기"}
                <ArrowUpRight aria-hidden="true" />
              </a>
            )}
            {restaurant.phone && (
              <a
                className="detail-phone"
                href={`tel:${restaurant.phone.replace(/[^+\d]/g, "")}`}
              >
                <Phone aria-hidden="true" />
                {restaurant.phone}
              </a>
            )}
            {(hours.length > 0 || facilities.length > 0) && (
              <details className="detail-visit-more">
                <summary>
                  <Clock3 aria-hidden="true" />
                  {isEnglish ? "Hours & facilities" : "영업시간·편의시설"}
                </summary>
                <div>
                  {hours.map(item => (
                    <p className="detail-hours" key={item.day}>
                      <strong>{item.day}</strong>
                      <span>{item.hours.join(" · ")}</span>
                    </p>
                  ))}
                  {facilities.length > 0 && (
                    <p className="detail-facilities">
                      {facilities
                        .map(item => (isEnglish ? item.en : item.ko))
                        .join(" · ")}
                    </p>
                  )}
                  {restaurant.detailCollectedAt && (
                    <p className="detail-small-note">
                      {restaurant.detailCollectedAt.slice(0, 10)}{" "}
                      {isEnglish ? "collected information" : "수집 정보 기준"}
                    </p>
                  )}
                </div>
              </details>
            )}
            <p className="detail-small-note">
              {notice
                ? isEnglish
                  ? "Check the status notice above."
                  : "상단의 영업 상태 안내를 확인해 주세요."
                : isEnglish
                  ? "Check current hours before visiting."
                  : "방문 전 지도나 전화로 영업시간을 확인해 주세요."}
            </p>
          </section>
        </aside>

        <div className="detail-content">
          {menus.length > 0 && (
            <section
              className="detail-section"
              aria-labelledby="detail-menu-title"
            >
              <div className="detail-section-heading">
                <h2 id="detail-menu-title">
                  <Utensils aria-hidden="true" />
                  {isEnglish ? "What to eat" : "이곳에서 먹을 메뉴"}
                </h2>
                <span className="detail-section-count">
                  {isEnglish ? `${menus.length} items` : `${menus.length}가지`}
                </span>
              </div>
              <ul className="detail-menu-list">
                {featuredMenus.slice(0, allMenus ? undefined : 3).map(menu => (
                  <li key={menu.id}>
                    <div>
                      <p>
                        {menu.name}
                        {menu.isSignature && (
                          <span className="detail-signature">
                            {isEnglish ? "Signature" : "대표"}
                          </span>
                        )}
                      </p>
                      {menu.description && (
                        <span className="detail-menu-description">
                          {menu.description}
                        </span>
                      )}
                    </div>
                    {menu.price && (
                      <strong className="detail-price">{menu.price}</strong>
                    )}
                  </li>
                ))}
              </ul>
              {menus.length > 3 && (
                <button
                  type="button"
                  className="detail-expand-button"
                  aria-expanded={allMenus}
                  onClick={() => setAllMenus(value => !value)}
                >
                  {allMenus
                    ? isEnglish
                      ? "Show less"
                      : "메뉴 접기"
                    : isEnglish
                      ? `View all ${menus.length} items`
                      : `메뉴 ${menus.length}가지 모두 보기`}
                </button>
              )}
              {hasPrices && (
                <p className="detail-small-note">
                  {collectedDate ? `${collectedDate} ` : ""}
                  {isEnglish
                    ? "Collected prices may differ from current prices."
                    : "수집된 가격으로, 현재 매장 가격과 다를 수 있어요."}
                </p>
              )}
            </section>
          )}

          {sources.length > 0 && (
            <section
              className="detail-section"
              id="detail-sources"
              aria-labelledby="detail-sources-title"
            >
              <div className="detail-section-heading">
                <h2 id="detail-sources-title">
                  <Tv aria-hidden="true" />
                  {isEnglish ? "Where it was featured" : "이런 곳에 소개됐어요"}
                </h2>
              </div>
              <div className="detail-source-list">
                {sources.map(source => (
                  <Link
                    key={source.id}
                    href={`/map?type=source&value=${encodeURIComponent(source.id)}`}
                    className="detail-source-link"
                  >
                    <span>{getSourceDisplayName(source)}</span>
                    <ArrowUpRight aria-hidden="true" />
                  </Link>
                ))}
              </div>
              <p className="detail-small-note">
                {isEnglish
                  ? "Select a source to explore its restaurant list."
                  : "방송·가이드를 누르면 소개된 다른 식당도 볼 수 있어요."}
              </p>
              {visits.length > 0 && (
                <details className="detail-visit-more">
                  <summary>
                    {isEnglish ? "Watch the original videos" : "소개 영상 보기"}
                  </summary>
                  <div className="detail-video-list">
                    {visits.map(visit => (
                      <a
                        key={visit.id}
                        href={visit.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() =>
                          trackMarketingEvent("video_click", {
                            restaurant_id: restaurant.id,
                            video_url: visit.videoUrl,
                          })
                        }
                      >
                        {visit.videoTitle}
                        <ArrowUpRight aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                </details>
              )}
            </section>
          )}

          <RestaurantReviews
            restaurantId={restaurant.id}
            onSummary={setReviewSummary}
          />
          <Link
            className="detail-return-map"
            href={canNavigate ? mapPath : "/map"}
          >
            <MapPin aria-hidden="true" />
            <span>
              {isEnglish
                ? "Compare more restaurants on the map"
                : "지도에서 다른 식당도 둘러보기"}
            </span>
            <ChevronRight aria-hidden="true" />
          </Link>
        </div>
        <div className="detail-revenue">
          <RevenuePlacement providers={["kakao", "coupang"]} />
        </div>
      </main>
    </div>
  );
}
