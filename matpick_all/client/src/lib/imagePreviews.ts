import restaurantImagePreviews from "@/data/generated/restaurant-image-previews.json";

const RESTAURANT_IMAGE_PREVIEWS = restaurantImagePreviews as Record<string, string>;

export function isRetiredStaticImageUrl(imageUrl?: string | null) {
  const trimmed = imageUrl?.trim() ?? "";
  return (
    trimmed.startsWith("/card-data/") &&
    !RESTAURANT_IMAGE_PREVIEWS[trimmed.split(/[?#]/, 1)[0]]
  );
}

export function getOptimizedCardImageUrl(imageUrl?: string | null) {
  const trimmed = imageUrl?.trim() ?? "";

  if (!trimmed) {
    return "";
  }

  const previewUrl = RESTAURANT_IMAGE_PREVIEWS[trimmed.split(/[?#]/, 1)[0]];
  if (previewUrl) {
    return previewUrl;
  }

  return isRetiredStaticImageUrl(trimmed) ? "" : trimmed;
}
