import { motion } from "framer-motion";
import { ArrowLeft, Bookmark, CircleUserRound, Star } from "lucide-react";
import { Link, useLocation } from "wouter";
import HeartButton from "@/components/HeartButton";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { restaurants } from "@/data";
import { getDisplayName } from "@/lib/authProfile";
import { getUserRestaurantRating } from "@/lib/restaurantRatings";

function RatingPreview({
  userId,
  restaurantId,
}: {
  userId: string;
  restaurantId: string;
}) {
  const rating = getUserRestaurantRating(userId, restaurantId);

  if (!rating) {
    return null;
  }

  return (
    <div className="mt-3 flex items-center gap-2 text-sm text-[#444]">
      <span className="text-[#ffb24a]">{Array.from({ length: rating.stars }, () => "★").join("")}</span>
      <span className="font-medium">내 평점 {rating.stars}/5</span>
    </div>
  );
}

export default function MyFavorites() {
  const [, navigate] = useLocation();
  const { isLoggedIn, user } = useAuth();
  const { favorites } = useFavorites();

  const favoriteRestaurants = restaurants.filter((restaurant) => favorites.has(restaurant.id));

  if (!isLoggedIn || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#fffaf9_0%,#fff3f6_100%)] px-4">
        <div className="w-full max-w-md rounded-[32px] border border-[#ffd4d8] bg-white px-8 py-10 text-center shadow-[0_24px_80px_rgba(255,105,135,0.16)]">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff6a6a_0%,#ff00d4_100%)] text-white">
            <Bookmark className="h-7 w-7" />
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
    <div className="min-h-screen bg-[linear-gradient(135deg,#f8f9fa_0%,#f7f1f3_100%)]">
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-[#ececec] bg-white/92 px-6 py-4 shadow-[0_4px_18px_rgba(0,0,0,0.04)] backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e5e5e5] bg-white text-[#333] transition hover:border-[#ff8e8e] hover:bg-[#fff5f5]"
            aria-label="뒤로 가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <Link href="/" className="no-underline">
            <span
              className="text-2xl font-black tracking-[-0.08em]"
              style={{ fontFamily: "'Black Han Sans', sans-serif" }}
            >
              <span className="text-[#111111]">맛</span>
              <span className="text-[#ff7b83]">픽</span>
            </span>
          </Link>
        </div>

        <button
          type="button"
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 rounded-full border border-[#ece7e8] bg-white px-4 py-2 text-sm font-semibold text-[#555] transition hover:border-[#ffd0d5] hover:bg-[#fff8f9]"
        >
          <CircleUserRound className="h-4 w-4 text-[#ff7b83]" />
          <span>{getDisplayName(user)}</span>
        </button>
      </nav>

      <div className="mx-auto max-w-[1200px] px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <h1 className="text-3xl font-black text-[#171717]">저장한 맛집</h1>
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
            <div className="text-6xl">💗</div>
            <p className="mt-5 text-xl font-semibold text-[#202020]">
              아직 저장한 맛집이 없어요.
            </p>
            <p className="mt-2 text-sm text-[#8a8a8a]">
              마음에 드는 맛집을 찜해 두면 여기에 모아볼 수 있어요.
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
                      {restaurant.category ? (
                        <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                          {restaurant.category}
                        </div>
                      ) : null}
                    </div>

                    <div className="p-5">
                      <h2 className="text-lg font-bold text-[#1b1b1b]">{restaurant.name}</h2>
                      <p className="mt-1 text-sm text-[#878787]">{restaurant.address}</p>
                      {restaurant.representativeMenu ? (
                        <p className="mt-3 line-clamp-1 text-sm font-medium text-[#ff6b6b]">
                          대표 메뉴 · {restaurant.representativeMenu}
                        </p>
                      ) : null}

                      <RatingPreview userId={user.id} restaurantId={restaurant.id} />

                      {restaurant.foundingYear ? (
                        <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#fff5f6] px-3 py-1 text-xs font-semibold text-[#ff7b83]">
                          <Star className="h-3.5 w-3.5" />
                          {restaurant.foundingYear}년 시작
                        </div>
                      ) : null}
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
