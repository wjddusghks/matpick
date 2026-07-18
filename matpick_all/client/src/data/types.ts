export interface SearchItem {
  id: string;
  type: "creator" | "region" | "food" | "restaurant" | "source";
  name: string;
  subtitle: string;
  icon: string;
}

export type SourceType =
  | "creator"
  | "tv_show"
  | "guide"
  | "michelin"
  | "institution"
  | "book"
  | "magazine"
  | "other";

export interface Creator {
  id: string;
  name: string;
  channelName: string;
  profileImage: string;
  subscribers: string;
  description: string;
  youtubeUrl: string;
  series: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price?: string;
  description?: string;
  isSignature?: boolean;
  sourceOrdinal?: number;
}

export interface RestaurantWeeklyHours {
  day: string;
  hours: string[];
}

export interface RestaurantFacilities {
  reservation?: boolean;
  delivery?: boolean;
  accessible?: boolean;
  takeout?: boolean;
  parking?: boolean;
  pets?: boolean;
  wifi?: boolean;
}

export interface RestaurantMenuPriceSource {
  url: string;
  label?: string;
  publishedAt?: string;
}

export interface Restaurant {
  id: string;
  name: string;
  region: string;
  address: string;
  category: string;
  representativeMenu: string;
  lat: number;
  lng: number;
  imageUrl: string;
  foundingYear?: number | null;
  menus?: MenuItem[];
  thumbnailFileName?: string | null;
  googlePlaceId?: string | null;
  isOverseas?: boolean;
  country?: string;
  phone?: string;
  operationStatus?: string;
  operationSummary?: string;
  weeklyHours?: RestaurantWeeklyHours[];
  kakaoPlaceId?: string;
  placeUrl?: string;
  facilities?: RestaurantFacilities;
  rating?: number | null;
  reviewCount?: number | null;
  officialDescriptionAddress?: string;
  detailCollectedAt?: string;
  menuPriceStatus?: string;
  menuPriceVerifiedAt?: string;
  menuPriceNote?: string;
  menuPriceSources?: RestaurantMenuPriceSource[];
}

export interface Visit {
  id: string;
  restaurantId: string;
  creatorId: string;
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  visitDate: string;
  episode: string;
  rating: string;
  comment: string;
  thumbnailUrl: string;
  series: string;
}

export interface SearchResult {
  id: string;
  type: "query" | "creator" | "region" | "food" | "restaurant" | "source";
  name: string;
  platform?: string;
  subscribers?: string;
  image?: string;
  parentRegion?: string;
  restaurantCount?: number;
  category?: string;
  address?: string;
  sourceTypeLabel?: string;
  matchLabel?: string;
  matchedText?: string;
}

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  provider?: string;
  description?: string;
  imageUrl?: string;
  creatorId?: string;
}

export interface SourceLink {
  id: string;
  restaurantId: string;
  sourceId: string;
  ordinal?: number;
  label?: string;
  note?: string;
}

export interface MatpickDataSet {
  creators: Creator[];
  restaurants: Restaurant[];
  visits: Visit[];
  sources?: Source[];
  sourceLinks?: SourceLink[];
}
