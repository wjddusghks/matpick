import type { Restaurant } from "@/data";
import RecommendationCard from "./RecommendationCard";

export default function RestaurantCard({
  restaurant,
}: {
  restaurant: Restaurant;
  index: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#eee7e9]">
      <RecommendationCard restaurant={restaurant} />
    </div>
  );
}
