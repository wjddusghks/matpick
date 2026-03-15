/*
 * MyFavorites — 찜한 식당 목록 페이지
 * 로그인 사용자만 접근 가능, 비로그인 시 로그인 안내
 */
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { restaurants } from "@/data";
import HeartButton from "@/components/HeartButton";

export default function MyFavorites() {
  const [, navigate] = useLocation();
  const { isLoggedIn, user, login } = useAuth();
  const { favorites } = useFavorites();

  const favoriteRestaurants = restaurants.filter((r) => favorites.has(r.id));

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">❤️</div>
          <h2 className="text-xl font-bold text-[#1a1a1a] mb-2">데모 로그인이 필요합니다</h2>
          <p className="text-sm text-[#888] mb-6">찜한 맛집 목록은 데모 로그인 후 현재 브라우저에 임시 저장됩니다.</p>
          <button
            onClick={() => login()}
            className="px-8 py-3 rounded-full bg-[#FD7979] text-white font-semibold border-none hover:bg-[#fd6060] transition-colors cursor-pointer"
          >
            데모 로그인하기
          </button>
          <button
            onClick={() => navigate("/")}
            className="block mx-auto mt-3 text-sm text-[#999] bg-transparent border-none cursor-pointer hover:text-[#FD7979] transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #f8f9fa 0%, #f0f2f5 100%)" }}>
      {/* 상단 네비게이션 */}
      <nav className="bg-white border-b border-[#e8e8e8] px-8 py-3 flex items-center justify-between sticky top-0 z-50 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="w-9 h-9 rounded-lg border border-[#e0e0e0] bg-white flex items-center justify-center text-lg hover:border-[#FD7979] hover:bg-[#FFF5F5] transition-all cursor-pointer"
          >
            ←
          </button>
          <Link href="/" className="no-underline">
            <span className="text-xl font-black text-[#1a1a1a]">맛<span className="text-[#FD7979]">픽</span></span>
          </Link>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#666]">
          <span>👤 {user?.name}</span>
        </div>
      </nav>

      {/* 메인 콘텐츠 */}
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <h1 className="text-2xl font-[800] text-[#1a1a1a]">❤️ 데모 찜한 맛집</h1>
          <span className="px-3 py-1 rounded-full bg-[#FD7979] text-white text-sm font-bold">
            {favoriteRestaurants.length}개
          </span>
        </div>

        {favoriteRestaurants.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="text-6xl mb-4">🍽️</div>
            <p className="text-lg text-[#888] mb-2">아직 데모 찜한 맛집이 없습니다</p>
            <p className="text-sm text-[#aaa] mb-6">마음에 드는 맛집의 하트를 눌러보세요!</p>
            <button
              onClick={() => navigate("/explore")}
              className="px-6 py-2.5 rounded-full bg-[#FD7979] text-white font-semibold border-none hover:bg-[#fd6060] transition-colors cursor-pointer"
            >
              맛집 탐색하기
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {favoriteRestaurants.map((restaurant, i) => (
              <motion.div
                key={restaurant.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/restaurant/${restaurant.id}`} className="no-underline">
                  <div className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-1 cursor-pointer">
                    {/* 이미지 */}
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <img
                        src={restaurant.imageUrl || "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=250&fit=crop"}
                        alt={restaurant.name}
                        className="w-full h-full object-cover"
                      />
                      {/* 하트 버튼 */}
                      <div className="absolute top-3 right-3">
                        <HeartButton restaurantId={restaurant.id} size="md" />
                      </div>
                      {/* 카테고리 배지 */}
                      {restaurant.category && (
                        <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs font-medium">
                          {restaurant.category}
                        </div>
                      )}
                    </div>

                    {/* 정보 */}
                    <div className="p-4">
                      <h3 className="text-base font-bold text-[#1a1a1a] mb-1">{restaurant.name}</h3>
                      <p className="text-xs text-[#888] mb-2">📍 {restaurant.address}</p>
                      {restaurant.representativeMenu && (
                        <p className="text-xs text-[#FD7979] font-medium line-clamp-1">
                          🍽️ {restaurant.representativeMenu}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
