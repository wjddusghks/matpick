import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import HeartButton from "@/components/HeartButton";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { restaurants } from "@/data";

export default function MyFavorites() {
  const [, navigate] = useLocation();
  const { isLoggedIn, user } = useAuth();
  const { favorites } = useFavorites();

  const favoriteRestaurants = restaurants.filter((restaurant) =>
    favorites.has(restaurant.id)
  );

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#fffaf9_0%,#fff3f6_100%)] px-4">
        <div className="w-full max-w-md rounded-[32px] border border-[#ffd4d8] bg-white px-8 py-10 text-center shadow-[0_24px_80px_rgba(255,105,135,0.16)]">
          <div className="mx-auto mb-5 flex h-18 w-18 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff6a6a_0%,#ff00d4_100%)] text-2xl font-black text-white">
            ❤
          </div>
          <h1 className="text-2xl font-black text-[#161616]">로그인이 필요합니다</h1>
          <p className="mt-3 text-sm leading-6 text-[#7f7f7f]">
            저장한 맛집은 로그인한 계정 기준으로 보관됩니다. 카카오나 네이버로
            로그인하고 나만의 맛집 리스트를 모아보세요.
          </p>
          <SocialLoginButtons redirectTo="/my/favorites" className="mt-6" />
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-4 text-sm font-semibold text-[#9b9b9b] transition hover:text-[#ff6a6a]"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f8f9fa_0%,#f0f2f5_100%)]">
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-[#ececec] bg-white/92 px-6 py-4 shadow-[0_4px_18px_rgba(0,0,0,0.04)] backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e5e5e5] bg-white text-[#333] transition hover:border-[#ff8e8e] hover:bg-[#fff5f5]"
          >
            ←
          </button>
          <Link href="/" className="no-underline">
            <span
              className="bg-[linear-gradient(135deg,#ff1b1b_0%,#ff00d4_88%)] bg-clip-text text-2xl font-black tracking-[-0.08em] text-transparent"
              style={{ fontFamily: "'Black Han Sans', sans-serif" }}
            >
              맛픽
            </span>
          </Link>
        </div>
        <div className="text-sm font-medium text-[#666]">{user?.name}</div>
      </nav>

      <div className="mx-auto max-w-[1200px] px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <h1 className="text-3xl font-black text-[#171717]">내가 저장한 맛집</h1>
          <span className="rounded-full bg-[#ff7272] px-3 py-1 text-sm font-bold text-white">
            {favoriteRestaurants.length}곳
          </span>
        </div>

        {favoriteRestaurants.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[28px] border border-[#ececec] bg-white px-8 py-16 text-center shadow-[0_18px_54px_rgba(0,0,0,0.06)]"
          >
            <div className="text-6xl">🍽️</div>
            <p className="mt-5 text-xl font-semibold text-[#202020]">
              아직 저장한 맛집이 없어요
            </p>
            <p className="mt-2 text-sm text-[#8a8a8a]">
              마음에 드는 맛집에 하트를 눌러 나만의 리스트를 만들어 보세요.
            </p>
            <button
              type="button"
              onClick={() => navigate("/explore")}
              className="mt-6 rounded-full bg-[#ff7272] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-95"
            >
              맛집 둘러보기
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {favoriteRestaurants.map((restaurant, index) => (
              <motion.div
                key={restaurant.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Link href={`/restaurant/${restaurant.id}`} className="no-underline">
                  <article className="overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_16px_50px_rgba(0,0,0,0.08)] transition hover:-translate-y-1 hover:shadow-[0_20px_64px_rgba(0,0,0,0.12)]">
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <img
                        src={
                          restaurant.imageUrl ||
                          "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=250&fit=crop"
                        }
                        alt={restaurant.name}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute right-3 top-3">
                        <HeartButton restaurantId={restaurant.id} size="md" />
                      </div>
                      {restaurant.category && (
                        <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                          {restaurant.category}
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      <h2 className="text-lg font-bold text-[#1b1b1b]">{restaurant.name}</h2>
                      <p className="mt-1 text-sm text-[#878787]">{restaurant.address}</p>
                      {restaurant.representativeMenu && (
                        <p className="mt-3 line-clamp-1 text-sm font-medium text-[#ff6b6b]">
                          대표 메뉴 · {restaurant.representativeMenu}
                        </p>
                      )}
                    </div>
                  </article>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
