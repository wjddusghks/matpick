import type { MenuItem, Restaurant } from "@/data/types";

type RestaurantImageOptions = {
  width?: number;
  height?: number;
  reviewPhotoUrl?: string | null;
};

export type RestaurantDisplayImage = {
  src: string;
  hasPhoto: boolean;
  source: "review" | "restaurant" | "thumbnail" | "fallback";
};

type CuisineTheme = {
  label: string;
  gradientStart: string;
  gradientEnd: string;
  accent: string;
  tint: string;
};

const DEFAULT_IMAGE_WIDTH = 800;
const DEFAULT_IMAGE_HEIGHT = 600;

const CUISINE_THEMES: Record<string, CuisineTheme> = {
  korean: {
    label: "Korean",
    gradientStart: "#fff4ef",
    gradientEnd: "#ffe4dc",
    accent: "#f26a5c",
    tint: "#fff8f5",
  },
  chinese: {
    label: "Chinese",
    gradientStart: "#fff7e8",
    gradientEnd: "#ffe6bc",
    accent: "#d98922",
    tint: "#fff8ec",
  },
  japanese: {
    label: "Japanese",
    gradientStart: "#f6f2ff",
    gradientEnd: "#eadfff",
    accent: "#7b68ee",
    tint: "#faf7ff",
  },
  western: {
    label: "Western",
    gradientStart: "#eef9f7",
    gradientEnd: "#d7f1ec",
    accent: "#20968a",
    tint: "#f4fbfa",
  },
  dessert: {
    label: "Cafe & Dessert",
    gradientStart: "#fff2f7",
    gradientEnd: "#ffe0ea",
    accent: "#d45f89",
    tint: "#fff8fb",
  },
  other: {
    label: "Dining Guide",
    gradientStart: "#f4f5f7",
    gradientEnd: "#ebeef3",
    accent: "#69707d",
    tint: "#fafbfd",
  },
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&apos;");
}

function pickCuisineTheme(category: string) {
  const normalized = category.trim().toLowerCase();

  if (
    normalized.includes("한식") ||
    normalized.includes("국밥") ||
    normalized.includes("탕") ||
    normalized.includes("냉면")
  ) {
    return CUISINE_THEMES.korean;
  }

  if (
    normalized.includes("중식") ||
    normalized.includes("딤섬") ||
    normalized.includes("마라")
  ) {
    return CUISINE_THEMES.chinese;
  }

  if (
    normalized.includes("일식") ||
    normalized.includes("초밥") ||
    normalized.includes("라멘") ||
    normalized.includes("우동")
  ) {
    return CUISINE_THEMES.japanese;
  }

  if (
    normalized.includes("양식") ||
    normalized.includes("브런치") ||
    normalized.includes("스테이크") ||
    normalized.includes("파스타") ||
    normalized.includes("피자")
  ) {
    return CUISINE_THEMES.western;
  }

  if (
    normalized.includes("카페") ||
    normalized.includes("디저트") ||
    normalized.includes("베이커리") ||
    normalized.includes("커피")
  ) {
    return CUISINE_THEMES.dessert;
  }

  return CUISINE_THEMES.other;
}

function normalizeMenuItems(
  restaurant: Pick<Restaurant, "id" | "menus" | "representativeMenu">
) {
  const explicitMenus =
    restaurant.menus?.filter((menu) => menu.name.trim().length > 0).map((menu) => ({
      ...menu,
      name: menu.name.trim(),
      price: menu.price?.trim(),
    })) ?? [];

  if (explicitMenus.length > 0) {
    return explicitMenus;
  }

  const chunks = (restaurant.representativeMenu || "")
    .split("/")
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return chunks.map((chunk, index) => {
    const matchedPrice = chunk.match(/\d[\d,]*(?:\s*원)?/)?.[0];
    const price = matchedPrice ? matchedPrice.replace(/\s+/g, " ").trim() : undefined;
    const name = matchedPrice ? chunk.replace(matchedPrice, "").trim() : chunk;

    return {
      id: `${restaurant.id}_placeholder_menu_${index}`,
      name: name || chunk,
      price,
      isSignature: index === 0,
    } satisfies MenuItem;
  });
}

