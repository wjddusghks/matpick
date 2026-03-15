/*
 * RestaurantDetail — 식당 상세 페이지
 * Design: Group5 — 2컬럼 탭 기반 레이아웃
 * 좌측: 식당 정보 카드 + 탭(메뉴/영상/리뷰/상세)
 * 우측: 사진 갤러리 + 액션 버튼
 * Color Palette: #FEEAC9, #FFCDC9, #FDACAC, #FD7979
 */
import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import {
  restaurants, visits, creators,
  getVisitsByRestaurant, getCreatorsByRestaurant, getRecommendationCount,
  type Visit, type Creator,
} from "@/data";
import HeartButton from "@/components/HeartButton";

export default function RestaurantDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const restaurant = restaurants.find((r) => r.id === id);
  const [activeTab, setActiveTab] = useState<"menu" | "videos" | "reviews" | "details">("menu");

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="text-center">
          <p className="text-6xl mb-4">🍽️</p>
          <p className="text-lg text-[#888] mb-4">식당을 찾을 수 없습니다</p>
          <button onClick={() => navigate("/")} className="px-6 py-2 rounded-full bg-[#FD7979] text-white font-medium border-none">홈으로</button>
        </div>
      </div>
    );
  }

  const allVisits = getVisitsByRestaurant(restaurant.id);
  const recommenders = getCreatorsByRestaurant(restaurant.id);
  const recCount = getRecommendationCount(restaurant.id);

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #f8f9fa 0%, #f0f2f5 100%)" }}>
      {/* ─── 상단 네비게이션 바 (Group5) ─── */}
      <nav className="bg-white border-b border-[#e8e8e8] px-8 py-3 flex items-center justify-between sticky top-0 z-50 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <button
          onClick={() => window.history.back()}
          className="w-9 h-9 rounded-lg border border-[#e0e0e0] bg-white flex items-center justify-center text-lg hover:border-[#FD7979] hover:bg-[#FFF5F5] transition-all"
        >
          ←
        </button>
        <div className="flex items-center gap-2">
          <HeartButton restaurantId={restaurant.id} size="md" className="shadow-sm" />
          <button className="w-9 h-9 rounded-lg border border-[#e0e0e0] bg-white flex items-center justify-center text-base hover:border-[#FD7979] hover:bg-[#FFF5F5] transition-all">
            🔗
          </button>
          <button className="w-9 h-9 rounded-lg border border-[#e0e0e0] bg-white flex items-center justify-center text-base hover:border-[#FD7979] hover:bg-[#FFF5F5] transition-all">
            ⋮
          </button>
        </div>
      </nav>

      {/* ─── 메인 컨테이너 (2컬럼) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 p-6 lg:px-8 max-w-[1600px] mx-auto">

        {/* ═══ 좌측: 정보 + 탭 ═══ */}
        <div className="flex flex-col gap-6">

          {/* 식당 정보 카드 */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-white rounded-2xl p-7 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
          >
            <div className="mb-6 pb-5 border-b border-[#f0f0f0]">
              <h1 className="text-[28px] font-[800] text-[#1a1a1a] mb-2" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
                {restaurant.name}
              </h1>
              <div className="flex items-center gap-4 text-sm text-[#666]">
                {recCount > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="text-[#FD7979] font-bold">🔥 {recCount}개 채널 추천</span>
                  </span>
                )}
                <span className="flex items-center gap-1">📍 {restaurant.region}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] text-[#999] font-medium uppercase tracking-wider">📍 주소</span>
                <span className="text-[15px] text-[#1a1a1a] font-semibold leading-relaxed">{restaurant.address}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] text-[#999] font-medium uppercase tracking-wider">🍽️ 대표 메뉴</span>
                <span className="text-[15px] text-[#1a1a1a] font-semibold leading-relaxed">{restaurant.representativeMenu || "정보 준비중"}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] text-[#999] font-medium uppercase tracking-wider">📂 카테고리</span>
                <span className="text-[15px] text-[#1a1a1a] font-semibold">{restaurant.category}</span>
              </div>
            </div>
          </motion.div>

          {/* ─── 탭 컨테이너 ─── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden"
          >
            {/* 탭 헤더 */}
            <div className="flex border-b-2 border-[#f0f0f0]">
              {([
                { key: "menu" as const, label: "🍽️ 메뉴 & 칼로리" },
                { key: "videos" as const, label: "🎬 크리에이터 영상" },
                { key: "reviews" as const, label: "💬 리뷰" },
                { key: "details" as const, label: "ℹ️ 상세 정보" },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-4 px-5 text-[15px] font-semibold transition-all duration-300 border-b-[3px] -mb-[2px] bg-transparent ${
                    activeTab === tab.key
                      ? "text-[#FD7979] border-[#FD7979]"
                      : "text-[#999] border-transparent hover:text-[#FD7979]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 탭 콘텐츠 */}
            <div className="p-7">
              {activeTab === "menu" && <MenuTab restaurant={restaurant} />}
              {activeTab === "videos" && <VideosTab visits={allVisits} />}
              {activeTab === "reviews" && <ReviewsTab restaurant={restaurant} />}
              {activeTab === "details" && <DetailsTab restaurant={restaurant} />}
            </div>
          </motion.div>
        </div>

        {/* ═══ 우측: 사이드바 ═══ */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-[80px] h-fit">

          {/* 사진 갤러리 */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
          >
            <div className="relative">
              <img
                src={restaurant.imageUrl || "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=420&h=315&fit=crop"}
                alt={restaurant.name}
                className="w-full aspect-[4/3] object-cover"
              />
              <div className="absolute bottom-3 right-3 bg-black/70 text-white px-2.5 py-1 rounded text-xs">
                📷 사진
              </div>
            </div>
            {/* 썸네일 그리드 */}
            {allVisits.length > 0 && (
              <div className="grid grid-cols-2 gap-0.5 p-0.5">
                {allVisits.slice(0, 4).map((visit, i) => (
                  <div key={visit.id} className="relative aspect-square overflow-hidden">
                    <img src={visit.thumbnailUrl} alt="" className="w-full h-full object-cover hover:opacity-80 transition-opacity cursor-pointer" />
                    {i === 3 && allVisits.length > 4 && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-lg">
                        +{allVisits.length - 4}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* 추천 크리에이터 */}
          {recommenders.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
            >
              <h3 className="text-sm font-bold text-[#1a1a1a] mb-3">추천 크리에이터</h3>
              <div className="flex flex-wrap gap-2">
                {recommenders.map((creator) => (
                  <Link key={creator.id} href={`/creator/${creator.id}`} className="no-underline">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#FFCDC9] hover:bg-[#FFF5F5] transition-colors">
                      <img src={creator.profileImage} alt={creator.name} className="w-7 h-7 rounded-full object-cover" />
                      <span className="text-sm font-semibold text-[#FD7979]">{creator.name}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {/* 액션 버튼 */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] flex flex-col gap-2.5"
          >
            <button
              onClick={() => navigate(`/map?type=restaurant&value=${encodeURIComponent(restaurant.id)}`)}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-none transition-all bg-gradient-to-r from-[#FD7979] to-[#FDACAC] text-white hover:shadow-[0_6px_16px_rgba(253,121,121,0.3)] hover:-translate-y-0.5"
            >
              🗺️ 지도 보기
            </button>
            <button className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-none bg-[#f5f5f5] text-[#555] hover:bg-[#e8e8e8] transition-all">
              📝 리뷰 쓰기
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* ─── 메뉴 탭 ─── */
function MenuTab({ restaurant }: { restaurant: typeof restaurants[0] }) {
  // 대표 메뉴에서 메뉴 항목 파싱 ("/" 기준 분리, 쉼표는 가격 내 포함 가능)
  const menuText = restaurant.representativeMenu || "";
  const menuItems = menuText.split("/").map((m, i) => {
    const trimmed = m.trim();
    // 가격 패턴: 숫자+쉼표+숫자+원 (예: 23,000원)
    const priceMatch = trimmed.match(/(\d[\d,]*원)/);
    const price = priceMatch ? priceMatch[1] : "";
    const name = price ? trimmed.replace(price, "").trim() : trimmed;
    return { id: i, name: name || trimmed, price, description: "" };
  }).filter(m => m.name);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {menuItems.map((menu) => (
        <div
          key={menu.id}
          className="flex flex-col gap-3 p-4 border border-[#f0f0f0] rounded-xl hover:border-[#FD7979] hover:shadow-[0_8px_24px_rgba(253,121,121,0.12)] hover:-translate-y-1 transition-all duration-300 cursor-pointer bg-white"
        >
          <div className="w-full aspect-[4/3] rounded-lg bg-gradient-to-br from-[#FEEAC9]/30 to-[#FFCDC9]/30 flex items-center justify-center text-5xl">
            🍽️
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-base font-bold text-[#1a1a1a]">{menu.name}</div>
            {menu.description && <div className="text-[13px] text-[#777] line-clamp-2">{menu.description}</div>}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[#f5f5f5]">
            <span className="text-lg font-[800] text-[#FD7979]">{menu.price || "가격 미정"}</span>
          </div>
        </div>
      ))}

      {menuItems.length === 0 && (
        <div className="col-span-2 text-center py-12 text-[#888]">
          <span className="text-4xl block mb-3">🍽️</span>
          <p className="text-sm">메뉴 정보가 준비 중입니다</p>
        </div>
      )}
    </div>
  );
}

/* ─── 크리에이터 영상 탭 ─── */
function VideosTab({ visits: allVisits }: { visits: Visit[] }) {
  return (
    <div className="flex flex-col gap-4">
      {allVisits.map((visit) => {
        const creator = creators.find(c => c.series === visit.series) || creators.find(c => c.id === visit.creatorId);
        return (
          <a
            key={visit.id}
            href={visit.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-4 p-4 border border-[#f0f0f0] rounded-xl hover:border-[#FD7979] hover:shadow-[0_4px_12px_rgba(253,121,121,0.1)] transition-all no-underline"
          >
            {/* 썸네일 */}
            <div className="w-[180px] h-[100px] rounded-lg overflow-hidden flex-shrink-0 relative bg-gray-900">
              <img src={visit.thumbnailUrl} alt={visit.videoTitle} className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <div className="w-10 h-10 rounded-full bg-red-600/90 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 10 12" fill="white"><polygon points="0,0 10,6 0,12" /></svg>
                </div>
              </div>
            </div>

            {/* 영상 정보 */}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="text-[15px] font-bold text-[#1a1a1a] line-clamp-2 mb-1">{visit.videoTitle}</div>
                <div className="flex items-center gap-2 text-[12px] text-[#999]">
                  {creator && <span className="text-[#FD7979] font-semibold">🎬 {creator.name}</span>}
                  <span>{visit.visitDate}</span>
                  {visit.episode && <span>{visit.episode}</span>}
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <span className="px-3 py-1.5 border border-[#FD7979] rounded-md text-[12px] text-[#FD7979] hover:bg-[#FD7979] hover:text-white transition-colors">
                  ▶ 영상 보기
                </span>
              </div>
            </div>
          </a>
        );
      })}

      {allVisits.length === 0 && (
        <div className="text-center py-12 text-[#888]">
          <span className="text-4xl block mb-3">🎬</span>
          <p className="text-sm">크리에이터 영상이 없습니다</p>
        </div>
      )}
    </div>
  );
}

/* ─── 리뷰 탭 ─── */
function ReviewsTab({ restaurant }: { restaurant: typeof restaurants[0] }) {
  // 샘플 리뷰 데이터
  const sampleReviews = [
    { id: 1, user: "맛집탐험가", date: "2025.01.15", stars: 5, text: `${restaurant.name} 정말 맛있어요! 크리에이터 영상 보고 찾아갔는데 기대 이상이었습니다. 다시 가고 싶어요.`, helpful: 12 },
    { id: 2, user: "강남직장인", date: "2025.01.10", stars: 4, text: "점심 시간에 갔는데 줄이 좀 있어요. 그래도 맛은 보장합니다!", helpful: 8 },
    { id: 3, user: "한식러버", date: "2025.01.05", stars: 5, text: "가격대가 조금 있지만 정말 맛있어요. 특히 대표 메뉴가 최고! 다시 가고 싶습니다.", helpful: 5 },
  ];

  return (
    <div className="flex flex-col gap-4">
      {sampleReviews.map((review) => (
        <div key={review.id} className="p-4 border border-[#f0f0f0] rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[#FEEAC9] flex items-center justify-center text-lg">👤</div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[#1a1a1a]">{review.user}</div>
              <div className="text-[12px] text-[#999]">{review.date}</div>
            </div>
            <div className="text-[#FD7979] text-[13px]">
              {"⭐".repeat(review.stars)}
            </div>
          </div>
          <p className="text-sm text-[#555] leading-relaxed">{review.text}</p>
          <div className="flex gap-3 mt-3 pt-3 border-t border-[#f5f5f5]">
            <span className="text-[12px] text-[#999] hover:text-[#FD7979] cursor-pointer transition-colors">👍 도움됨 ({review.helpful})</span>
            <span className="text-[12px] text-[#999] hover:text-[#FD7979] cursor-pointer transition-colors">🚩 신고</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── 상세 정보 탭 ─── */
function DetailsTab({ restaurant }: { restaurant: typeof restaurants[0] }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="text-base font-bold text-[#1a1a1a] pb-2 border-b border-[#f0f0f0]">🏪 영업 정보</div>
        <div className="flex justify-between items-start gap-4">
          <span className="text-sm text-[#666] w-[120px] flex-shrink-0">영업 상태</span>
          <span className="text-sm text-[#27ae60] font-semibold flex-1">영업 중 (추정)</span>
        </div>
        <div className="flex justify-between items-start gap-4">
          <span className="text-sm text-[#666] w-[120px] flex-shrink-0">주소</span>
          <span className="text-sm text-[#1a1a1a] flex-1 leading-relaxed">{restaurant.address}</span>
        </div>
        <div className="flex justify-between items-start gap-4">
          <span className="text-sm text-[#666] w-[120px] flex-shrink-0">지역</span>
          <span className="text-sm text-[#1a1a1a] flex-1">{restaurant.region}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-base font-bold text-[#1a1a1a] pb-2 border-b border-[#f0f0f0]">🏷️ 태그</div>
        <div className="flex justify-between items-start gap-4">
          <span className="text-sm text-[#666] w-[120px] flex-shrink-0">음식 종류</span>
          <span className="text-sm text-[#1a1a1a] flex-1">{restaurant.category}</span>
        </div>
        <div className="flex justify-between items-start gap-4">
          <span className="text-sm text-[#666] w-[120px] flex-shrink-0">대표 메뉴</span>
          <span className="text-sm text-[#1a1a1a] flex-1">{restaurant.representativeMenu || "정보 없음"}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-base font-bold text-[#1a1a1a] pb-2 border-b border-[#f0f0f0]">📍 위치 정보</div>
        <div className="flex justify-between items-start gap-4">
          <span className="text-sm text-[#666] w-[120px] flex-shrink-0">좌표</span>
          <span className="text-sm text-[#1a1a1a] flex-1 font-mono text-[13px]">
            {restaurant.lat.toFixed(6)}, {restaurant.lng.toFixed(6)}
          </span>
        </div>
      </div>
    </div>
  );
}
