import type { MatpickDataSet } from "./types";

type RuntimeTopicEpisode = {
  slug: string;
  topicSlug: string;
  episode: string;
  title: string;
  description: string;
  videoTitle: string;
  videoUrl: string;
  restaurantIds: string[];
  count: number;
  path: string;
};

type CatalogResponse = Partial<MatpickDataSet> & {
  restaurant?: MatpickDataSet["restaurants"][number];
  canonicalId?: string;
  nextCursor?: string | null;
  hasMore?: boolean;
  totalCount?: number;
  topicEpisodes?: RuntimeTopicEpisode[];
};

export let runtimeTopicEpisodes: RuntimeTopicEpisode[] = [];

export let runtimeCatalogPageInfo: {
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number | null;
} = { nextCursor: null, hasMore: false, totalCount: null };

export function getNextCatalogPageHref() {
  if (!runtimeCatalogPageInfo.nextCursor) return null;
  const url = new URL(window.location.href);
  url.searchParams.set("_cursor", runtimeCatalogPageInfo.nextCursor);
  return `${url.pathname}${url.search}`;
}

function paramsForCurrentPage() {
  const path = window.location.pathname;
  const search = new URLSearchParams(window.location.search);
  const detail = /^\/restaurant\/([^/]+)\/?$/.exec(path);
  if (detail) {
    return new URLSearchParams({ view: "detail", id: decodeURIComponent(detail[1]) });
  }
  const topic = /^\/explore\/topic\/([^/]+)(?:\/episode\/([^/]+))?/.exec(path);
  if (topic) {
    const params = new URLSearchParams({ view: "list", type: "topic", value: decodeURIComponent(topic[1]), limit: "24" });
    if (topic[2]) params.set("episode", decodeURIComponent(topic[2]));
    if (search.get("_cursor")) params.set("cursor", search.get("_cursor")!);
    return params;
  }
  const creator = /^\/creator\/([^/]+)\/?$/.exec(path);
  if (creator) {
    const params = new URLSearchParams({
      view: "list",
      type: "creator",
      value: decodeURIComponent(creator[1]),
      limit: "24",
    });
    if (search.get("_cursor")) params.set("cursor", search.get("_cursor")!);
    return params;
  }
  if (path === "/my/favorites" || path === "/my/favorites/") {
    try {
      const user = JSON.parse(localStorage.getItem("matpick_auth_user") || "null");
      const ids = JSON.parse(localStorage.getItem(`matpick_favorites_${user?.id}`) || "[]");
      if (Array.isArray(ids) && ids.length) {
        return new URLSearchParams({
          view: "list",
          type: "ids",
          ids: ids.slice(0, 24).join(","),
          limit: "24",
        });
      }
    } catch { /* use featured fallback */ }
  }
  if (path === "/map" || path === "/map/") {
    const type = search.get("type") || "featured";
    const value = search.get("value") || "";
    const mapped = type === "query" ? "search" : type === "food" ? "category" : type;
    if (mapped === "episode" && search.get("topic") && value) {
      const params = new URLSearchParams({
        view: "list",
        type: "topic",
        value: search.get("topic")!,
        episode: value,
        limit: "24",
      });
      if (search.get("_cursor")) params.set("cursor", search.get("_cursor")!);
      return params;
    }
    if (["search", "source", "region", "category", "nearby", "restaurant", "creator"].includes(mapped)) {
      if (mapped === "nearby") {
        try {
          const stored = JSON.parse(localStorage.getItem("matpick_location_coords") || "null");
          if (Number.isFinite(stored?.lat) && Number.isFinite(stored?.lng)) {
            const params = new URLSearchParams({ view: "list", type: "nearby", lat: String(stored.lat), lng: String(stored.lng), limit: "24" });
            if (search.get("_cursor")) params.set("cursor", search.get("_cursor")!);
            return params;
          }
        } catch { /* use featured fallback */ }
      } else if (mapped === "restaurant") {
        return new URLSearchParams({ view: "list", type: "ids", ids: value, limit: "1" });
      } else if (value) {
        const params = new URLSearchParams({
          view: "list",
          type: mapped,
          ...(mapped === "search" ? { q: value } : { value }),
          limit: "24",
        });
        if (search.get("_cursor")) params.set("cursor", search.get("_cursor")!);
        return params;
      }
    }
  }
  return new URLSearchParams({ view: "list", type: "featured", limit: "24" });
}

function favoriteRequestParams() {
  if (!/^\/my\/favorites\/?$/.test(window.location.pathname)) return null;
  try {
    const user = JSON.parse(localStorage.getItem("matpick_auth_user") || "null");
    const ids = JSON.parse(localStorage.getItem(`matpick_favorites_${user?.id}`) || "[]");
    if (!Array.isArray(ids) || !ids.length) return null;
    return Array.from({ length: Math.ceil(ids.length / 24) }, (_, index) =>
      new URLSearchParams({
        view: "list",
        type: "ids",
        ids: ids.slice(index * 24, index * 24 + 24).join(","),
        limit: "24",
      })
    );
  } catch {
    return null;
  }
}

async function loadBrowserDataset(): Promise<MatpickDataSet> {
  const requests = favoriteRequestParams() || [paramsForCurrentPage()];
  const payloads: CatalogResponse[] = [];
  for (const params of requests) {
    params.set("scope", "catalog");
    const response = await fetch(`/api/restaurants?${params}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(payload.error || "맛집 정보를 불러오지 못했습니다.");
    }
    payloads.push(await response.json() as CatalogResponse);
  }
  try {
    const payload: CatalogResponse = payloads.length === 1 ? payloads[0] : {
      restaurants: payloads.flatMap(item => item.restaurants || []),
      sources: payloads[0]?.sources || [],
      sourceLinks: payloads.flatMap(item => item.sourceLinks || []),
      restaurantAliases: Object.assign({}, ...payloads.map(item => item.restaurantAliases || {})),
      nextCursor: null,
      hasMore: false,
      totalCount: payloads.reduce((sum, item) => sum + (item.totalCount || 0), 0),
    };
    runtimeCatalogPageInfo = {
      nextCursor: payload.nextCursor || null,
      hasMore: payload.hasMore === true,
      totalCount: Number.isFinite(payload.totalCount) ? payload.totalCount! : null,
    };
    runtimeTopicEpisodes = payload.topicEpisodes || [];
    const restaurants = payload.restaurant ? [payload.restaurant] : payload.restaurants || [];
    return {
      creators: payload.creators || [],
      restaurants,
      visits: payload.visits || [],
      sources: payload.sources || [],
      sourceLinks: payload.sourceLinks || [],
      restaurantAliases: payload.restaurantAliases || (
        payload.canonicalId && payload.restaurant?.id
          ? { [payload.canonicalId]: payload.restaurant.id }
          : {}
      ),
    };
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("맛집 응답 형식을 확인하지 못했습니다.");
  }
}

async function loadRuntimeDataset(): Promise<MatpickDataSet> {
  if (import.meta.env.SSR) {
    const module = await import("./generated/public-dataset.json");
    return module.default as MatpickDataSet;
  }
  return loadBrowserDataset();
}

export default await loadRuntimeDataset();
