import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLocation } from "wouter";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { mockSearchData, type SearchResult } from "@/data";
import matpickLogo from "../assets/matpick-logo-final 2.png";

const RECENT_KEY = "matpick_recent_searches";

function getRecentSearches(): SearchResult[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as SearchResult[]) : [];
  } catch {
    return [];
  }
}

function saveRecentSearches(items: SearchResult[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 8)));
}

function SearchResultItem({
  item,
  isHovered,
  onHover,
  onLeave,
  onSelect,
  showDelete,
  onDelete,
}: {
  item: SearchResult;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onSelect: () => void;
  showDelete?: boolean;
  onDelete?: () => void;
}) {
  const subtitle =
    item.type === "creator"
      ? `${item.platform ?? "크리에이터"} · 구독자 ${item.subscribers ?? "-"}`
      : item.type === "region"
        ? `${item.parentRegion ?? "지역"} · 맛집 ${item.restaurantCount?.toLocaleString() ?? 0}곳`
        : item.type === "food"
          ? `음식 카테고리 · 맛집 ${item.restaurantCount?.toLocaleString() ?? 0}곳`
          : `${item.category ?? "맛집"} · ${item.address ?? ""}`;

  return (
    <div
      className={`flex items-center gap-4 px-5 py-3 transition-colors ${
        isHovered ? "bg-[#fff6f6]" : "bg-white"
      }`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onSelect}
      role="button"
      tabIndex={0}
    >
      {item.type === "creator" && item.image ? (
        <img
          src={item.image}
          alt={item.name}
          className="h-12 w-12 rounded-full border-2 border-[#ffd8e0] object-cover"
        />
      ) : item.type === "region" ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fff3f3] text-[#ff6a6a]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2c-3.86 0-7 3.13-7 7 0 5.24 7 13 7 13s7-7.76 7-13c0-3.87-3.14-7-7-7Z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
        </div>
      ) : item.type === "restaurant" ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fff3f3] text-[#ff6a6a]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 2v20" />
            <path d="M4 2v8a3 3 0 0 0 3 3 3 3 0 0 0 3-3V2" />
            <path d="M18 2v9a2 2 0 0 0 2 2h1V2h-3Z" />
            <path d="M21 13v9" />
          </svg>
        </div>
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fff3f3] text-lg text-[#ff6a6a]">
          #
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-[#1d1d1d]">{item.name}</p>
        <p className="truncate text-[13px] text-[#8a8a8a]">{subtitle}</p>
      </div>

      {showDelete && onDelete && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="rounded-full p-2 text-[#c0c0c0] transition hover:bg-[#fff4f4] hover:text-[#ff6a6a]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

function BenefitItem({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff1f1] text-lg">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-[#1c1c1c]">{title}</p>
        <p className="text-xs leading-5 text-[#8a8a8a]">{description}</p>
      </div>
    </div>
  );
}

function GuestPanel({ redirectTo }: { redirectTo: string }) {
  return (
    <div className="w-[300px] rounded-[28px] border border-[#ffd3d9] bg-white/96 p-6 shadow-[0_24px_80px_rgba(255,105,135,0.16)] backdrop-blur">
      <h2 className="text-2xl font-black text-[#141414]">로그인하면 이런 혜택이!</h2>
      <div className="mt-6 space-y-4">
        <BenefitItem icon="❤" title="맛집 저장" description="가고 싶은 맛집을 즐겨찾기로 모아둘 수 있어요." />
        <BenefitItem icon="💬" title="커뮤니티 참여" description="리뷰를 남기고 다른 사람과 경험을 나눌 수 있어요." />
        <BenefitItem icon="⭐" title="나만의 평점" description="내 기준으로 맛집을 기록하고 다시 비교할 수 있어요." />
        <BenefitItem icon="📅" title="방문 계획" description="방문하고 싶은 맛집을 체크해 두고 다음 코스를 정리해요." />
      </div>
      <SocialLoginButtons redirectTo={redirectTo} className="mt-6" />
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>(getRecentSearches);
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const loginRef = useRef<HTMLDivElement>(null);
  const loginTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, navigate] = useLocation();
  const { isLoggedIn, user, logout } = useAuth();
  const { favoritesCount } = useFavorites();

  const filteredResults = query.trim()
    ? mockSearchData
        .filter((item) => {
          const normalizedQuery = query.toLowerCase();
          return (
            item.name.toLowerCase().includes(normalizedQuery) ||
            (item.type === "creator" &&
              item.platform?.toLowerCase().includes(normalizedQuery)) ||
            (item.type === "restaurant" &&
              (item.address?.toLowerCase().includes(normalizedQuery) ||
                item.category?.toLowerCase().includes(normalizedQuery)))
          );
        })
        .slice(0, 8)
    : [];

  const showDropdown =
    isFocused && (filteredResults.length > 0 || (!query.trim() && recentSearches.length > 0));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (searchRef.current && !searchRef.current.contains(target)) {
        setIsFocused(false);
      }

      if (loginRef.current && !loginRef.current.contains(target)) {
        setShowLoginPanel(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current);
      }
    };
  }, []);

  const handleLoginEnter = useCallback(() => {
    if (loginTimeoutRef.current) {
      clearTimeout(loginTimeoutRef.current);
      loginTimeoutRef.current = null;
    }
    setShowLoginPanel(true);
  }, []);

  const handleLoginLeave = useCallback(() => {
    loginTimeoutRef.current = setTimeout(() => {
      setShowLoginPanel(false);
    }, 180);
  }, []);

  const handleSelect = useCallback(
    (item: SearchResult) => {
      setRecentSearches((prev) => {
        const withoutCurrent = prev.filter((entry) => entry.id !== item.id);
        const updated = [item, ...withoutCurrent];
        saveRecentSearches(updated);
        return updated;
      });

      setQuery(item.name);
      setIsFocused(false);

      if (item.type === "restaurant") {
        navigate(`/map?type=restaurant&value=${encodeURIComponent(item.id)}`);
        return;
      }

      if (item.type === "creator") {
        navigate(`/map?type=creator&value=${encodeURIComponent(item.id)}`);
        return;
      }

      if (item.type === "region") {
        navigate(`/map?type=region&value=${encodeURIComponent(item.name)}`);
        return;
      }

      if (item.type === "food") {
        navigate(`/map?type=food&value=${encodeURIComponent(item.name)}`);
        return;
      }

      navigate("/map");
    },
    [navigate]
  );

  const handleDeleteRecent = useCallback((id: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveRecentSearches(updated);
      return updated;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_KEY);
  }, []);

  const handlePrimarySearch = useCallback(() => {
    if (filteredResults.length > 0) {
      const activeResult = filteredResults[Math.max(hoveredIndex, 0)] ?? filteredResults[0];
      handleSelect(activeResult);
      return;
    }

    navigate("/explore");
  }, [filteredResults, handleSelect, hoveredIndex, navigate]);

  const handleSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHoveredIndex((prev) =>
          Math.min(prev + 1, Math.max(filteredResults.length, recentSearches.length) - 1)
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHoveredIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();

        const activeList = query.trim() ? filteredResults : recentSearches;
        const selected = activeList[hoveredIndex] ?? activeList[0];

        if (selected) {
          handleSelect(selected);
          return;
        }

        handlePrimarySearch();
      }
    },
    [filteredResults, handlePrimarySearch, handleSelect, hoveredIndex, query, recentSearches]
  );

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fffdfd] text-[#171717]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0)_0%,rgba(255,255,255,0.25)_40%,rgba(255,255,255,0.92)_78%,rgba(255,255,255,0.98)_100%)]" />
        <img
          src={matpickLogo}
          alt=""
          className="absolute left-1/2 top-[55%] h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.18] sm:h-[760px] sm:w-[760px] lg:h-[980px] lg:w-[980px]"
        />
      </div>

      <header className="relative z-20 flex items-start justify-between px-4 py-4 sm:px-8">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="rounded-full bg-white/45 p-1 shadow-[0_8px_20px_rgba(0,0,0,0.04)] backdrop-blur-sm"
        >
          <img src={matpickLogo} alt="맛픽 로고" className="h-8 w-8 object-contain opacity-70" />
        </button>

        <div className="flex items-start gap-3">
          {isLoggedIn && (
            <button
              type="button"
              onClick={() => navigate("/my/favorites")}
              className="rounded-full border border-[#ffd0d0] bg-white/90 px-4 py-2 text-sm font-semibold text-[#4d4d4d] shadow-[0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur"
            >
              저장한 맛집 {favoritesCount}
            </button>
          )}

          {isLoggedIn ? (
            <button
              type="button"
              onClick={logout}
              className="rounded-full bg-[#ff7f7f] px-7 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(255,105,135,0.24)] transition hover:brightness-95"
            >
              {user?.name ?? "로그아웃"}
            </button>
          ) : (
            <div
              ref={loginRef}
              className="relative"
              onMouseEnter={handleLoginEnter}
              onMouseLeave={handleLoginLeave}
            >
              <button
                type="button"
                onClick={() => setShowLoginPanel((prev) => !prev)}
                className="rounded-full bg-[#ff7f7f] px-8 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(255,105,135,0.24)] transition hover:brightness-95"
              >
                로그인
              </button>

              <div
                className={`absolute right-0 top-full z-30 mt-4 origin-top-right transition-all duration-200 ${
                  showLoginPanel
                    ? "pointer-events-auto translate-y-0 opacity-100"
                    : "pointer-events-none -translate-y-2 opacity-0"
                }`}
              >
                <GuestPanel redirectTo={redirectTo} />
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-88px)] flex-col items-center justify-center px-4 pb-16 pt-4 text-center sm:px-8">
        <section className="mx-auto flex w-full max-w-[980px] flex-col items-center">
          <h1
            className="text-[88px] font-black leading-none tracking-[-0.08em] sm:text-[108px] lg:text-[126px]"
            style={{ fontFamily: "'Black Han Sans', sans-serif" }}
          >
            <span className="text-[#111111]">맛</span>
            <span className="text-[#ff6d78]">픽</span>
          </h1>

          <p className="mt-7 text-[24px] font-semibold leading-tight text-[#9a9a9a] sm:text-[34px]">
            유튜브, 인스타 크리에이터들이 방문한 맛집을 한곳에서 찾아보세요!
          </p>

          <div ref={searchRef} className="relative mt-10 w-full max-w-[810px]">
            <div
              className={`rounded-[28px] border border-[#ffb2b2] bg-white/96 shadow-[0_18px_60px_rgba(255,102,132,0.14)] backdrop-blur-sm transition ${
                showDropdown ? "rounded-b-none" : ""
              }`}
            >
              <div className="flex items-center gap-4 px-6 py-5 sm:px-8">
                <input
                  type="text"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setHoveredIndex(-1);
                  }}
                  onFocus={() => setIsFocused(true)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="맛집, 크리에이터, 지역, 음식을 검색해 보세요!"
                  className="w-full bg-transparent text-lg font-medium text-[#202020] outline-none placeholder:text-[#b7b7b7] sm:text-2xl"
                />
                <button
                  type="button"
                  onClick={handlePrimarySearch}
                  className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-[#111] transition hover:bg-[#fff5f5]"
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <circle cx="11" cy="11" r="7" />
                    <line x1="20" y1="20" x2="16.6" y2="16.6" />
                  </svg>
                </button>
              </div>
            </div>

            {showDropdown && (
              <div className="absolute left-0 right-0 z-30 overflow-hidden rounded-b-[28px] border border-t-0 border-[#ffb2b2] bg-white shadow-[0_24px_80px_rgba(255,102,132,0.14)]">
                {query.trim() && filteredResults.length > 0 && (
                  <div className="py-2">
                    {filteredResults.map((item, index) => (
                      <SearchResultItem
                        key={item.id}
                        item={item}
                        isHovered={hoveredIndex === index}
                        onHover={() => setHoveredIndex(index)}
                        onLeave={() => setHoveredIndex(-1)}
                        onSelect={() => handleSelect(item)}
                      />
                    ))}
                  </div>
                )}

                {!query.trim() && recentSearches.length > 0 && (
                  <div className="py-2">
                    <div className="flex items-center justify-between px-5 py-2">
                      <p className="text-sm font-semibold text-[#222]">최근 검색</p>
                      <button
                        type="button"
                        onClick={handleClearAll}
                        className="text-xs font-medium text-[#999] transition hover:text-[#ff6a6a]"
                      >
                        모두 지우기
                      </button>
                    </div>
                    {recentSearches.map((item, index) => (
                      <SearchResultItem
                        key={item.id}
                        item={item}
                        isHovered={hoveredIndex === index}
                        onHover={() => setHoveredIndex(index)}
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
        </section>
      </main>
    </div>
  );
}
