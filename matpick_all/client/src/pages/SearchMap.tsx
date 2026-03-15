/*
 * SearchMap — 검색 결과 지도 페이지
 * Design: Group4 — 좌측 패널(검색창+리스트+영상) + 우측 네이버 지도
 * Color Palette: #FEEAC9, #FFCDC9, #FDACAC, #FD7979
 * 지도: 네이버 지도 API 연동 완료
 *
 * UX 흐름:
 * 1. 식당 카드 클릭 → 영상 카드 펼침 + 하단 상세보기 버튼
 * 2. 영상 카드 클릭 → 식당 상세 페이지로 이동
 * 3. 해외 식당 → 지도 미표시 + 안내 메시지
 */
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  restaurants, visits, creators, mockSearchData,
  getCreatorsByRestaurant, getRecommendationCount,
  getRestaurantsByCreator, getRestaurantsByCategory,
  type Restaurant, type Visit, type SearchResult,
} from "@/data";
import NaverMap from "@/components/NaverMap";
import HeartButton from "@/components/HeartButton";

// Logo is rendered inline as SVG

/* 검색 파라미터에 따라 식당 필터링 */
function filterRestaurants(type: string, value: string): { restaurants: Restaurant[]; title: string } {
  switch (type) {
    case "creator": {
      const creator = creators.find((c) => c.id === value || c.name === value);
      if (creator) {
        const rests = getRestaurantsByCreator(creator.id);
        return { restaurants: rests, title: `${creator.name}의 추천 맛집` };
      }
      return { restaurants: [], title: "검색 결과" };
    }
    case "region": {
      const rests = restaurants.filter((r) => r.region?.includes(value));
      return { restaurants: rests, title: `${value} 맛집` };
    }
    case "food": {
      const rests = getRestaurantsByCategory(value);
      return { restaurants: rests, title: `${value} 맛집` };
    }
    case "restaurant": {
      const rest = restaurants.find((r) => r.id === value);
      return { restaurants: rest ? [rest] : [], title: rest?.name || "검색 결과" };
    }
    default:
      return { restaurants: [...restaurants], title: "전체 맛집" };
  }
}