function truncateText(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}...`;
}

function buildPlaceholderSvg(
  restaurant: Pick<
    Restaurant,
    "id" | "name" | "category" | "representativeMenu" | "menus" | "address"
  >,
  { width = DEFAULT_IMAGE_WIDTH, height = DEFAULT_IMAGE_HEIGHT }: RestaurantImageOptions = {}
) {
  const theme = pickCuisineTheme(restaurant.category);
  const menuItems = normalizeMenuItems(restaurant);
  const heroMenu = truncateText(
    menuItems.find((menu) => menu.isSignature)?.name ||
      menuItems[0]?.name ||
      restaurant.representativeMenu.trim() ||
      restaurant.name.trim() ||
      theme.label,
    28
  );
  const secondaryLine =
    menuItems.find((menu) => menu.price)?.price ||
    truncateText(restaurant.address.trim() || restaurant.name.trim() || theme.label, 28);
  const categoryLabel = truncateText(
    restaurant.category.trim() || theme.label,
    18
  );

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(restaurant.name)}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${theme.gradientStart}" />
          <stop offset="100%" stop-color="${theme.gradientEnd}" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" rx="${Math.round(width * 0.045)}" fill="url(#bg)" />
      <circle cx="${Math.round(width * 0.14)}" cy="${Math.round(height * 0.24)}" r="${Math.round(Math.min(width, height) * 0.09)}" fill="${theme.tint}" />
      <circle cx="${Math.round(width * 0.86)}" cy="${Math.round(height * 0.18)}" r="${Math.round(Math.min(width, height) * 0.06)}" fill="${theme.tint}" />
      <text x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.47)}" fill="${theme.accent}" font-family="Arial, Apple SD Gothic Neo, Noto Sans KR, sans-serif" font-size="${Math.round(height * 0.085)}" font-weight="800">${escapeXml(categoryLabel)}</text>
      <text x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.62)}" fill="#1f2430" font-family="Arial, Apple SD Gothic Neo, Noto Sans KR, sans-serif" font-size="${Math.round(height * 0.06)}" font-weight="700">${escapeXml(heroMenu)}</text>
      <text x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.72)}" fill="#5f6470" font-family="Arial, Apple SD Gothic Neo, Noto Sans KR, sans-serif" font-size="${Math.round(height * 0.045)}" font-weight="600">${escapeXml(secondaryLine)}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function hasRestaurantPhoto(
  restaurant: Pick<Restaurant, "imageUrl">
) {
  return restaurant.imageUrl.trim().length > 0;
}

export function getRestaurantDisplayImage(
  restaurant: Pick<
    Restaurant,
    | "id"
    | "name"
    | "category"
    | "representativeMenu"
    | "menus"
    | "address"
    | "imageUrl"
    | "thumbnailFileName"
  >,
  options?: RestaurantImageOptions
) : RestaurantDisplayImage {
  if (options?.reviewPhotoUrl?.trim()) {
    return {
      src: options.reviewPhotoUrl.trim(),
      hasPhoto: true,
      source: "review",
    };
  }

  if (hasRestaurantPhoto(restaurant)) {
    return {
      src: restaurant.imageUrl,
      hasPhoto: true,
      source: "restaurant",
    };
  }

  if (restaurant.thumbnailFileName?.trim()) {
    return {
      src: `/restaurant-thumbnails/${restaurant.thumbnailFileName.trim()}`,
      hasPhoto: true,
      source: "thumbnail",
    };
  }

  return {
    src: buildPlaceholderSvg(restaurant, options),
    hasPhoto: false,
    source: "fallback",
  };
}

export function getRestaurantPrimaryPrice(
  restaurant: Pick<Restaurant, "id" | "menus" | "representativeMenu">
) {
  const menuItems = normalizeMenuItems(restaurant);
  return menuItems.find((menu) => menu.price)?.price ?? "";
}

type BroadcastBadgeInput = {
  count: number;
  primaryEpisode: string;
};

type RestaurantMetadataLocale = "ko" | "en";

function truncateBadgeText(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

export function formatRestaurantFoundingBadge(
  foundingYear?: number | null,
  locale: RestaurantMetadataLocale = "ko"
) {
  if (!foundingYear) {
    return "";
  }

  return locale === "en" ? `Since ${foundingYear}` : `개업 ${foundingYear}`;
}

export function formatRestaurantBroadcastBadge(
  broadcastMeta?: BroadcastBadgeInput | null,
  locale: RestaurantMetadataLocale = "ko"
) {
  if (!broadcastMeta) {
    return "";
  }

  if (broadcastMeta.count <= 1) {
    const episodeLabel = truncateBadgeText(broadcastMeta.primaryEpisode, 18);
    return locale === "en" ? `Episode ${episodeLabel}` : `방송 ${episodeLabel}`;
  }

  return locale === "en"
    ? `${broadcastMeta.count} episodes`
    : `방송 ${broadcastMeta.count}회차`;
}
