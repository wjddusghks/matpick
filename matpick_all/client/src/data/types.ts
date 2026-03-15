export interface SearchItem {
  id: string;
  type: "creator" | "region" | "food" | "restaurant";
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
  isSignature?: boolean;
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
  thumbnailFileName?: string;
  isOverseas?: boolean;
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
  type: "creator" | "region" | "food" | "restaurant";
  name: string;
  platform?: string;
  subscribers?: string;
  image?: string;
  parentRegion?: string;
  restaurantCount?: number;
  category?: string;
  address?: string;
}

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  provider?: string;
  description?: string;
  imageUrl?: string;
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
