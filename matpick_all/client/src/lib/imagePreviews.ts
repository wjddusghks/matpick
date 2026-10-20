import restaurantImagePreviews from "@/data/generated/restaurant-image-previews.json";

const RESTAURANT_IMAGE_PREVIEWS = restaurantImagePreviews as Record<string, string>;

const RETIRED_STATIC_IMAGE_PREFIXES = [
  "/card-data/",
  "/card-previews/",
  "/restaurant-image-previews/",
  "/source-covers/",
  "/dining-moments/",
] as const;

export function isRetiredStaticImageUrl(imageUrl?: string | null) {
  const trimmed = imageUrl?.trim() ?? "";
  return RETIRED_STATIC_IMAGE_PREFIXES.some(prefix => trimmed.startsWith(prefix));
}

export function getOptimizedCardImageUrl(imageUrl?: string | null) {
  const trimmed = imageUrl?.trim() ?? "";

  if (!trimmed) {
    return "";
  }

  if (isRetiredStaticImageUrl(trimmed)) {
    return "";
  }

  return RESTAURANT_IMAGE_PREVIEWS[trimmed] ?? trimmed;
}
