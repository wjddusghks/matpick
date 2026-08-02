import baekjongWokImage from "@/assets/source-thumbnails/baekjong-wok.webp";
import michelinImage from "@/assets/source-thumbnails/michelin.webp";
import popularRestaurantsImage from "@/assets/source-thumbnails/popular-restaurants.webp";
import tateguysImage from "@/assets/creator-thumbnails/tateguys.jpg";
import ttoganjipImage from "@/assets/creator-thumbnails/ttoganjip.webp";
import type { AppLocale } from "@/lib/locale";

export type MapTopicShortcut = {
  slug: string;
  type: "source" | "creator";
  value: string;
  name: Record<AppLocale, string>;
  imageUrl: string;
};

export const mapTopicShortcuts: MapTopicShortcut[] = [
  {
    slug: "ttoganjip",
    type: "source",
    value: "ttoganjip",
    name: { ko: "또간집", en: "Ttoganjip" },
    imageUrl: ttoganjipImage,
  },
  {
    slug: "popular-restaurants",
    type: "source",
    value: "popular-restaurants",
    name: { ko: "인기맛집", en: "Popular" },
    imageUrl: popularRestaurantsImage,
  },
  {
    slug: "taste-guys",
    type: "source",
    value: "delicious-guys",
    name: { ko: "맛있는 녀석들", en: "Tasty Guys" },
    imageUrl: tateguysImage,
  },
  {
    slug: "michelin",
    type: "source",
    value: "michelin",
    name: { ko: "미쉐린", en: "Michelin" },
    imageUrl: michelinImage,
  },
  {
    slug: "old-korean-100",
    type: "source",
    value: "old-korean-100",
    name: { ko: "오래된 한식당", en: "Old Korean" },
    imageUrl: "/source-covers/old-korean-100.jpg",
  },
  {
    slug: "sikgaek-baekban-trip",
    type: "source",
    value: "sikgaek-baekban-trip",
    name: { ko: "백반기행", en: "Baekban Trip" },
    imageUrl: "/source-covers/sikgaek-baekban-trip-menu-v2.jpg",
  },
  {
    slug: "wednesday-gourmet",
    type: "source",
    value: "wednesday-gourmet",
    name: { ko: "수요미식회", en: "Wednesday Gourmet" },
    imageUrl: "/source-covers/wednesday-gourmet.jpg",
  },
  {
    slug: "baekjong-wok",
    type: "source",
    value: "baekjong-wok",
    name: { ko: "백종원의 3대천왕", en: "Baek Jong-won" },
    imageUrl: baekjongWokImage,
  },
];

export function getMapTopicPath(topic: MapTopicShortcut) {
  return `/map?type=${topic.type}&value=${encodeURIComponent(topic.value)}`;
}

export function getMapTopicDisplayName(
  topic: MapTopicShortcut,
  locale: AppLocale,
) {
  return topic.name[locale];
}
