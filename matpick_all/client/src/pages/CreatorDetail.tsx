/*
 * CreatorDetail — 크리에이터 상세 페이지
 * Color Palette: #FEEAC9, #FFCDC9, #FDACAC, #FD7979
 */
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Youtube, Users } from "lucide-react";
import MonetizationSlot from "@/components/monetization/MonetizationSlot";
import {
  creators,
  getCreatorDisplayName,
  getCreatorsByRestaurant,
  getRecommendationCount,
  getRestaurantBroadcastMeta,
  getRestaurantsByCreator,
  type Restaurant,
} from "@/data";
import {
  formatRestaurantBroadcastBadge,
  formatRestaurantFoundingBadge,
  getRestaurantDisplayImage,
} from "@/lib/restaurantPresentation";
import { buildAbsoluteUrl, useSeo } from "@/lib/seo";

// Logo is rendered inline as SVG

function MiniRestaurantCard({ restaurant, index }: { restaurant: Restaurant; index: number }) {
  const [, navigate] = useLocation();
  const recCount = getRecommendationCount(restaurant.id);
  const recCreators = getCreatorsByRestaurant(restaurant.id);
  const displayImage = getRestaurantDisplayImage(restaurant);
  const broadcastBadge = formatRestaurantBroadcastBadge(
    getRestaurantBroadcastMeta(restaurant.id)
  );
  const foundingBadge = formatRestaurantFoundingBadge(restaurant.foundingYear);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      onClick={() => navigate(`/restaurant/${restaurant.id}`)}
      className="group bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_32px_rgba(253,121,121,0.15)] transition-all duration-300 cursor-pointer border border-gray-100 hover:border-[#FFCDC9]"
    >
      <div className="relative h-44 overflow-hidden">
        <img
          src={displayImage.src}
          alt={restaurant.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {!displayImage.hasPhoto && (
          <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-[#6f7280] backdrop-blur-sm">
            사진 준비 중
          </div>
        )}
        {recCount > 1 && (
          <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-lg" style={{ background: "linear-gradient(135deg, #FD7979, #FDACAC)" }}>
            🔥 {recCount}개 채널 추천
          </div>
        )}
        <div className="absolute left-3 bottom-3 flex max-w-[80%] flex-wrap gap-2">
          <div className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-[#666] backdrop-blur-sm">
            {restaurant.category}
          </div>
          {foundingBadge ? (
            <div className="rounded-full bg-[#fff4f5] px-2.5 py-1 text-xs font-semibold text-[#ff6f7c] backdrop-blur-sm">
              {foundingBadge}
            </div>
          ) : null}
          {broadcastBadge ? (
            <div className="rounded-full bg-[#eef7ff] px-2.5 py-1 text-xs font-semibold text-[#3b82c4] backdrop-blur-sm">
              {broadcastBadge}
            </div>
          ) : null}
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-bold text-lg text-[#1a1a1a] mb-1 group-hover:text-[#FD7979] transition-colors" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
          {restaurant.name}
        </h3>
        <p className="text-sm text-[#888] mb-2 truncate">{restaurant.address}</p>
        <div className="text-sm font-medium text-[#FD7979]" style={{ fontFamily: "'DM Mono', monospace" }}>
          {restaurant.representativeMenu}
        </div>
      </div>
    </motion.div>
  );
}

export default function CreatorDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const creator = creators.find((c) => c.id === id);

  useSeo({
    title: creator ? `${creator.name} 추천 맛집` : "크리에이터",
    description: creator
      ? `${creator.name}이 소개한 맛집과 채널 정보를 맛픽에서 한눈에 확인해보세요.`
      : "맛픽 크리에이터 페이지",
    path: creator ? `/creator/${creator.id}` : "/creator",
    type: "profile",
    jsonLd: creator
      ? {
          "@context": "https://schema.org",
          "@type": "Person",
          name: creator.name,
          image: creator.profileImage,
          url: buildAbsoluteUrl(`/creator/${creator.id}`),
          sameAs: creator.youtubeUrl ? [creator.youtubeUrl] : undefined,
        }
      : undefined,
  });

  if (!creator) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-6xl mb-4">🎬</p>
          <p className="text-lg text-[#888] mb-4">크리에이터를 찾을 수 없습니다</p>
          <button onClick={() => navigate("/")} className="px-6 py-2 rounded-full bg-[#FD7979] text-white font-medium border-none">홈으로</button>
        </div>
      </div>
    );
  }

  const recommendedRestaurants = getRestaurantsByCreator(creator.id);

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <button onClick={() => window.history.back()} className="w-9 h-9 rounded-full bg-gray-50 hover:bg-[#FEEAC9]/30 flex items-center justify-center transition-colors border-none">
              <ArrowLeft className="w-4 h-4 text-[#666]" />
            </button>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
              <div className="w-6 h-6 rounded-full bg-[#FD7979]/10 flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FD7979" strokeWidth="2.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg></div>
              <span className="font-bold text-lg" style={{ fontFamily: "'Black Han Sans', sans-serif" }}>
                <span className="text-[#1a1a1a]">맛</span><span className="text-[#FD7979]">픽</span>
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* 크리에이터 프로필 */}
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-6"
        >
          <img
            src={creator.profileImage}
            alt={getCreatorDisplayName(creator)}
            className="h-20 w-20 rounded-full object-cover border-3 border-[#FFCDC9] shadow-md sm:h-24 sm:w-24"
          />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[#1a1a1a] sm:text-3xl" style={{ fontFamily: "'Black Han Sans', sans-serif" }}>
              {getCreatorDisplayName(creator)}
            </h1>
            <p className="text-sm text-[#888]">{creator.channelName}</p>
            <div className="flex flex-wrap items-center gap-3 text-sm text-[#666] sm:gap-4">
              {creator.subscribers && (
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#FD7979]" />
                  구독자 {creator.subscribers}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-red-500">
                <Youtube className="w-4 h-4" />
                YouTube
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-[#FD7979] font-bold">{recommendedRestaurants.length}</span>곳 추천
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 추천 맛집 */}
      <section className="max-w-6xl mx-auto px-4 pb-12 sm:pb-16">
        <h2 className="mb-6 text-lg font-bold text-[#1a1a1a] sm:text-xl" style={{ fontFamily: "'Black Han Sans', sans-serif" }}>
          추천한 맛집 ({recommendedRestaurants.length}곳)
        </h2>
        <div className="mb-6">
          <MonetizationSlot label="Sponsored" />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {recommendedRestaurants.map((restaurant, i) => (
            <MiniRestaurantCard key={restaurant.id} restaurant={restaurant} index={i} />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="hidden">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#888]">
          <span className="font-bold text-[#1a1a1a]" style={{ fontFamily: "'Black Han Sans', sans-serif" }}>
            <span>맛</span><span className="text-[#FD7979]">픽</span>
          </span>
          <span>크리에이터 추천 맛집 큐레이션 플랫폼 (테스트 버전)</span>
        </div>
      </footer>
    </div>
  );
}
