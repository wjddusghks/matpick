import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";

interface HeartButtonProps {
  restaurantId: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showLabel?: boolean;
}

const sizeMap = {
  sm: { button: "h-8 w-8", icon: 16, label: "text-xs" },
  md: { button: "h-9 w-9", icon: 20, label: "text-sm" },
  lg: { button: "h-11 w-11", icon: 24, label: "text-base" },
};

export default function HeartButton({
  restaurantId,
  size = "md",
  className = "",
  showLabel = false,
}: HeartButtonProps) {
  const { isLoggedIn } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [isAnimating, setIsAnimating] = useState(false);

  const liked = isFavorite(restaurantId);
  const sizing = sizeMap[size];

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isLoggedIn) {
      toast("로그인이 필요해요", {
        description: "찜한 맛집은 로그인한 계정 기준으로 저장됩니다.",
        action: {
          label: "홈으로",
          onClick: () => {
            window.location.assign("/");
          },
        },
      });
      return;
    }

    setIsAnimating(true);
    const nextState = toggleFavorite(restaurantId);

    if (nextState) {
      toast.success("찜한 맛집에 추가했어요.", { duration: 1500 });
    } else {
      toast("찜한 맛집에서 제거했어요.", { duration: 1500 });
    }

    window.setTimeout(() => setIsAnimating(false), 400);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`relative flex items-center justify-center rounded-full border-none transition-all duration-200 ${sizing.button} ${
        liked
          ? "bg-red-50 hover:bg-red-100"
          : "border border-gray-200 bg-white/85 hover:bg-white"
      } ${className}`}
      aria-label={liked ? "찜 해제" : "찜하기"}
      title={liked ? "찜 해제" : "찜하기"}
    >
      <AnimatePresence>
        {isAnimating && liked ? (
          <motion.div
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: 2.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute inset-0 rounded-full bg-red-300"
          />
        ) : null}
      </AnimatePresence>

      <motion.svg
        width={sizing.icon}
        height={sizing.icon}
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

      {showLabel ? (
        <span
          className={`ml-1.5 font-medium ${sizing.label} ${
            liked ? "text-[#FD7979]" : "text-[#999]"
          }`}
        >
          {liked ? "찜됨" : "찜하기"}
        </span>
      ) : null}
    </button>
  );
}
