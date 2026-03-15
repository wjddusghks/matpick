/*
 * Home — 맛픽 메인 검색 페이지
 * Design: Group1 (기본), Group2 (검색 결과), Group3 (최근 검색)
 * Color Palette: #FEEAC9, #FFCDC9, #FDACAC, #FD7979
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { mockSearchData, type SearchResult } from "@/data";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";

const HERO_BG = "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=1200&q=80";
const LOGO_ICON = "";
const RECENT_KEY = "matpick_recent_searches";

function getRecentSearches(): SearchResult[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentSearches(items: SearchResult[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 10)));
}

/* ─── 검색 결과 아이템 (인스타 스타일) ─── */
function SearchResultItem({
  item, isHovered, onHover, onLeave, onSelect, showDelete, onDelete,
}: {
  item: SearchResult; isHovered: boolean; onHover: () => void; onLeave: () => void;
  onSelect: () => void; showDelete?: boolean; onDelete?: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors duration-150 ${isHovered ? "bg-gray-50" : ""}`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onSelect}
    >
      {/* 아이콘/프로필 이미지 */}
      {item.type === "creator" && item.image ? (
        <img src={item.image} alt={item.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-[#FFCDC9]" />
      ) : item.type === "region" ? (
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
        </div>
      ) : item.type === "restaurant" ? (
        <div className="w-12 h-12 rounded-full bg-[#FEEAC9]/50 flex items-center justify-center flex-shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FD7979" strokeWidth="2">
            <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2" /><path d="M7 2v20" /><path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
          </svg>
        </div>
      ) : (
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
          <span className="text-lg">🍽️</span>
        </div>
      )}

      {/* 텍스트 정보 */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[15px] text-[#1a1a1a] truncate">{item.name}</div>
        <div className="flex items-center gap-2 text-[13px]">
          {item.type === "creator" && (
            <>
              <span className="text-[#FD7979] font-medium">{item.platform}</span>
              <span className="text-[#aaa]">구독자 {item.subscribers}</span>
            </>
          )}
          {item.type === "region" && (
            <>
              <span className="text-[#FD7979] font-medium">{item.parentRegion || "지역"}</span>
              <span className="text-[#aaa]">맛집 {item.restaurantCount?.toLocaleString()}개</span>
            </>
          )}
          {item.type === "food" && (
            <>
              <span className="text-[#FD7979] font-medium">음식종류</span>
              <span className="text-[#aaa]">맛집 {item.restaurantCount?.toLocaleString()}개</span>
            </>
          )}
          {item.type === "restaurant" && (
            <>
              <span className="text-[#FD7979] font-medium">{item.category}</span>
              <span className="text-[#aaa] truncate">{item.address}</span>
            </>
          )}
        </div>
      </div>

      {/* 삭제 버튼 */}
      {showDelete && onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-[#ccc] hover:text-[#FD7979] transition-colors bg-transparent border-none"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ─── 메인 Home ─── */
export default function Home() {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>(getRecentSearches);
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const loginTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, navigate] = useLocation();
  const { isLoggedIn, user, login, logout } = useAuth();
  const { favoritesCount } = useFavorites();

  const filteredResults = query.trim()
    ? mockSearchData.filter((item) =>
        item.name.toLowerCase().includes(query.toLowerCase()) ||
        (item.type === "creator" && item.platform?.toLowerCase().includes(query.toLowerCase())) ||
        (item.type === "restaurant" && (item.address?.toLowerCase().includes(query.toLowerCase()) || item.category?.toLowerCase().includes(query.toLowerCase())))
      ).slice(0, 8)
    : [];

  const showDropdown = isFocused && (filteredResults.length > 0 || (!query.trim() && recentSearches.length > 0));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLoginEnter = useCallback(() => {
    if (loginTimeoutRef.current) { clearTimeout(loginTimeoutRef.current); loginTimeoutRef.current = null; }
    setShowLoginPanel(true);
  }, []);

  const handleLoginLeave = useCallback(() => {
    loginTimeoutRef.current = setTimeout(() => setShowLoginPanel(false), 200);
  }, []);

  const handleSelect = useCallback((item: SearchResult) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((r) => r.id !== item.id);
      const updated = [item, ...filtered].slice(0, 10);
      saveRecentSearches(updated);
      return updated;
    });
    setQuery(item.name);
    setIsFocused(false);

    if (item.type === "restaurant") {
      navigate(`/map?type=restaurant&value=${encodeURIComponent(item.id)}`);
    } else if (item.type === "creator") {
      navigate(`/map?type=creator&value=${encodeURIComponent(item.id)}`);
    } else if (item.type === "region") {
      navigate(`/map?type=region&value=${encodeURIComponent(item.name)}`);
    } else if (item.type === "food") {
      navigate(`/map?type=food&value=${encodeURIComponent(item.name)}`);
    } else {
      navigate("/map");
    }
  }, [navigate]);

  const handleDeleteRecent = useCallback((id: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      saveRecentSearches(updated);
      return updated;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_KEY);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-white">
      {/* ─── 상단 네비게이션 ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center drop-shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary"><path d="M3 2l3 3m0 0l3-3M6 5v14m6-14h8a2 2 0 012 2v4a2 2 0 01-2 2h-8m0-8v8m0 0h8a2 2 0 012 2v2a2 2 0 01-2 2h-8" /></svg>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/explore")}
            className="px-4 py-2 rounded-full text-[#666] font-medium text-sm hover:text-[#FD7979] hover:bg-[#FEEAC9]/30 transition-all bg-transparent border-none"
          >
            맛집 탐색
          </button>

          {isLoggedIn ? (
            /* 로그인 상태 */
            <div className="relative" onMouseEnter={handleLoginEnter} onMouseLeave={handleLoginLeave}>
              <div className="flex items-center gap-2">
                {/* 찜 목록 */}
                <button
                  onClick={() => navigate("/my/favorites")}
                  className="relative px-3 py-2 rounded-full text-[#666] font-medium text-sm hover:text-[#FD7979] hover:bg-[#FEEAC9]/30 transition-all bg-transparent border-none cursor-pointer"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={favoritesCount > 0 ? "#FD7979" : "none"} stroke={favoritesCount > 0 ? "#FD7979" : "currentColor"} strokeWidth="2">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                  {favoritesCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#FD7979] text-white text-[10px] font-bold flex items-center justify-center">
                      {favoritesCount > 9 ? "9+" : favoritesCount}
                    </span>
                  )}
                </button>
                {/* 사용자 아바타 */}
                <button className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FD7979] to-[#FDACAC] flex items-center justify-center text-white text-sm font-bold border-none cursor-pointer">
                  {user?.name?.charAt(0) || "U"}
                </button>
              </div>

              {/* 로그인 상태 드롭다운 */}
              <div className={`absolute top-full right-0 mt-2 w-[220px] bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-100 transition-all duration-300 origin-top-right ${showLoginPanel ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"}`}>
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FD7979] to-[#FDACAC] flex items-center justify-center text-white font-bold">
                      {user?.name?.charAt(0) || "U"}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-[#1a1a1a]">{user?.name}</div>
                      <div className="text-[11px] text-[#999]">맛픽 데모 회원</div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => navigate("/my/favorites")} className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-[#555] hover:bg-[#FFF5F5] hover:text-[#FD7979] transition-colors bg-transparent border-none cursor-pointer flex items-center gap-2">
                      ❤️ 찜한 맛집 ({favoritesCount})
                    </button>
                    <button onClick={logout} className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-[#999] hover:bg-gray-50 hover:text-[#555] transition-colors bg-transparent border-none cursor-pointer flex items-center gap-2">
                      🚪 데모 로그아웃
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 비로그인 상태 */
            <div className="relative" onMouseEnter={handleLoginEnter} onMouseLeave={handleLoginLeave}>
              <button onClick={() => login()} className="px-5 py-2 rounded-full border-2 border-[#FD7979] text-[#FD7979] font-semibold text-sm hover:bg-[#FD7979] hover:text-white transition-all duration-200 bg-transparent cursor-pointer">
                데모 로그인
              </button>

              {/* 로그인 팝업 - Group1 디자인 */}
              <div className={`absolute top-full right-0 mt-2 w-[280px] bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-100 transition-all duration-300 origin-top-right ${showLoginPanel ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"}`}>
                <div className="p-5">
                  <p className="font-bold text-[15px] text-[#1a1a1a] mb-4">데모 로그인으로 흐름을 미리 볼 수 있어요</p>
                  <div className="flex flex-col gap-3 mb-5">
                    {[
                      { icon: "❤️", title: "맛집 저장", desc: "가고 싶은 맛집을 즐겨찾기" },
                      { icon: "💬", title: "커뮤니티 참여", desc: "리뷰 작성 및 의견 공유" },
                      { icon: "⭐", title: "나만의 평점", desc: "맛집에 평점 남기기" },
                      { icon: "📅", title: "예약 기능", desc: "맛집 바로 예약 하기" },
                    ].map((item) => (
                      <div key={item.title} className="flex items-center gap-3">
                        <span className="text-lg">{item.icon}</span>
                        <div>
                          <div className="font-semibold text-[13px] text-[#1a1a1a]">{item.title}</div>
                          <div className="text-[11px] text-[#999]">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => login()} className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 bg-[#FEE500] text-[#3C1E1E] hover:brightness-95 transition border-none cursor-pointer">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#3C1E1E"><path d="M12 3C6.48 3 2 6.36 2 10.5c0 2.67 1.8 5.01 4.5 6.36-.15.54-.97 3.46-1 3.58 0 .15.06.3.17.38.07.05.15.08.24.08.1 0 .2-.04.28-.1 1.1-.78 3.2-2.24 3.74-2.63.68.1 1.38.15 2.07.15 5.52 0 10-3.36 10-7.5S17.52 3 12 3z"/></svg>
                      카카오 로그인 체험
                    </button>
                    <button onClick={() => login()} className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 bg-[#03C75A] text-white hover:brightness-95 transition border-none cursor-pointer">
                      <span className="font-black text-base">N</span>
                      네이버 로그인 체험
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ─── 히어로 배경 (숟가락+포크) ─── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <img src={HERO_BG} alt="" className="w-[700px] h-auto opacity-15" draggable={false} />
      </div>

      {/* ─── 메인 콘텐츠 ─── */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        {/* 로고 */}
        <h1 className="mb-4 select-none" style={{ fontFamily: "'Black Han Sans', sans-serif" }}>
          <span className="text-[80px] leading-none text-[#1a1a1a]">맛</span>
          <span className="text-[80px] leading-none text-[#FD7979]">픽</span>
        </h1>

        {/* 서브 텍스트 */}
        <p className="text-[#888] text-base mb-8 text-center" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
          <span className="text-[#FD7979] font-semibold">유튜브</span>,{" "}
          <span className="text-[#FD7979] font-semibold">인스타</span>{" "}
          크리에이터들이 방문한 맛집을 한곳에서 찾아보세요!
        </p>

        {/* ─── 검색창 + 드롭다운 (Group2/3 디자인) ─── */}
        <div ref={searchRef} className="w-full max-w-[640px] relative">
          <div className={`bg-white transition-all duration-300 ${
            showDropdown
              ? "rounded-t-2xl shadow-[0_4px_24px_rgba(253,121,121,0.12)] border border-[#FFCDC9] border-b-0"
              : "rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-[#FFCDC9]/60 hover:shadow-[0_4px_20px_rgba(253,121,121,0.10)] hover:border-[#FFCDC9]"
          }`}>
            <div className="flex items-center px-5 py-4">
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setHoveredIndex(-1); }}
                onFocus={() => setIsFocused(true)}
                placeholder="맛집, 크리에이터, 지역, 음식을 검색해 보세요!"
                className="flex-1 text-[16px] text-[#1a1a1a] placeholder-[#bbb] outline-none bg-transparent"
                style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
              />
              <button className="ml-3 flex-shrink-0 text-[#999] hover:text-[#FD7979] transition-colors bg-transparent border-none">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
            </div>
          </div>

          {/* ─── 드롭다운 (인스타 스타일) ─── */}
          {showDropdown && (
            <div className="absolute left-0 right-0 bg-white border border-t-0 border-[#FFCDC9] rounded-b-2xl shadow-[0_12px_32px_rgba(253,121,121,0.10)] overflow-hidden z-50">
              <div className="mx-5 border-t border-gray-100" />

              {/* 검색 결과 */}
              {query.trim() && filteredResults.length > 0 && (
                <div className="py-2">
                  {filteredResults.map((item, idx) => (
                    <SearchResultItem
                      key={item.id}
                      item={item}
                      isHovered={hoveredIndex === idx}
                      onHover={() => setHoveredIndex(idx)}
                      onLeave={() => setHoveredIndex(-1)}
                      onSelect={() => handleSelect(item)}
                    />
                  ))}
                </div>
              )}

              {/* 최근 검색 항목 (Group3 디자인) */}
              {!query.trim() && recentSearches.length > 0 && (
                <div className="py-2">
                  <div className="flex items-center justify-between px-5 py-2">
                    <span className="text-[13px] font-semibold text-[#1a1a1a]">최근 검색 항목</span>
                    <button onClick={handleClearAll} className="text-[12px] text-[#999] hover:text-[#FD7979] transition-colors bg-transparent border-none">
                      모두 지우기
                    </button>
                  </div>
                  {recentSearches.map((item, idx) => (
                    <SearchResultItem
                      key={item.id}
                      item={item}
                      isHovered={hoveredIndex === idx}
                      onHover={() => setHoveredIndex(idx)}
                      onLeave={() => setHoveredIndex(-1)}
                      onSelect={() => handleSelect(item)}
                      showDelete
                      onDelete={() => handleDeleteRecent(item.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI 검색 안내 */}
        <div className="mt-4 flex items-center gap-2 text-[#bbb] text-sm">
          <span>✨</span>
          <span>AI검색 : "여자친구랑 강남에서 분위기 좋은 이탈리안 추천해줘"</span>
        </div>
      </main>
    </div>
  );
}
