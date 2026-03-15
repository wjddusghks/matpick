import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLocation } from "wouter";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { mockSearchData, type SearchResult } from "@/data";

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

function MatpickMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="matpick-mark-gradient" x1="8" y1="10" x2="52" y2="54">
          <stop offset="0%" stopColor="#ff6161" />
          <stop offset="100%" stopColor="#ff00d4" />
        </linearGradient>
      </defs>
      <g opacity="0.95">
        <path
          d="M16 8c1.8 0 3 1.2 3 3v10.8l4.8-4.8c1.8-1.8 4.8-.5 4.8 2.1V34a6 6 0 0 1-1.8 4.2l-3.8 3.8L43 61.1a3.6 3.6 0 1 1-5.1 5.1L19 47.2l-3.8 3.8A6 6 0 0 1 11 52.8H10c-2.6 0-3.9-3.1-2.1-4.9l4.8-4.8H11c-1.8 0-3-1.2-3-3V11c0-1.8 1.2-3 3-3h5Z"
          fill="url(#matpick-mark-gradient)"
        />
        <path
          d="M48.5 7.2c7.7 0 14 6.3 14 14 0 10.8-8.8 19.5-19.6 19.5a19.4 19.4 0 0 1-7.8-1.6L17.8 56.5a3.6 3.6 0 1 1-5.1-5.1l17.3-17.3a19.4 19.4 0 0 1-1.6-7.8c0-10.8 8.8-19.5 19.6-19.5Z"
          fill="#cfc2f4"
          opacity="0.68"
        />
      </g>
    </svg>
  );
}

function HeroUtensils() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute left-1/2 top-1/2 h-[820px] w-[820px] -translate-x-1/2 -translate-y-1/2 opacity-50">
        <svg viewBox="0 0 900 900" className="h-full w-full" fill="none">
          <defs>
            <linearGradient id="forkGradient" x1="120" y1="120" x2="760" y2="760">
              <stop offset="0%" stopColor="#ffb3c7" />
              <stop offset="100%" stopColor="#ff8a8a" />
            </linearGradient>
            <linearGradient id="spoonGradient" x1="220" y1="160" x2="760" y2="640">
              <stop offset="0%" stopColor="#e4c4ff" />
              <stop offset="100%" stopColor="#cdbaff" />
            </linearGradient>
          </defs>
          <g transform="translate(180 130) rotate(-44 220 320)">
            <rect
              x="176"
              y="275"
              width="88"
              height="430"
              rx="44"
              fill="url(#forkGradient)"
              opacity="0.72"
            />
            <rect x="118" y="110" width="46" height="240" rx="23" fill="url(#forkGradient)" opacity="0.72" />
            <rect x="178" y="88" width="46" height="262" rx="23" fill="url(#forkGradient)" opacity="0.72" />
            <rect x="238" y="110" width="46" height="240" rx="23" fill="url(#forkGradient)" opacity="0.72" />
            <rect x="298" y="140" width="46" height="210" rx="23" fill="url(#forkGradient)" opacity="0.72" />
          </g>
          <g transform="translate(450 100) rotate(42 140 360)">
            <rect
              x="96"
              y="286"
              width="88"
              height="448"
              rx="44"
              fill="url(#spoonGradient)"
              opacity="0.72"
            />
            <ellipse
              cx="140"
              cy="200"
              rx="134"
              ry="182"
              fill="url(#spoonGradient)"
              opacity="0.72"
            />
          </g>
        </svg>
      </div>
    </div>
  );
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
        <p className="truncate text-[13px] text-[#8a8a8a]">
          {item.type === "creator" && `${item.platform ?? "크리에이터"} · 구독자 ${item.subscribers ?? "-"}`}
          {item.type === "region" &&
            `${item.parentRegion ?? "지역"} · 맛집 ${item.restaurantCount?.toLocaleString() ?? 0}곳`}
          {item.type === "food" &&
            `음식 카테고리 · 맛집 ${item.restaurantCount?.toLocaleString() ?? 0}곳`}
          {item.type === "restaurant" && `${item.category ?? "맛집"} · ${item.address ?? ""}`}
        </p>
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