/* ─── 검색 드롭다운 아이템 ─── */
function SearchDropdownItem({
  item, isHovered, onHover, onLeave, onSelect,
}: {
  item: SearchResult; isHovered: boolean; onHover: () => void; onLeave: () => void;
  onSelect: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors duration-100 ${isHovered ? "bg-[#FEEAC9]/30" : ""}`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onSelect}
    >
      {item.type === "creator" && item.image ? (
        <img src={item.image} alt={item.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-[#FFCDC9]" />
      ) : item.type === "region" ? (
        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
        </div>
      ) : item.type === "restaurant" ? (
        <div className="w-9 h-9 rounded-full bg-[#FEEAC9]/50 flex items-center justify-center flex-shrink-0">
          <span className="text-sm">🍽️</span>
        </div>
      ) : (
        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
          <span className="text-sm">🍽️</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[13px] text-[#1a1a1a] truncate">{item.name}</div>
        <div className="flex items-center gap-1.5 text-[11px]">
          {item.type === "creator" && (
            <>
              <span className="text-[#FD7979]">{item.platform}</span>
              <span className="text-[#aaa]">{item.subscribers}</span>
            </>
          )}
          {item.type === "region" && (
            <>
              <span className="text-[#FD7979]">지역</span>
              <span className="text-[#aaa]">맛집 {item.restaurantCount?.toLocaleString()}개</span>
            </>
          )}
          {item.type === "restaurant" && (
            <>
              <span className="text-[#FD7979]">{item.category}</span>
              <span className="text-[#aaa] truncate">{item.address}</span>
            </>
          )}
          {item.type === "food" && (
            <>
              <span className="text-[#FD7979]">음식종류</span>
              <span className="text-[#aaa]">맛집 {item.restaurantCount?.toLocaleString()}개</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── 식당 카드 (Group4 스타일) ─── */
function RestaurantCard({
  restaurant, isSelected, onClick, onNavigateDetail,
}: {
  restaurant: Restaurant; isSelected: boolean; onClick: () => void; onNavigateDetail: () => void;
}) {
  const recCreators = getCreatorsByRestaurant(restaurant.id);
  const relatedVisits = visits.filter(v => v.restaurantId === restaurant.id);
  const isOverseas = restaurant.isOverseas === true;

  return (
    <div
      className={`transition-all duration-200 ${isSelected ? "bg-[#FEEAC9]/30" : "hover:bg-gray-50"}`}
    >
      {/* 식당 정보 - 클릭 시 영상 펼침 */}
      <div
        onClick={onClick}
        className="flex gap-3 p-4 border-b border-gray-100 cursor-pointer"
      >
        {/* 썸네일 */}
        <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
          {restaurant.imageUrl ? (
            <img src={restaurant.imageUrl} alt={restaurant.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl bg-gray-50">
              🍽️
            </div>
          )}
        </div>

        {/* 하트 버튼 */}
        <div className="flex-shrink-0 self-start pt-1">
          <HeartButton restaurantId={restaurant.id} size="sm" />
        </div>

        {/* 텍스트 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-[15px] text-[#FD7979]">{restaurant.name}</span>
            {isOverseas && (
              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-500 border border-blue-200">
                해외
              </span>
            )}
            <span className="text-xs text-[#999]">{restaurant.category}</span>
          </div>
          <p className="text-xs text-[#666] mb-1.5 truncate">{restaurant.address || restaurant.region}</p>
          <p className="text-xs text-[#888] mb-2">{restaurant.representativeMenu}</p>

          {/* 크리에이터 태그 */}
          <div className="flex flex-wrap gap-1.5">
            {recCreators.map((creator) => (
              <Link key={creator.id} href={`/creator/${creator.id}`} className="no-underline">
                <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-sm border border-[#FD7979]/40 text-[#FD7979] hover:bg-[#FD7979] hover:text-white transition-colors">
                  {creator.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* 관련 영상 + 상세 보기 (선택된 식당만) */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* 해외 식당 안내 */}
            {isOverseas && (
              <div className="mx-4 my-2 p-3 rounded-xl bg-blue-50/80 border border-blue-100">
                <div className="flex items-start gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <div>
                    <p className="text-[12px] font-semibold text-blue-700 mb-0.5">좌표 데이터 준비 중</p>
                    <p className="text-[11px] text-blue-600/80 leading-relaxed">
                      {restaurant.name}의 위치는 해외({restaurant.region})인 관계로<br/>
                      지도에서 제공하지 않습니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 영상 카드 - 클릭 시 식당 상세 페이지로 이동 */}
            {relatedVisits.length > 0 ? (
              relatedVisits.slice(0, 3).map((visit) => (
                <VideoCard key={visit.id} visit={visit} restaurantId={restaurant.id} onNavigateDetail={onNavigateDetail} />
              ))
            ) : (
              <div className="px-4 py-3 bg-[#FEEAC9]/10 border-b border-gray-100">
                <p className="text-[12px] text-[#999] text-center">관련 영상이 없습니다</p>
              </div>
            )}

            {/* 상세 보기 버튼 */}
            <div className="px-4 py-2.5 bg-[#FEEAC9]/10 border-b border-gray-200">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateDetail();
                }}
                className="w-full py-2.5 rounded-lg bg-[#FD7979] text-white font-semibold text-[13px] hover:bg-[#e86868] transition-all shadow-[0_2px_8px_rgba(253,121,121,0.25)] flex items-center justify-center gap-1.5 cursor-pointer border-none"
              >
                {restaurant.name} 상세 정보 보기
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── 영상 카드 — 클릭 시 식당 상세 페이지로 이동 ─── */
function VideoCard({ visit, restaurantId, onNavigateDetail }: { visit: Visit; restaurantId: string; onNavigateDetail: () => void }) {
  const creator = creators.find(c => c.series === visit.series) || creators.find(c => c.id === visit.creatorId);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onNavigateDetail();
      }}
      className="flex gap-3 px-4 py-3 bg-[#FEEAC9]/20 border-b border-gray-100 hover:bg-[#FEEAC9]/40 transition-colors cursor-pointer group"
    >
      <div className="w-24 h-16 rounded-lg overflow-hidden flex-shrink-0 relative bg-gray-200">
        {visit.thumbnailUrl ? (
          <img src={visit.thumbnailUrl} alt={visit.videoTitle} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-300">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center">
            <svg width="10" height="12" viewBox="0 0 10 12" fill="white"><polygon points="0,0 10,6 0,12" /></svg>
          </div>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[#FD7979] line-clamp-2 mb-1 group-hover:underline">{visit.videoTitle}</p>
        <div className="flex items-center gap-2 text-[11px] text-[#999]">
          <span>{visit.visitDate}</span>
          {visit.episode && <span>{visit.episode}</span>}
        </div>
        {creator && (
          <span className="text-[11px] text-[#FDACAC] font-medium">{creator.name}</span>
        )}
      </div>
      {/* 상세 페이지 이동 화살표 */}
      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FD7979" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </div>
  );
}

/* ─── 메인 SearchMap ─── */
export default function SearchMap() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const type = params.get("type") || "all";
  const value = params.get("value") || "";

  const { restaurants: filteredRestaurants, title } = useMemo(
    () => filterRestaurants(type, value),
    [type, value]
  );

  // 지도에 표시할 식당 (국내만, 좌표 있는 것만)
  const domesticRestaurants = useMemo(
    () => filteredRestaurants.filter(r => !r.isOverseas),
    [filteredRestaurants]
  );

  // 해외 식당 수
  const overseasCount = useMemo(
    () => filteredRestaurants.filter(r => r.isOverseas === true).length,
    [filteredRestaurants]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRestaurant = filteredRestaurants.find(r => r.id === selectedId) || null;

  // ─── 검색 기능 상태 ───
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);

  // 선택된 식당으로 스크롤
  const listRef = useRef<HTMLDivElement>(null);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return mockSearchData.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.type === "creator" && item.platform?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.type === "restaurant" && (item.address?.toLowerCase().includes(searchQuery.toLowerCase()) || item.category?.toLowerCase().includes(searchQuery.toLowerCase())))
    ).slice(0, 6);
  }, [searchQuery]);

  const showSearchDropdown = isSearchFocused && searchQuery.trim().length > 0 && searchResults.length > 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkerClick = useCallback((id: string) => {
    setSelectedId(prev => prev === id ? null : id);
  }, []);

  const handleSearchSelect = (item: SearchResult) => {
    setSearchQuery("");
    setIsSearchFocused(false);
    if (item.type === "restaurant") {
      navigate(`/map?type=restaurant&value=${encodeURIComponent(item.id)}`);
    } else if (item.type === "creator") {
      navigate(`/map?type=creator&value=${encodeURIComponent(item.id)}`);
    } else if (item.type === "region") {
      navigate(`/map?type=region&value=${encodeURIComponent(item.name)}`);
    } else if (item.type === "food") {
      navigate(`/map?type=food&value=${encodeURIComponent(item.name)}`);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* ─── 좌측 패널 + 우측 지도 ─── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─── 좌측 패널 (Group4 디자인) ─── */}
        <div className="w-[380px] flex-shrink-0 flex flex-col border-r border-gray-100 bg-white">
          {/* 헤더: 로고 + 검색창 */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
                <div className="w-6 h-6 rounded-full bg-[#FD7979]/10 flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FD7979" strokeWidth="2.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg></div>
              </div>
              <div ref={searchRef} className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setHoveredIdx(-1); }}
                  onFocus={() => setIsSearchFocused(true)}
                  placeholder={title}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#FFCDC9]/60 text-sm text-[#1a1a1a] placeholder-[#999] outline-none focus:border-[#FD7979] focus:shadow-[0_0_0_3px_rgba(253,121,121,0.1)] transition-all bg-white"
                  style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
                />
                {/* 검색 아이콘 */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#bbb]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>

                {/* 검색 드롭다운 */}
                {showSearchDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#FFCDC9] rounded-xl shadow-[0_8px_24px_rgba(253,121,121,0.12)] overflow-hidden z-50">
                    {searchResults.map((item, idx) => (
                      <SearchDropdownItem
                        key={item.id + idx}
                        item={item}
                        isHovered={hoveredIdx === idx}
                        onHover={() => setHoveredIdx(idx)}
                        onLeave={() => setHoveredIdx(-1)}
                        onSelect={() => handleSearchSelect(item)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 검색 결과 수 */}
            <div className="flex items-center gap-2">
              <span className="text-[#FD7979] font-bold text-lg">{filteredRestaurants.length}개</span>
              <span className="text-[13px] text-[#888]">의 검색 결과</span>
              {overseasCount > 0 && (
                <span className="text-[11px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                  해외 {overseasCount}곳
                </span>
              )}
            </div>
          </div>

          {/* 식당 리스트 */}
          <div ref={listRef} className="flex-1 overflow-y-auto">
            {filteredRestaurants.map((r) => (
              <RestaurantCard
                key={r.id}
                restaurant={r}
                isSelected={selectedId === r.id}
                onClick={() => {
                  setSelectedId(prev => prev === r.id ? null : r.id);
                }}
                onNavigateDetail={() => navigate(`/restaurant/${r.id}`)}
              />
            ))}

            {filteredRestaurants.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="text-4xl mb-3">🔍</span>
                <p className="text-[#888] text-sm">검색 결과가 없습니다</p>
              </div>
            )}
          </div>
        </div>

        {/* ─── 우측: 네이버 지도 영역 ─── */}
        <div className="flex-1 relative">
          <NaverMap
            restaurants={domesticRestaurants}
            selectedId={selectedId}
            onMarkerClick={handleMarkerClick}
          />
          {/* 좌표가 없는 식당이 있을 때 안내 */}
          {domesticRestaurants.length > 0 && domesticRestaurants.filter(r => r.lat !== 0 && r.lng !== 0).length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6 text-center max-w-xs pointer-events-auto">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-[#FEEAC9] to-[#FFCDC9] flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FD7979" strokeWidth="1.5">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                    <circle cx="12" cy="9" r="2.5" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-[#1a1a1a] mb-1">좌표 데이터 준비 중</p>
                <p className="text-xs text-[#888]">{domesticRestaurants.length}개 맛집의 위치 정보를<br/>업데이트하고 있습니다</p>
              </div>
            </div>
          )}

          {/* 해외 식당만 있을 때 안내 */}
          {domesticRestaurants.length === 0 && overseasCount > 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-blue-100 p-6 text-center max-w-sm pointer-events-auto">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-[#1a1a1a] mb-1">해외 맛집 {overseasCount}곳</p>
                <p className="text-xs text-[#888] leading-relaxed">
                  해외 식당은 네이버 지도에서<br/>위치를 제공하지 않습니다.<br/>
                  좌측 목록에서 식당 정보를 확인해주세요.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
