import type { Restaurant, Source, SourceLink } from "@/data/types";

export type CatalogRestaurantSummary = Pick<
  Restaurant,
  | "id" | "name" | "region" | "address" | "category" | "lat" | "lng"
  | "imageUrl" | "thumbnailFileName" | "representativeMenu" | "menus" | "foundingYear"
  | "operationState" | "operationStatus" | "isOverseas"
> & { sourceLabels: string[]; distanceKm?: number };

export type CatalogPage = {
  restaurants: CatalogRestaurantSummary[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
  sources: Source[];
  sourceLinks: SourceLink[];
  restaurantAliases: Record<string, string>;
};

export type CatalogDetail = {
  restaurant: Restaurant;
  sourceLinks: SourceLink[];
  sources: Source[];
  canonicalId: string;
};

async function requestCatalog<T>(params: URLSearchParams, signal?: AbortSignal): Promise<T> {
  params.set("scope", "catalog");
  const response = await fetch(`/api/restaurants?${params}`, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "맛집 정보를 불러오지 못했습니다.");
  }
  return response.json();
}

export function loadCatalogDetail(id: string, signal?: AbortSignal) {
  return requestCatalog<CatalogDetail>(new URLSearchParams({ view: "detail", id }), signal);
}

export function loadCatalogPage(input: {
  type: "search" | "source" | "region" | "category" | "nearby" | "ids" | "topic" | "creator" | "featured";
  q?: string;
  value?: string;
  ids?: string[];
  lat?: number;
  lng?: number;
  cursor?: string;
  limit?: number;
}, signal?: AbortSignal) {
  const params = new URLSearchParams({ view: "list", type: input.type });
  if (input.q) params.set("q", input.q);
  if (input.value) params.set("value", input.value);
  if (input.ids?.length) params.set("ids", input.ids.join(","));
  if (input.lat != null) params.set("lat", String(input.lat));
  if (input.lng != null) params.set("lng", String(input.lng));
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.limit) params.set("limit", String(input.limit));
  return requestCatalog<CatalogPage>(params, signal);
}