function LoggedInPanel({
  favoritesCount,
  userName,
  onOpenFavorites,
  onLogout,
}: {
  favoritesCount: number;
  userName: string;
  onOpenFavorites: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-[#ffd3d9] bg-white/95 p-6 shadow-[0_24px_80px_rgba(255,105,135,0.16)] backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff7b8b]">Welcome</p>
      <h2 className="mt-2 text-2xl font-black text-[#141414]">{userName}님</h2>
      <p className="mt-2 text-sm leading-6 text-[#7e7e7e]">
        저장한 맛집을 모아보고, 마음에 드는 곳을 더 빠르게 다시 찾을 수 있어요.
      </p>
      <div className="mt-6 rounded-3xl bg-[linear-gradient(135deg,#fff3f3_0%,#fffafb_100%)] px-5 py-4">
        <p className="text-xs font-semibold text-[#8a8a8a]">현재 저장한 맛집</p>
        <p className="mt-1 text-3xl font-black text-[#ff5d7a]">{favoritesCount}</p>
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={onOpenFavorites}
          className="rounded-xl bg-[#ff7272] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95"
        >
          저장한 맛집 보기
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-xl border border-[#ffd0d0] px-4 py-3 text-sm font-semibold text-[#5a5a5a] transition hover:bg-[#fff5f5]"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}

function GuestPanel({ redirectTo }: { redirectTo: string }) {
  return (
    <div className="rounded-[28px] border border-[#ffd3d9] bg-white/95 p-6 shadow-[0_24px_80px_rgba(255,105,135,0.16)] backdrop-blur">
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
  const searchRef = useRef<HTMLDivElement>(null);
  const loginPanelRef = useRef<HTMLDivElement>(null);
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
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  const scrollToLoginPanel = useCallback(() => {
    loginPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fffdfd] text-[#171717]">
      <HeroUtensils />

      <header className="relative z-20 flex items-center justify-between px-4 py-4 sm:px-8">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-3 rounded-full bg-transparent text-left"
        >
          <MatpickMark className="h-9 w-9" />
        </button>

        {isLoggedIn ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/my/favorites")}
              className="rounded-full border border-[#ffd0d0] bg-white/85 px-4 py-2 text-sm font-semibold text-[#444] shadow-[0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur transition hover:bg-white"
            >
              저장한 맛집 {favoritesCount}
            </button>
            <button
              type="button"
              onClick={() => navigate("/my/favorites")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff7777_0%,#ff00d4_100%)] text-sm font-bold text-white shadow-[0_10px_25px_rgba(255,65,121,0.28)]"
            >
              {user?.name?.charAt(0) ?? "M"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={scrollToLoginPanel}
            className="rounded-full bg-[#ff7f7f] px-8 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(255,105,135,0.24)] transition hover:brightness-95"
          >
            로그인
          </button>
        )}
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-88px)] flex-col justify-center px-4 pb-10 pt-8 sm:px-8 lg:pr-[360px]">
        <section className="mx-auto flex w-full max-w-[980px] flex-col items-center text-center">
          <h1
            className="text-[84px] font-black leading-none tracking-[-0.06em] text-transparent sm:text-[108px] lg:text-[126px]"
            style={{
              fontFamily: "'Black Han Sans', sans-serif",
              backgroundImage: "linear-gradient(135deg, #ff1b1b 0%, #ff00d4 88%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
            }}
          >
            맛픽
          </h1>

          <p className="mt-7 text-[22px] font-semibold leading-tight text-[#9d9d9d] sm:text-[30px]">
            <span className="text-[#ff164d]">유튜브</span>,{" "}
            <span className="text-[#ff00d4]">인스타</span> 크리에이터들이 방문한 맛집을
            한곳에서 찾아보세요!
          </p>

          <div ref={searchRef} className="relative mt-10 w-full max-w-[810px]">
            <div
              className={`rounded-[28px] border border-[#ffb2b2] bg-white shadow-[0_18px_60px_rgba(255,102,132,0.14)] transition ${
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

          <div className="mt-6 flex items-center gap-3 text-sm font-medium text-[#a6a6a6]">
            <span className="text-base text-[#111]">✦</span>
            <span>AI 검색: “여자친구랑 강남에서 분위기 좋은 이탈리안 추천해줘”</span>
          </div>

          <div ref={loginPanelRef} className="mt-10 w-full max-w-sm lg:hidden">
            {isLoggedIn ? (
              <LoggedInPanel
                favoritesCount={favoritesCount}
                userName={user?.name ?? "맛픽 사용자"}
                onOpenFavorites={() => navigate("/my/favorites")}
                onLogout={logout}
              />
            ) : (
              <GuestPanel redirectTo={redirectTo} />
            )}
          </div>
        </section>

        <aside className="hidden lg:fixed lg:right-8 lg:top-1/2 lg:block lg:w-[280px] lg:-translate-y-1/2">
          {isLoggedIn ? (
            <LoggedInPanel
              favoritesCount={favoritesCount}
              userName={user?.name ?? "맛픽 사용자"}
              onOpenFavorites={() => navigate("/my/favorites")}
              onLogout={logout}
            />
          ) : (
            <GuestPanel redirectTo={redirectTo} />
          )}
        </aside>
      </main>
    </div>
  );
}
