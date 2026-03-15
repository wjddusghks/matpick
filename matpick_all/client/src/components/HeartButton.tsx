/*
 * HeartButton — 찜하기 하트 버튼
 * 비로그인: 클릭 시 로그인 안내 토스트
 * 로그인: 빈 하트 ↔ 빨간 하트 토글 + 애니메이션
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { toast } from "sonner";

interface HeartButtonProps {
  restaurantId: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showLabel?: boolean;
}

const sizeMap = {
  sm: { button: "w-8 h-8", icon: 16, label: "text-xs" },
  md: { button: "w-9 h-9", icon: 20, label: "text-sm" },
  lg: { button: "w-11 h-11", icon: 24, label: "text-base" },
};

export default function HeartButton({ restaurantId, size = "md", className = "", showLabel = false }: HeartButtonProps) {
  const { isLoggedIn } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [isAnimating, setIsAnimating] = useState(false);

  const liked = isFavorite(restaurantId);
  const s = sizeMap[size];

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isLoggedIn) {
      toast("데모 로그인이 필요합니다", {
        description: "찜하기는 현재 브라우저 저장 기반 데모 기능입니다.",
        action: {
          label: "데모 로그인",
          onClick: () => {
            toast.info("홈 화면의 데모 로그인으로 바로 체험할 수 있습니다.");
          },
        },
      });
      return;
    }

    setIsAnimating(true);
    const newState = toggleFavorite(restaurantId);
    
    if (newState) {
      toast.success("데모 찜 목록에 추가했습니다", { duration: 1500 });
    } else {
      toast("데모 찜 목록에서 제거했습니다", { duration: 1500 });
    }

    setTimeout(() => setIsAnimating(false), 400);
  };

  return (
    <button
      onClick={handleClick}
      className={`relative flex items-center justify-center rounded-full transition-all duration-200 border-none cursor-pointer ${s.button} ${
        liked
          ? "bg-red-50 hover:bg-red-100"
          : "bg-white/80 hover:bg-white border border-gray-200"
      } ${className}`}
      aria-label={liked ? "찜 해제" : "찜하기"}
      title={liked ? "찜 해제" : "찜하기"}
    >
      {/* 클릭 시 퍼지는 원형 이펙트 */}
      <AnimatePresence>
        {isAnimating && liked && (
          <motion.div
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: 2.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute inset-0 rounded-full bg-red-300"
          />
        )}
      </AnimatePresence>

      {/* 하트 아이콘 */}
      <motion.svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 24 24"
        animate={isAnimating ? { scale: [1, 1.3, 0.9, 1.1, 1] } : { scale: 1 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="relative z-10"
      >
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          fill={liked ? "#FD7979" : "none"}
          stroke={liked ? "#FD7979" : "#999"}
          strokeWidth={liked ? "0" : "1.5"}
        />
      </motion.svg>

      {/* 라벨 (선택적) */}
      {showLabel && (
        <span className={`ml-1.5 font-medium ${s.label} ${liked ? "text-[#FD7979]" : "text-[#999]"}`}>
          {liked ? "찜" : "찜하기"}
        </span>
      )}
    </button>
  );
}
