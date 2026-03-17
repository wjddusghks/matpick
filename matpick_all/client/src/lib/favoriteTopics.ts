export const FAVORITE_TOPIC_NAME_LIMIT = 12;

export type FavoriteTopicIconKey =
  | "fork"
  | "date"
  | "trip"
  | "night"
  | "spicy"
  | "dessert";

export type FavoriteTopicColorKey =
  | "coral"
  | "amber"
  | "mint"
  | "sky"
  | "violet"
  | "rose";

export interface FavoriteTopic {
  id: string;
  name: string;
  iconKey: FavoriteTopicIconKey;
  colorKey: FavoriteTopicColorKey;
  createdAt: number;
}

export const favoriteTopicIconOptions: Array<{
  key: FavoriteTopicIconKey;
  label: string;
  symbol: string;
}> = [
  { key: "fork", label: "한 끼", symbol: "🍽" },
  { key: "date", label: "데이트", symbol: "💗" },
  { key: "trip", label: "여행", symbol: "🧳" },
  { key: "night", label: "야식", symbol: "🌙" },
  { key: "spicy", label: "매운맛", symbol: "🌶" },
  { key: "dessert", label: "디저트", symbol: "🍰" },
];

export const favoriteTopicColorOptions: Array<{
  key: FavoriteTopicColorKey;
  label: string;
  swatchClassName: string;
}> = [
  { key: "coral", label: "코랄", swatchClassName: "bg-[#ff7b83]" },
  { key: "amber", label: "앰버", swatchClassName: "bg-[#ffb24a]" },
  { key: "mint", label: "민트", swatchClassName: "bg-[#3cc8a3]" },
  { key: "sky", label: "스카이", swatchClassName: "bg-[#5aa9ff]" },
  { key: "violet", label: "바이올렛", swatchClassName: "bg-[#8b7bff]" },
  { key: "rose", label: "로즈", swatchClassName: "bg-[#ff5fa2]" },
];

export function getFavoriteTopicIconSymbol(iconKey: FavoriteTopicIconKey) {
  return favoriteTopicIconOptions.find((option) => option.key === iconKey)?.symbol ?? "🍽";
}

export function sanitizeFavoriteTopicName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, FAVORITE_TOPIC_NAME_LIMIT);
}

export function createFavoriteTopicId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `topic_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getFavoriteTopicTone(colorKey: FavoriteTopicColorKey) {
  switch (colorKey) {
    case "amber":
      return {
        badge: "border-[#ffd7a3] bg-[#fff7e8] text-[#c17b14]",
        button: "border-[#ffd7a3] bg-[#fff7e8] text-[#c17b14] hover:bg-[#ffefcf]",
        activeButton: "border-[#ffb24a] bg-[#ffb24a] text-white shadow-[0_12px_24px_rgba(255,178,74,0.22)]",
      };
    case "mint":
      return {
        badge: "border-[#bdeedb] bg-[#effcf7] text-[#219b7b]",
        button: "border-[#bdeedb] bg-[#effcf7] text-[#219b7b] hover:bg-[#daf8ee]",
        activeButton: "border-[#3cc8a3] bg-[#3cc8a3] text-white shadow-[0_12px_24px_rgba(60,200,163,0.22)]",
      };
    case "sky":
      return {
        badge: "border-[#cde3ff] bg-[#f4f8ff] text-[#3e79d6]",
        button: "border-[#cde3ff] bg-[#f4f8ff] text-[#3e79d6] hover:bg-[#e8f1ff]",
        activeButton: "border-[#5aa9ff] bg-[#5aa9ff] text-white shadow-[0_12px_24px_rgba(90,169,255,0.24)]",
      };
    case "violet":
      return {
        badge: "border-[#d9d2ff] bg-[#f7f4ff] text-[#6c5ee5]",
        button: "border-[#d9d2ff] bg-[#f7f4ff] text-[#6c5ee5] hover:bg-[#eee9ff]",
        activeButton: "border-[#8b7bff] bg-[#8b7bff] text-white shadow-[0_12px_24px_rgba(139,123,255,0.24)]",
      };
    case "rose":
      return {
        badge: "border-[#ffc7de] bg-[#fff1f7] text-[#e44587]",
        button: "border-[#ffc7de] bg-[#fff1f7] text-[#e44587] hover:bg-[#ffe4f0]",
        activeButton: "border-[#ff5fa2] bg-[#ff5fa2] text-white shadow-[0_12px_24px_rgba(255,95,162,0.24)]",
      };
    case "coral":
    default:
      return {
        badge: "border-[#ffd2d8] bg-[#fff4f6] text-[#ff6b7b]",
        button: "border-[#ffd2d8] bg-[#fff4f6] text-[#ff6b7b] hover:bg-[#ffe8ed]",
        activeButton: "border-[#ff7b83] bg-[#ff7b83] text-white shadow-[0_12px_24px_rgba(255,123,131,0.24)]",
      };
  }
}
