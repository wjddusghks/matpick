import type { Restaurant, Source, SourceLink } from "@/data/types";
import type { RestaurantEdit } from "@/lib/restaurantEdits";

const REMAINDER_CONCURRENCY = 3;

type CatalogPage = {
  restaurants: Restaurant[];
  sources?: Source[];
  sourceLinks: SourceLink[];
  nextCursor: string | null;
  pageSize?: number;
  totalCount?: number;
};

type CatalogResponse = {
  edits?: RestaurantEdit[];
  configured?: boolean;
  error?: string;
  catalog: CatalogPage;
};

type FetchCatalogOptions = {
  headers: Record<string, string>;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
};

async function fetchPage(
  cursor: string,
  { headers, signal, fetcher = fetch }: FetchCatalogOptions
) {
  const response = await fetcher(
    `/api/restaurants?scope=admin&includeCatalog=1&cursor=${encodeURIComponent(cursor)}`,
    { headers, signal, cache: "no-store" }
  );
  const body = (await response.json()) as CatalogResponse;
  if (!response.ok) {
    throw new Error(body.error || "식당 관리 정보를 불러오지 못했습니다.");
  }
  return body;
}

export async function fetchAdminRestaurantCatalog(
  options: FetchCatalogOptions
) {
  const first = await fetchPage("0", options);
  const pageSize = first.catalog.pageSize;
  const totalCount = first.catalog.totalCount;
  const pages = new Map<number, CatalogPage>([[0, first.catalog]]);

  if (
    Number.isSafeInteger(pageSize) &&
    pageSize! > 0 &&
    Number.isSafeInteger(totalCount) &&
    totalCount! >= first.catalog.restaurants.length
  ) {
    const offsets: number[] = [];
    for (let offset = pageSize!; offset < totalCount!; offset += pageSize!) {
      offsets.push(offset);
    }
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < offsets.length) {
        const offset = offsets[nextIndex++];
        const body = await fetchPage(String(offset), options);
        pages.set(offset, body.catalog);
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(REMAINDER_CONCURRENCY, offsets.length) },
        () => worker()
      )
    );
  } else {
    // Supports a rolling deployment where the older API still exposes only a
    // linked cursor and repeats metadata on each page.
    let cursor = first.catalog.nextCursor;
    let offset = first.catalog.restaurants.length;
    while (cursor != null) {
      const body = await fetchPage(cursor, options);
      pages.set(offset, body.catalog);
      offset += body.catalog.restaurants.length;
      cursor = body.catalog.nextCursor;
    }
  }

  const ordered = Array.from(pages.entries())
    .sort(([left], [right]) => left - right)
    .map(([, page]) => page);
  return {
    edits: first.edits || [],
    configured: Boolean(first.configured),
    catalog: {
      restaurants: ordered.flatMap(page => page.restaurants),
      sources: first.catalog.sources || [],
      sourceLinks: ordered.flatMap(page => page.sourceLinks),
    },
  };
}

export function indexAdminCatalogSources(
  sources: Source[],
  sourceLinks: SourceLink[]
) {
  const sourceById = new Map(sources.map(source => [source.id, source]));
  const linksByRestaurant = new Map<string, SourceLink[]>();
  const sourceIdsByRestaurant = new Map<string, Set<string>>();
  for (const link of sourceLinks) {
    const links = linksByRestaurant.get(link.restaurantId) || [];
    links.push(link);
    linksByRestaurant.set(link.restaurantId, links);
    const sourceIds = sourceIdsByRestaurant.get(link.restaurantId) || new Set();
    sourceIds.add(link.sourceId);
    sourceIdsByRestaurant.set(link.restaurantId, sourceIds);
  }
  const sourcesByRestaurant = new Map<string, Source[]>();
  for (const [restaurantId, sourceIds] of Array.from(
    sourceIdsByRestaurant.entries()
  )) {
    sourcesByRestaurant.set(
      restaurantId,
      Array.from(sourceIds).flatMap(sourceId => {
        const source = sourceById.get(sourceId);
        return source ? [source] : [];
      })
    );
  }
  return { linksByRestaurant, sourcesByRestaurant };
}
