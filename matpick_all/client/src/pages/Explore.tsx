/*
 * Explore — 맛집 탐색 페이지
 * Color Palette: #FEEAC9, #FFCDC9, #FDACAC, #FD7979
 * 카테고리/지역 필터 + 식당 카드 그리드
 */
import { useState } from "react";
import { useLocation } from "wouter";
import {
  restaurants,
  getAllCategories, getRegions, getBroadRegion,
  getCreatorsByRestaurant, getRecommendationCount,
  type Restaurant,
} from "@/data";
import HeartButton from "@/components/HeartButton";

// Logo is rendered inline as SVG

function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const [, navigate] = useLocation();
  const recCount = getRecommendationCount(restaurant.id);
  const recCreators = getCreatorsByRestaurant(restaurant.id);

  return (
    <div
      onClick={() => navigate(`/restaurant/${restaurant.id}`)}
      className="group bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_32px_rgba(253,121,121,0.15)] transition-all duration-300 cursor-pointer border border-gray-100 hover:border-[#FFCDC9]"
    >
      <div className="relative h-48 overflow-hidden">
        <img
          src={restaurant.imageUrl || "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=400&fit=crop"}
          alt={restaurant.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {recCount > 1 && (
          <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-lg" style={{ background: "linear-gradient(135deg, #FD7979, #FDACAC)" }}>
            🔥 {recCount}개 채널 추천
          </div>
        )}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm text-xs font-medium text-[#666]">
            {restaurant.category}
          </span>
          <HeartButton restaurantId={restaurant.id} size="sm" className="shadow-md" />
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-bold text-lg text-[#1a1a1a] mb-1 group-hover:text-[#FD7979] transition-colors" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
          {restaurant.name}
        </h3>
        <p className="text-sm text-[#888] mb-3 truncate">{restaurant.address}</p>
        <div className="text-sm font-medium text-[#FD7979] mb-3" style={{ fontFamily: "'DM Mono', monospace" }}>
          {restaurant.representativeMenu}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {recCreators.map((creator, idx) => {
            const colors = ["#FD7979", "#FDACAC", "#FFCDC9"];
            const rotations = [-2, 1.5, -1];
            return (
              <span
                key={creator.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold border-2 rounded-sm"
                style={{
                  borderColor: colors[idx % 3],
                  color: colors[idx % 3],
                  transform: `rotate(${rotations[idx % 3]}deg)`,
                  opacity: 0.9,
                }}
              >
                {creator.name.length > 8 ? creator.name.slice(0, 8) + "…" : creator.name}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Explore() {
  const [, navigate] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [selectedRegion, setSelectedRegion] = useState("전체");
  const categories = getAllCategories();
  const regions = getRegions();

  let filtered = [...restaurants];
  if (selectedCategory !== "전체") {
    filtered = filtered.filter((r) => r.category === selectedCategory);
  }
  if (selectedRegion !== "전체") {
    filtered = filtered.filter((r) => getBroadRegion(r.region) === selectedRegion);
  }
  filtered.sort((a, b) => getRecommendationCount(b.id) - getRecommendationCount(a.id));

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-7 h-7 rounded-full bg-[#FD7979]/10 flex items-center justify-center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FD7979" strokeWidth="2.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg></div>
            <span className="font-bold text-xl" style={{ fontFamily: "'Black Han Sans', sans-serif" }}>
              <span className="text-[#1a1a1a]">맛</span>
              <span className="text-[#FD7979]">픽</span>
            </span>
          </div>

          <div
            onClick={() => navigate("/")}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 hover:bg-[#FEEAC9]/30 transition-colors cursor-pointer border border-gray-200 hover:border-[#FFCDC9]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="text-sm text-[#999]">검색</span>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1a1a1a] mb-2" style={{ fontFamily: "'Black Han Sans', sans-serif" }}>
            맛집 탐색
          </h1>
          <p className="text-[#888] text-base">크리에이터들이 직접 방문한 맛집을 둘러보세요</p>
        </div>

        {/* 필터 */}
        <div className="mb-8 flex flex-col gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[#666] mr-2">카테고리</span>
            <button
              onClick={() => setSelectedCategory("전체")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all border-none ${
                selectedCategory === "전체"
                  ? "bg-[#FD7979] text-white shadow-[0_2px_8px_rgba(253,121,121,0.3)]"
                  : "bg-white text-[#666] hover:bg-[#FEEAC9]/30 hover:text-[#FD7979] shadow-sm"
              }`}
            >
              전체
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all border-none ${
                  selectedCategory === cat
                    ? "bg-[#FD7979] text-white shadow-[0_2px_8px_rgba(253,121,121,0.3)]"
                    : "bg-white text-[#666] hover:bg-[#FEEAC9]/30 hover:text-[#FD7979] shadow-sm"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[#666] mr-2">지역</span>
            <button
              onClick={() => setSelectedRegion("전체")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all border-none ${
                selectedRegion === "전체"
                  ? "bg-[#FDACAC] text-white shadow-[0_2px_8px_rgba(253,172,172,0.3)]"
                  : "bg-white text-[#666] hover:bg-[#FFCDC9]/20 hover:text-[#FDACAC] shadow-sm"
              }`}
            >
              전체
            </button>
            {regions.map((reg) => (
              <button
                key={reg}
                onClick={() => setSelectedRegion(reg)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all border-none ${
                  selectedRegion === reg
                    ? "bg-[#FDACAC] text-white shadow-[0_2px_8px_rgba(253,172,172,0.3)]"
                    : "bg-white text-[#666] hover:bg-[#FFCDC9]/20 hover:text-[#FDACAC] shadow-sm"
                }`}
              >
                {reg}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-[#888]">
            총 <span className="font-bold text-[#FD7979]">{filtered.length}</span>개 맛집
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((restaurant) => (
            <RestaurantCard key={restaurant.id} restaurant={restaurant} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-6xl mb-4">🍽️</p>
            <p className="text-lg text-[#888]">해당 조건에 맞는 맛집이 없습니다</p>
          </div>
        )}
      </main>
    </div>
  );
}
