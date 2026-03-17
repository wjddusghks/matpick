/*
 * RestaurantCard — "Warm Kitchen Table" Design
 * Organic card with stamp badges for creator recommendations
 * Hover: card lifts with deeper shadow
 */
import { Link } from "wouter";
import { MapPin, Tag } from "lucide-react";
import { motion } from "framer-motion";
import type { Restaurant } from "@/data";
import { getCreatorsByRestaurant, getRecommendationCount } from "@/data";

interface Props {
  restaurant: Restaurant;
  index: number;
}

export default function RestaurantCard({ restaurant, index }: Props) {
  const recommenders = getCreatorsByRestaurant(restaurant.id);
  const recCount = getRecommendationCount(restaurant.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: "easeOut" }}
    >
      <Link href={`/restaurant/${restaurant.id}`} className="block no-underline group">
        <div className="bg-card rounded-xl overflow-hidden border border-border/50 shadow-sm transition-all duration-300 group-hover:shadow-lg group-hover:-translate-y-1">
          {/* Image */}
          <div className="relative aspect-[4/3] overflow-hidden">
            <img
              src={restaurant.imageUrl}
              alt={restaurant.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            {/* Recommendation count badge */}
            {recCount > 1 && (
              <div className="absolute top-3 right-3 bg-primary text-primary-foreground text-xs font-bold px-2.5 py-1 rounded-full shadow-md">
                {recCount}명 추천
              </div>
            )}
            {/* Category tag */}
            <div className="absolute bottom-3 left-3 bg-background/85 backdrop-blur-sm text-foreground text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {restaurant.category}
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-2.5">
            <h3
              className="text-lg font-bold text-card-foreground leading-snug"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {restaurant.name}
            </h3>

            <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{restaurant.address}</span>
            </div>

            <div className="price-tag">{restaurant.representativeMenu}</div>

            {/* Creator stamp badges */}
            <div className="flex flex-wrap gap-2 pt-1">
              {recommenders.map((creator, i) => (
                <span key={creator.id} className="stamp-badge" style={
                  i === 0
                    ? {}
                    : i === 1
                    ? { borderColor: "oklch(0.55 0.06 140)", color: "oklch(0.55 0.06 140)", transform: "rotate(1.5deg)" }
                    : { borderColor: "oklch(0.50 0.10 30)", color: "oklch(0.50 0.10 30)", transform: "rotate(-1deg)" }
                }>
                  {(() => {
                    const displayName = creator.series === "또간집" ? "또간집" : creator.name;
                    return displayName.length > 8 ? `${displayName.slice(0, 8)}…` : displayName;
                  })()}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
