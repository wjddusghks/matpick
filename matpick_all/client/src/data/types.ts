export interface SearchItem {
  id: string;
  type: "creator" | "region" | "food" | "restaurant";
  name: string;
  subtitle: string;
  icon: string;
}

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

export interface MatpickDataSet {
  creators: Creator[];
  restaurants: Restaurant[];
  visits: Visit[];
}
