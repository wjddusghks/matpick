import restaurantImagePreviews from "@/data/generated/restaurant-image-previews.json";

const RESTAURANT_IMAGE_PREVIEWS = restaurantImagePreviews as Record<string, string>;

export function getOptimizedCardImageUrl(imageUrl?: string | null) {
  const trimmed = imageUrl?.trim() ?? "";

  if (!trimmed) {
    return "";
  }

  return RESTAURANT_IMAGE_PREVIEWS[trimmed] ?? trimmed;
}
