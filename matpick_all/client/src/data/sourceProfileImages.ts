import tateguysImage from "@/assets/creator-thumbnails/tateguys.jpg";
import ttoganjipImage from "@/assets/creator-thumbnails/ttoganjip.webp";
import baekjongWokImage from "@/assets/source-thumbnails/baekjong-wok.webp";
import michelinImage from "@/assets/source-thumbnails/michelin.webp";
import popularRestaurantsImage from "@/assets/source-thumbnails/popular-restaurants.webp";
import topicThumbnailImages from "./topicThumbnailImages.json";

export const sourceProfileImageOverrides: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(topicThumbnailImages).map(([id, image]) => [
      id,
      image.imageUrl,
    ])
  ),
  ttoganjip: ttoganjipImage,
  "popular-restaurants": popularRestaurantsImage,
  "delicious-guys": tateguysImage,
  michelin: michelinImage,
  "baekjong-wok": baekjongWokImage,
};
