import rawDataset from "./matpick-data.json";
import discoveryTopicDefinitions from "./discovery-topics.json";
import { creatorProfileImageOverrides } from "./creatorProfileImages";
import { sourceProfileImageOverrides } from "./sourceProfileImages";
import oldKorean100Dataset from "./generated/old-korean-100.generated.json";
import sikgaekBaekbanTripDataset from "./generated/sikgaek-baekban-trip.generated.json";
import baekbanTripTopicEnrichment from "./generated/topic-enrichments/baekban-trip.enriched.json";
import baekjongWokTopicEnrichment from "./generated/topic-enrichments/baekjong-wok.enriched.json";
import deliciousGuysTopicEnrichment from "./generated/topic-enrichments/delicious-guys.enriched.json";
import oldKorean100TopicEnrichment from "./generated/topic-enrichments/old-korean-100.enriched.json";
import ttoganjipTopicEnrichment from "./generated/topic-enrichments/ttoganjip.enriched.json";
import wednesdayGourmetTopicEnrichment from "./generated/topic-enrichments/wednesday-gourmet.enriched.json";
import wednesdayGourmetDataset from "./generated/wednesday-gourmet.generated.json";
import type {
  Creator,
  MatpickDataSet,
  MenuItem,
  Restaurant,
  SearchItem,
  SearchResult,
  Source,
  SourceLink,
  Visit,
} from "./types";

type SourceDataset = {
  restaurants?: Restaurant[];
  sources?: Source[];
  sourceLinks?: SourceLink[];
};

const patchOnlySourceIds = new Set<string>([
  "old-korean-100",
  "sikgaek-baekban-trip",
  "wednesday-gourmet",
]);

export type DiscoveryTopicKind = "creator" | "source";

type DiscoveryTopicDefinition = {
  slug: string;
  kind: DiscoveryTopicKind;
  targetId: string;
};

export type DiscoveryTopic = {
  slug: string;
  kind: DiscoveryTopicKind;
  targetId: string;
  key: string;
  name: string;
  description: string;
  path: string;
  count: number;
  imageUrl?: string;
};

export type DiscoveryTopicEpisode = {
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

export type RestaurantBroadcastMeta = {
  count: number;
  primaryEpisode: string;
  episodeLabels: string[];
};

const episodicSourceIds = new Set([
  "ttoganjip",
  "delicious-guys",
  "baekjong-wok",
  "sikgaek-baekban-trip",
  "wednesday-gourmet",
]);

function normalizeLookupValue(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeAddressForLookup(address: string) {
  return normalizeLookupValue(address.replace(/\([^)]*\)/g, " "));
}

function buildRestaurantNameLookupCandidates(
  restaurant: Pick<Restaurant, "name" | "address" | "region">
) {
  const normalizedName = normalizeLookupValue(restaurant.name);
  const candidates = new Set<string>([normalizedName]);
  const addressTokens = normalizeLookupValue(
    `${restaurant.region || ""} ${restaurant.address || ""}`
  )
    .split(" ")
    .filter(Boolean);

  const removablePrefixes = new Set<string>();
  if (addressTokens[0]) {
    removablePrefixes.add(addressTokens[0]);
  }
  if (addressTokens[1]) {
    removablePrefixes.add(`${addressTokens[0]} ${addressTokens[1]}`);
  }

  removablePrefixes.forEach((prefix) => {
    if (normalizedName.startsWith(`${prefix} `)) {
      const stripped = normalizedName.slice(prefix.length).trim();
      if (stripped) {
        candidates.add(stripped);
      }
    }
  });

  return Array.from(candidates);
}

function buildRestaurantLookupKeys(
  restaurant: Pick<Restaurant, "name" | "address" | "region">
) {
  const normalizedAddress = normalizeAddressForLookup(restaurant.address);
  return buildRestaurantNameLookupCandidates(restaurant).map(
    (nameCandidate) => `${nameCandidate}|${normalizedAddress}`
  );
}

function hasValidCoords(restaurant: Pick<Restaurant, "lat" | "lng">) {
  return (
    Number.isFinite(restaurant.lat) &&
    Number.isFinite(restaurant.lng) &&
    restaurant.lat !== 0 &&
    restaurant.lng !== 0
  );
}

function preferLongerText(currentValue: string, nextValue: string) {
  const current = currentValue?.trim() ?? "";
  const next = nextValue?.trim() ?? "";

  if (!current) return next;
  if (!next) return current;
  return next.length > current.length ? next : current;
}

function mergeRestaurantMenus(currentMenus: MenuItem[] = [], nextMenus: MenuItem[] = []) {
  const mergedMenus = new Map<string, MenuItem>();

  [...currentMenus, ...nextMenus].forEach((menu, index) => {
    const normalizedName = menu.name?.trim();
    if (!normalizedName) {
      return;
    }

    const key = normalizedName.toLowerCase();
    const existing = mergedMenus.get(key);

    if (!existing) {
      mergedMenus.set(key, {
        id: menu.id || `merged_menu_${index}`,
        name: normalizedName,
        price: menu.price?.trim() || undefined,
        isSignature: Boolean(menu.isSignature),
      });
      return;
    }

    mergedMenus.set(key, {
      ...existing,
      price: existing.price || menu.price?.trim() || undefined,
      isSignature: existing.isSignature || Boolean(menu.isSignature),
    });
  });

  return Array.from(mergedMenus.values());
}

function mergeRestaurantById(current: Restaurant, next: Restaurant): Restaurant {
  const preferredAddressRestaurant =
    preferLongerText(current.address, next.address) === next.address ? next : current;

  return {
    ...current,
    ...next,
    id: current.id,
    name: preferLongerText(current.name, next.name),
    region: preferLongerText(current.region, next.region),
    address: preferLongerText(current.address, next.address),
    category: preferLongerText(current.category, next.category),
    representativeMenu: preferLongerText(
      current.representativeMenu,
      next.representativeMenu
    ),
    lat: hasValidCoords(preferredAddressRestaurant)
      ? preferredAddressRestaurant.lat
      : hasValidCoords(next)
        ? next.lat
        : current.lat,
    lng: hasValidCoords(preferredAddressRestaurant)
      ? preferredAddressRestaurant.lng
      : hasValidCoords(next)
        ? next.lng
        : current.lng,
    imageUrl: current.imageUrl || next.imageUrl,
    foundingYear: current.foundingYear ?? next.foundingYear ?? null,
    menus: mergeRestaurantMenus(current.menus ?? [], next.menus ?? []),
    thumbnailFileName: current.thumbnailFileName ?? next.thumbnailFileName ?? null,
    googlePlaceId: current.googlePlaceId ?? next.googlePlaceId ?? null,
    isOverseas: current.isOverseas ?? next.isOverseas,
  };
}

function dedupeRestaurantsById(restaurantsToMerge: Restaurant[]) {
  const dedupedRestaurants: Restaurant[] = [];
  const indexByLookupKey = new Map<string, number>();
  const canonicalRestaurantIdMap = new Map<string, string>();

  restaurantsToMerge.forEach((restaurant) => {
    const existingIndex = buildRestaurantLookupKeys(restaurant)
      .map((lookupKey) => indexByLookupKey.get(lookupKey))
      .find((value): value is number => value != null);

    if (existingIndex == null) {
      const nextIndex = dedupedRestaurants.length;
      dedupedRestaurants.push(restaurant);
      canonicalRestaurantIdMap.set(restaurant.id, restaurant.id);
      buildRestaurantLookupKeys(restaurant).forEach((lookupKey) => {
        indexByLookupKey.set(lookupKey, nextIndex);
      });
      return;
    }

    dedupedRestaurants[existingIndex] = mergeRestaurantById(
      dedupedRestaurants[existingIndex],
      restaurant
    );
    canonicalRestaurantIdMap.set(
      restaurant.id,
      dedupedRestaurants[existingIndex].id
    );
    buildRestaurantLookupKeys(dedupedRestaurants[existingIndex]).forEach((lookupKey) => {
      indexByLookupKey.set(lookupKey, existingIndex);
    });
  });

  return {
    restaurants: dedupedRestaurants,
    canonicalRestaurantIdMap,
  };
}

function mergeDatasets(base: MatpickDataSet, extras: SourceDataset[]): MatpickDataSet {
  const mergedRestaurants = [...base.restaurants];
  const mergedSources = [...(base.sources ?? [])];
  const mergedSourceLinks = [...(base.sourceLinks ?? [])];
  const restaurantIdMap = new Map<string, string>();
  const existingRestaurantIndex = new Map<string, number>();

  mergedRestaurants.forEach((restaurant, index) => {
    buildRestaurantLookupKeys(restaurant).forEach((lookupKey) => {
      existingRestaurantIndex.set(lookupKey, index);
    });
  });

  extras.forEach((extra) => {
    const sourceIds = new Set((extra.sources ?? []).map((source) => source.id));
    const patchOnlyDataset =
      sourceIds.size > 0 &&
      Array.from(sourceIds).every((sourceId) => patchOnlySourceIds.has(sourceId)) &&
      (extra.restaurants ?? []).every((restaurant) =>
        restaurant.id.startsWith("topic_enrichment_")
      );
    const patchableRestaurantIds = patchOnlyDataset
      ? new Set(
          mergedSourceLinks
            .filter((link) => sourceIds.has(link.sourceId))
            .map((link) => link.restaurantId)
        )
      : null;

    (extra.sources ?? []).forEach((source) => {
      if (!mergedSources.some((item) => item.id === source.id)) {
        mergedSources.push(source);
      }
    });

    (extra.restaurants ?? []).forEach((restaurant) => {
      const existingIndex = buildRestaurantLookupKeys(restaurant)
        .map((lookupKey) => existingRestaurantIndex.get(lookupKey))
        .find(
          (value): value is number =>
            value != null &&
            (!patchableRestaurantIds ||
              patchableRestaurantIds.has(mergedRestaurants[value].id))
        );

      if (existingIndex != null) {
        const existing = mergedRestaurants[existingIndex];
        mergedRestaurants[existingIndex] = mergeRestaurantById(existing, restaurant);
        restaurantIdMap.set(restaurant.id, existing.id);
        buildRestaurantLookupKeys(mergedRestaurants[existingIndex]).forEach((lookupKey) => {
          existingRestaurantIndex.set(lookupKey, existingIndex);
        });
        return;
      }

      if (patchOnlyDataset) {
        return;
      }

      mergedRestaurants.push(restaurant);
      const insertedIndex = mergedRestaurants.length - 1;
      buildRestaurantLookupKeys(restaurant).forEach((lookupKey) => {
        existingRestaurantIndex.set(lookupKey, insertedIndex);
      });
      restaurantIdMap.set(restaurant.id, restaurant.id);
    });

    (extra.sourceLinks ?? []).forEach((link) => {
      const remappedRestaurantId = restaurantIdMap.get(link.restaurantId) ?? link.restaurantId;
      if (
        patchOnlyDataset &&
        !restaurantIdMap.has(link.restaurantId) &&
        !mergedRestaurants.some((restaurant) => restaurant.id === remappedRestaurantId)
      ) {
        return;
      }
      const dedupeKey = `${link.sourceId}:${remappedRestaurantId}:${link.ordinal ?? ""}`;

      if (
        mergedSourceLinks.some(
          (item) =>
            `${item.sourceId}:${item.restaurantId}:${item.ordinal ?? ""}` === dedupeKey
        )
      ) {
        return;
      }

      mergedSourceLinks.push({
        ...link,
        restaurantId: remappedRestaurantId,
      });
    });
  });

  const deduped = dedupeRestaurantsById(mergedRestaurants);
  const dedupedRestaurantIds = new Set(deduped.restaurants.map((restaurant) => restaurant.id));
  const normalizedSourceLinks = new Map<string, SourceLink>();

  mergedSourceLinks.forEach((link) => {
    const canonicalRestaurantId =
      deduped.canonicalRestaurantIdMap.get(link.restaurantId) ?? link.restaurantId;

    if (!dedupedRestaurantIds.has(canonicalRestaurantId)) {
      return;
    }

    const dedupeKey = `${link.sourceId}:${canonicalRestaurantId}`;
    const existing = normalizedSourceLinks.get(dedupeKey);

    if (!existing) {
      normalizedSourceLinks.set(dedupeKey, {
        ...link,
        restaurantId: canonicalRestaurantId,
      });
      return;
    }

    normalizedSourceLinks.set(dedupeKey, {
      ...existing,
      ordinal:
        existing.ordinal == null
          ? link.ordinal
          : link.ordinal == null
            ? existing.ordinal
            : Math.min(existing.ordinal, link.ordinal),
      label: existing.label ?? link.label,
      note: existing.note ?? link.note,
    });
  });

  return {
    creators: base.creators,
    visits: base.visits,
    restaurants: deduped.restaurants,
    sources: mergedSources,
    sourceLinks: Array.from(normalizedSourceLinks.values()),
  };
}

const hiddenCreatorIds = new Set<string>(["UCfpaSruWW3S4dibonKXENjA"]);

function filterDatasetForVisibleContent(dataset: MatpickDataSet): MatpickDataSet {
  const visibleCreators = dataset.creators.filter(
    (creator) => !hiddenCreatorIds.has(creator.id)
  );
  const visibleVisits = dataset.visits.filter(
    (visit) => !hiddenCreatorIds.has(visit.creatorId)
  );
  const visibleSourceLinks = dataset.sourceLinks ?? [];
  const referencedRestaurantIds = new Set<string>();

  visibleVisits.forEach((visit) => {
    if (visit.restaurantId) {
      referencedRestaurantIds.add(visit.restaurantId);
    }
  });

  visibleSourceLinks.forEach((link) => {
    if (link.restaurantId) {
      referencedRestaurantIds.add(link.restaurantId);
    }
  });

  return {
    ...dataset,
    creators: visibleCreators,
    visits: visibleVisits,
    restaurants: dataset.restaurants.filter(
      (restaurant) =>
        referencedRestaurantIds.size === 0 || referencedRestaurantIds.has(restaurant.id)
    ),
    sources: dataset.sources ?? [],
    sourceLinks: visibleSourceLinks,
  };
}

const baseDataset = rawDataset as MatpickDataSet;
const dataset = filterDatasetForVisibleContent(
  mergeDatasets(baseDataset, [
  oldKorean100Dataset as SourceDataset,
  sikgaekBaekbanTripDataset as SourceDataset,
  wednesdayGourmetDataset as SourceDataset,
  ttoganjipTopicEnrichment as SourceDataset,
  deliciousGuysTopicEnrichment as SourceDataset,
  baekbanTripTopicEnrichment as SourceDataset,
  baekjongWokTopicEnrichment as SourceDataset,
  wednesdayGourmetTopicEnrichment as SourceDataset,
  oldKorean100TopicEnrichment as SourceDataset,
  ])
);
const creatorDisplayNameOverrides: Record<string, string> = {
  UCrDMtdCSMTGVmUKvuhcahRw: "또간집",
};

export function getCreatorDisplayName(creator: Pick<Creator, "id" | "name">) {
  return creatorDisplayNameOverrides[creator.id] ?? creator.name;
}

function getCreatorSearchName(creator: Creator) {
  const displayName = getCreatorDisplayName(creator);
  return displayName === creator.name ? `${creator.name} (${creator.series})` : displayName;
}

const creatorsWithProfileImages: Creator[] = dataset.creators.map((creator) => ({
  ...creator,
  profileImage: creatorProfileImageOverrides[creator.id] ?? creator.profileImage,
}));
const sourcesWithProfileImages: Source[] = (dataset.sources ?? []).map((source) => ({
  ...source,
  imageUrl: sourceProfileImageOverrides[source.id] ?? source.imageUrl,
}));
const sourceBackedCreatorIds = new Set(
  sourcesWithProfileImages
    .map((source) => source.creatorId)
    .filter((creatorId): creatorId is string => Boolean(creatorId))
);
const normalizedDataset: MatpickDataSet = {
  ...dataset,
  creators: creatorsWithProfileImages,
  sources: sourcesWithProfileImages,
};

export const creators: Creator[] = normalizedDataset.creators;
export const restaurants: Restaurant[] = normalizedDataset.restaurants;
export const visits: Visit[] = normalizedDataset.visits;
export const sources: Source[] = normalizedDataset.sources ?? [];
export const sourceLinks: SourceLink[] = normalizedDataset.sourceLinks ?? [];
export const dataSet: MatpickDataSet = normalizedDataset;
const restaurantById = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));

const visitsByRestaurantId = new Map<string, Visit[]>();
const creatorIdsByRestaurantId = new Map<string, Set<string>>();
const restaurantIdsByCreatorId = new Map<string, Set<string>>();
const sourceLinksByRestaurantId = new Map<string, SourceLink[]>();
const sourceIdsByRestaurantId = new Map<string, Set<string>>();
const restaurantIdsBySourceId = new Map<string, Set<string>>();
const recommendationCountByRestaurantId = new Map<string, number>();

visits.forEach((visit) => {
  const restaurantVisits = visitsByRestaurantId.get(visit.restaurantId) ?? [];
  restaurantVisits.push(visit);
  visitsByRestaurantId.set(visit.restaurantId, restaurantVisits);

  const creatorIds = creatorIdsByRestaurantId.get(visit.restaurantId) ?? new Set<string>();
  creatorIds.add(visit.creatorId);
  creatorIdsByRestaurantId.set(visit.restaurantId, creatorIds);

  const restaurantIds = restaurantIdsByCreatorId.get(visit.creatorId) ?? new Set<string>();
  restaurantIds.add(visit.restaurantId);
  restaurantIdsByCreatorId.set(visit.creatorId, restaurantIds);
});

sourceLinks.forEach((link) => {
  const restaurantLinks = sourceLinksByRestaurantId.get(link.restaurantId) ?? [];
  restaurantLinks.push(link);
  sourceLinksByRestaurantId.set(link.restaurantId, restaurantLinks);

  const sourceIds = sourceIdsByRestaurantId.get(link.restaurantId) ?? new Set<string>();
  sourceIds.add(link.sourceId);
  sourceIdsByRestaurantId.set(link.restaurantId, sourceIds);

  const restaurantIds = restaurantIdsBySourceId.get(link.sourceId) ?? new Set<string>();
  restaurantIds.add(link.restaurantId);
  restaurantIdsBySourceId.set(link.sourceId, restaurantIds);
});

creatorIdsByRestaurantId.forEach((creatorIds, restaurantId) => {
  recommendationCountByRestaurantId.set(restaurantId, creatorIds.size);
});

type CountEntry = {
  name: string;
  count: number;
};

const regionAliases: Record<string, string> = {
  강남역: "서울",
  건대: "서울",
  광장시장: "서울",
  남대문시장: "서울",
  대학로: "서울",
  망원: "서울",
  명동: "서울",
  문래동: "서울",
  북촌: "서울",
  사당: "서울",
  상암: "서울",
  성수동: "서울",
  신림: "서울",
  압구정: "서울",
  연남동: "서울",
  이태원: "서울",
  잠실: "서울",
  종로: "서울",
  홍대: "서울",
  여의도: "서울",
  을지로: "서울",
  신당동: "서울",
  왕십리: "서울",
  신촌: "서울",
  서촌: "서울",
  한남동: "서울",
  합정: "서울",
  해방촌: "서울",
  연신내: "서울",
  영등포: "서울",
  코엑스: "서울",
  용산: "서울",
  안양: "경기",
  안산: "경기",
  분당: "경기",
  김포: "경기",
  남양주: "경기",
  일산: "경기",
  파주: "경기",
  원주: "강원",
  강릉: "강원",
  속초: "강원",
  춘천: "강원",
  양양: "강원",
  수원: "경기",
  구로디지털단지: "서울",
  군산: "전북",
  전주: "전북",
  목포: "전남",
  남원: "전북",
  경주: "경북",
  구미: "경북",
  서산: "충남",
  천안: "충남",
  청주: "충북",
  충주: "충북",
  여수: "전남",
  해남: "전남",
  해운대: "부산",
  진해: "경남",
  창원: "경남",
  교토: "해외",
  방콕: "해외",
  오사카: "해외",
  도쿄: "해외",
  후쿠오카: "해외",
  하와이: "해외",
  홍콩: "해외",
};

const broadRegionOrder = [
  "서울",
  "경기",
  "부산",
  "대구",
  "대전",
  "광주",
  "인천",
  "울산",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
  "해외",
] as const;

function sortText(a: string, b: string) {
  return a.localeCompare(b, "ko-KR");
}

function getSourceTypeLabel(type: Source["type"]) {
  switch (type) {
    case "guide":
      return "가이드";
    case "tv_show":
      return "방송";
    case "michelin":
      return "미쉐린";
    case "institution":
      return "기관 선정";
    case "book":
      return "책";
    case "magazine":
      return "매거진";
    case "creator":
      return "크리에이터";
    default:
      return "출처";
  }
}

function createSearchId(prefix: string, value: string) {
  return `${prefix}:${encodeURIComponent(value)}`;
}

function countBy(values: string[]): CountEntry[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || sortText(a.name, b.name));
}

export function getCreatorsByRestaurant(restaurantId: string): Creator[] {
  const creatorIdSet = creatorIdsByRestaurantId.get(restaurantId) ?? new Set<string>();

  return creators.filter((creator) => creatorIdSet.has(creator.id));
}

export function getRestaurantById(restaurantId: string) {
  return restaurantById.get(restaurantId) ?? null;
}

export function getRestaurantsByCreator(creatorId: string): Restaurant[] {
  const restaurantIds = restaurantIdsByCreatorId.get(creatorId) ?? new Set<string>();

  return restaurants.filter((restaurant) => restaurantIds.has(restaurant.id));
}

export function getVisitsByRestaurant(restaurantId: string): Visit[] {
  return visitsByRestaurantId.get(restaurantId) ?? [];
}

export function getRestaurantBroadcastMeta(
  restaurantId: string
): RestaurantBroadcastMeta | null {
  const seenLabels = new Set<string>();
  const visitLabels = getVisitsByRestaurant(restaurantId)
    .slice()
    .sort(sortVisitsByDate)
    .map((visit) => {
      const label =
        visit.episode?.trim() ||
        visit.videoTitle?.trim() ||
        visit.series?.trim() ||
        "";

      return label;
    })
    .filter((label): label is string => Boolean(label))
    .filter((label) => {
      const normalized = normalizeLookupValue(label);
      if (seenLabels.has(normalized)) {
        return false;
      }

      seenLabels.add(normalized);
      return true;
    });

  const sourceLabels = getSourceLinksByRestaurant(restaurantId)
    .slice()
    .sort((a, b) => (a.ordinal ?? Number.MAX_SAFE_INTEGER) - (b.ordinal ?? Number.MAX_SAFE_INTEGER))
    .map((link) => {
      if (link.label?.trim()) {
        return link.label.trim();
      }

      if (episodicSourceIds.has(link.sourceId) && Number.isFinite(link.ordinal)) {
        return `EP.${link.ordinal}`;
      }

      return "";
    })
    .filter((label): label is string => Boolean(label))
    .filter((label) => {
      const normalized = normalizeLookupValue(label);
      if (seenLabels.has(normalized)) {
        return false;
      }

      seenLabels.add(normalized);
      return true;
    });

  const episodeLabels = [...visitLabels, ...sourceLabels];

  if (episodeLabels.length === 0) {
    return null;
  }

  return {
    count: episodeLabels.length,
    primaryEpisode: episodeLabels[0],
    episodeLabels,
  };
}

export function getRestaurantMenuItems(restaurant: Restaurant): MenuItem[] {
  if (restaurant.menus && restaurant.menus.length > 0) {
    return restaurant.menus.filter((menu) => menu.name.trim().length > 0);
  }

  const items: MenuItem[] = [];

  (restaurant.representativeMenu || "").split("/").forEach((chunk, index) => {
    const trimmed = chunk.trim();
    if (!trimmed) {
      return;
    }

    const priceMatch = trimmed.match(/(\d[\d,]*원?)/);
    const price = priceMatch ? priceMatch[1] : undefined;
    const name = price ? trimmed.replace(price, "").trim() : trimmed;

    items.push({
      id: `${restaurant.id}_menu_${index}`,
      name: name || trimmed,
      price,
      isSignature: index === 0,
    });
  });

  return items;
}

export function getRestaurantMenuSummary(restaurant: Restaurant) {
  const items = getRestaurantMenuItems(restaurant);
  if (items.length === 0) {
    return "";
  }

  return items
    .slice(0, 3)
    .map((item) => item.name)
    .filter(Boolean)
    .join(" / ");
}

export function getSourceLinksByRestaurant(restaurantId: string) {
  return sourceLinksByRestaurantId.get(restaurantId) ?? [];
}

export function getSourcesByRestaurant(restaurantId: string) {
  const linkedSourceIds = sourceIdsByRestaurantId.get(restaurantId) ?? new Set<string>();

  return sources.filter((source) => linkedSourceIds.has(source.id));
}

export function getSourceById(sourceId: string) {
  return sources.find((source) => source.id === sourceId) ?? null;
}

export function getRestaurantsBySource(sourceId: string) {
  const linkedRestaurantIds = restaurantIdsBySourceId.get(sourceId) ?? new Set<string>();

  return restaurants.filter((restaurant) => linkedRestaurantIds.has(restaurant.id));
}

export function getSourceRestaurantCount(sourceId: string) {
  return restaurantIdsBySourceId.get(sourceId)?.size ?? 0;
}

function buildDiscoveryTopicKey(kind: DiscoveryTopicKind, targetId: string) {
  return `${kind}:${targetId}`;
}

function buildDiscoveryTopicPath(slug: string) {
  return `/explore/topic/${slug}`;
}

function buildDiscoveryTopicEpisodePath(topicSlug: string, episodeSlug: string) {
  return `/explore/topic/${topicSlug}/episode/${episodeSlug}`;
}

function slugifyTopicSegment(value: string) {
  const normalized = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  const slug = normalized
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "episode";
}

function getEpisodeSortValue(value: string) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function sortVisitsByDate(a: Visit, b: Visit) {
  return (b.visitDate || "").localeCompare(a.visitDate || "", "ko-KR");
}

function buildCreatorTopicDescription(creator: Creator, count: number) {
  const displayName = getCreatorDisplayName(creator);
  return `${displayName}에서 소개된 맛집 ${count}곳을 지역과 음식별로 모아 탐색해보세요.`;
}

function buildSourceTopicDescription(source: Source, count: number) {
  return `${source.name}에 포함된 맛집 ${count}곳을 지역과 음식별로 한눈에 둘러보세요.`;
}

const typedDiscoveryTopicDefinitions =
  discoveryTopicDefinitions as DiscoveryTopicDefinition[];

export const discoveryTopics: DiscoveryTopic[] = typedDiscoveryTopicDefinitions
  .map<DiscoveryTopic | null>((definition) => {
    if (definition.kind === "creator") {
      const creator = creators.find((entry) => entry.id === definition.targetId);
      if (!creator) {
        return null;
      }

      const count = getRestaurantsByCreator(creator.id).length;
      if (count === 0) {
        return null;
      }

      return {
        slug: definition.slug,
        kind: definition.kind,
        targetId: definition.targetId,
        key: buildDiscoveryTopicKey(definition.kind, definition.targetId),
        name: getCreatorDisplayName(creator),
        description: buildCreatorTopicDescription(creator, count),
        path: buildDiscoveryTopicPath(definition.slug),
        count,
        imageUrl: creator.profileImage,
      };
    }

    const source = getSourceById(definition.targetId);
    if (!source) {
      return null;
    }

    const count = getSourceRestaurantCount(source.id);
    if (count === 0) {
      return null;
    }

    return {
      slug: definition.slug,
      kind: definition.kind,
      targetId: definition.targetId,
      key: buildDiscoveryTopicKey(definition.kind, definition.targetId),
      name: source.name,
      description: buildSourceTopicDescription(source, count),
      path: buildDiscoveryTopicPath(definition.slug),
      count,
      imageUrl: source.imageUrl,
    };
  })
  .filter((topic): topic is DiscoveryTopic => topic != null);

export function getDiscoveryTopicBySlug(slug: string) {
  return discoveryTopics.find((topic) => topic.slug === slug) ?? null;
}

export function getDiscoveryTopicByTarget(
  kind: DiscoveryTopicKind,
  targetId: string
) {
  return (
    discoveryTopics.find(
      (topic) => topic.kind === kind && topic.targetId === targetId
    ) ?? null
  );
}

const discoveryTopicEpisodesBySlug = new Map<string, DiscoveryTopicEpisode[]>(
  discoveryTopics.map((topic) => {
    const episodeCreatorId =
      topic.kind === "creator"
        ? topic.targetId
        : getSourceById(topic.targetId)?.creatorId ?? null;

    if (!episodeCreatorId) {
      return [topic.slug, []];
    }

    const creatorVisits = visits
      .filter((visit) => visit.creatorId === episodeCreatorId)
      .sort(sortVisitsByDate);
    const groupedVisits = new Map<string, Visit[]>();

    creatorVisits.forEach((visit) => {
      const groupKey = visit.videoId || visit.episode || visit.videoTitle || visit.id;
      const current = groupedVisits.get(groupKey) ?? [];
      current.push(visit);
      groupedVisits.set(groupKey, current);
    });

    const usedSlugs = new Set<string>();
    const episodes = Array.from(groupedVisits.values())
      .map((episodeVisits) => {
        const firstVisit = [...episodeVisits].sort(sortVisitsByDate)[0];
        const episodeLabel =
          firstVisit?.episode?.trim() ||
          firstVisit?.videoTitle?.trim() ||
          firstVisit?.videoId?.trim() ||
          "회차";
        const baseSlug = slugifyTopicSegment(episodeLabel);
        let episodeSlug = baseSlug;

        if (usedSlugs.has(episodeSlug)) {
          episodeSlug = `${baseSlug}-${slugifyTopicSegment(firstVisit.videoId || firstVisit.id)}`;
        }
        usedSlugs.add(episodeSlug);

        const restaurantIds = Array.from(
          new Set(episodeVisits.map((visit) => visit.restaurantId).filter(Boolean))
        );
        const videoTitle = firstVisit?.videoTitle?.trim() || `${topic.name} ${episodeLabel}`;
        const videoUrl = firstVisit?.videoUrl?.trim() || "";

        return {
          slug: episodeSlug,
          topicSlug: topic.slug,
          episode: episodeLabel,
          title: videoTitle,
          description: `${topic.name} ${episodeLabel}에 소개된 맛집 ${restaurantIds.length}곳을 모아봤어요.`,
          videoTitle,
          videoUrl,
          restaurantIds,
          count: restaurantIds.length,
          path: buildDiscoveryTopicEpisodePath(topic.slug, episodeSlug),
        } satisfies DiscoveryTopicEpisode;
      })
      .filter((episode) => episode.count > 0)
      .sort(
        (a, b) =>
          getEpisodeSortValue(a.episode) - getEpisodeSortValue(b.episode) ||
          sortText(a.episode, b.episode)
      );

    return [topic.slug, episodes];
  })
);

export function getDiscoveryTopicEpisodes(topicSlug: string) {
  return discoveryTopicEpisodesBySlug.get(topicSlug) ?? [];
}

export function getDiscoveryTopicEpisodeBySlug(
  topicSlug: string,
  episodeSlug: string
) {
  return (
    getDiscoveryTopicEpisodes(topicSlug).find((episode) => episode.slug === episodeSlug) ??
    null
  );
}

export function getUniqueRegions(): string[] {
  return Array.from(new Set(restaurants.map((restaurant) => restaurant.region).filter(Boolean))).sort(sortText);
}

export function getBroadRegion(region: string): string {
  if (!region) return "기타";
  if (region.startsWith("서울")) return "서울";
  if (region.startsWith("부산")) return "부산";
  if (region.startsWith("대구")) return "대구";
  if (region.startsWith("대전")) return "대전";
  if (region.startsWith("광주")) return "광주";
  if (region.startsWith("인천")) return "인천";
  if (region.startsWith("울산")) return "울산";
  if (region.startsWith("세종")) return "세종";
  if (region.startsWith("경기")) return "경기";
  if (region.startsWith("강원")) return "강원";
  if (region.startsWith("충북")) return "충북";
  if (region.startsWith("충남")) return "충남";
  if (region.startsWith("전북")) return "전북";
  if (region.startsWith("전남")) return "전남";
  if (region.startsWith("경북")) return "경북";
  if (region.startsWith("경남")) return "경남";
  if (region.startsWith("제주")) return "제주";

  for (const [areaName, broadRegion] of Object.entries(regionAliases)) {
    if (region.includes(areaName)) {
      return broadRegion;
    }
  }

  return region;
}

export function getBroadRegions(): string[] {
  const available = new Set(
    restaurants
      .map((restaurant) => getBroadRegion(restaurant.region))
      .filter((region) => region !== "기타")
  );

  return broadRegionOrder.filter((region) => available.has(region));
}

const cuisineCategoryOrder = [
  "한식",
  "중식",
  "일식",
  "양식",
  "멕시칸",
  "인도",
  "태국",
  "베트남",
] as const;

const cuisineCategoryMatchers: Array<{
  name: (typeof cuisineCategoryOrder)[number];
  keywords: string[];
}> = [
  {
    name: "한식",
    keywords: [
      "한식",
      "설렁탕",
      "곰탕",
      "국밥",
      "냉면",
      "백반",
      "비빔밥",
      "국수",
      "칼국수",
      "갈비",
      "불고기",
      "장어",
      "해장국",
      "추어탕",
      "복국",
      "떡갈비",
      "보쌈",
      "족발",
      "찌개",
      "전골",
      "정식",
      "회",
      "게장",
      "분식",
      "삼겹",
      "순대",
      "보리밥",
      "쌈밥",
      "아구",
      "해물탕",
    ],
  },
  {
    name: "중식",
    keywords: [
      "중식",
      "짜장",
      "짬뽕",
      "탕수육",
      "마라",
      "딤섬",
      "양꼬치",
      "훠궈",
      "사천",
      "중국",
      "홍콩",
    ],
  },
  {
    name: "일식",
    keywords: [
      "일식",
      "스시",
      "초밥",
      "오마카세",
      "사시미",
      "라멘",
      "우동",
      "돈카츠",
      "돈까스",
      "규카츠",
      "텐동",
      "소바",
      "이자카야",
      "야키토리",
      "일본",
    ],
  },
  {
    name: "양식",
    keywords: [
      "양식",
      "파스타",
      "피자",
      "스테이크",
      "이탈리안",
      "프렌치",
      "브런치",
      "버거",
      "샌드위치",
      "비스트로",
      "그릴",
      "유럽",
      "와인",
    ],
  },
  {
    name: "멕시칸",
    keywords: ["멕시칸", "타코", "부리또", "브리또", "퀘사디아", "나초", "엔칠라다"],
  },
  {
    name: "인도",
    keywords: ["인도", "커리", "카레", "난", "탄두리", "비리야니"],
  },
  {
    name: "태국",
    keywords: ["태국", "팟타이", "똠얌", "카오", "쏨땀", "태국식"],
  },
  {
    name: "베트남",
    keywords: ["베트남", "쌀국수", "포", "반미", "분짜", "짜조", "월남쌈"],
  },
];

export function getCuisineCategory(category: string) {
  const normalized = category.trim().toLowerCase();

  if (!normalized) {
    return "한식";
  }

  const matched = cuisineCategoryMatchers.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
  );

  return matched?.name ?? "한식";
}

export function getCuisineCategories() {
  return [...cuisineCategoryOrder];
}

export function getTotalCreatorCount(): number {
  return creators.length;
}

export function getRecommendationCount(restaurantId: string): number {
  return recommendationCountByRestaurantId.get(restaurantId) ?? 0;
}

export type RelatedRestaurant = {
  restaurant: Restaurant;
  score: number;
  distanceKm: number | null;
  sharedCreatorCount: number;
  sharedSourceCount: number;
  sharedMenuCount: number;
  sameCuisine: boolean;
  sameRegion: boolean;
};

function hasCoords(restaurant: Pick<Restaurant, "lat" | "lng">) {
  return Number.isFinite(restaurant.lat) && Number.isFinite(restaurant.lng) && restaurant.lat !== 0 && restaurant.lng !== 0;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function getDistanceKmBetweenRestaurants(
  sourceRestaurant: Pick<Restaurant, "lat" | "lng">,
  targetRestaurant: Pick<Restaurant, "lat" | "lng">
) {
  if (!hasCoords(sourceRestaurant) || !hasCoords(targetRestaurant)) {
    return null;
  }

  const earthRadiusKm = 6371;
  const deltaLat = toRadians(targetRestaurant.lat - sourceRestaurant.lat);
  const deltaLng = toRadians(targetRestaurant.lng - sourceRestaurant.lng);
  const sourceLat = toRadians(sourceRestaurant.lat);
  const targetLat = toRadians(targetRestaurant.lat);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(sourceLat) *
      Math.cos(targetLat) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function getMenuKeywordSet(restaurant: Restaurant) {
  return new Set(
    getRestaurantMenuItems(restaurant)
      .map((menu) => menu.name.trim().toLowerCase())
      .filter(Boolean)
  );
}

function buildRestaurantRelation(baseRestaurant: Restaurant, candidateRestaurant: Restaurant): RelatedRestaurant {
  const baseCreatorIds = creatorIdsByRestaurantId.get(baseRestaurant.id) ?? new Set<string>();
  const candidateCreatorIds = creatorIdsByRestaurantId.get(candidateRestaurant.id) ?? new Set<string>();
  const baseSourceIds = sourceIdsByRestaurantId.get(baseRestaurant.id) ?? new Set<string>();
  const candidateSourceIds = sourceIdsByRestaurantId.get(candidateRestaurant.id) ?? new Set<string>();
  const baseMenuKeywords = getMenuKeywordSet(baseRestaurant);
  const candidateMenuKeywords = getMenuKeywordSet(candidateRestaurant);

  let sharedCreatorCount = 0;
  baseCreatorIds.forEach((creatorId) => {
    if (candidateCreatorIds.has(creatorId)) {
      sharedCreatorCount += 1;
    }
  });

  let sharedSourceCount = 0;
  baseSourceIds.forEach((sourceId) => {
    if (candidateSourceIds.has(sourceId)) {
      sharedSourceCount += 1;
    }
  });

  let sharedMenuCount = 0;
  baseMenuKeywords.forEach((menuKeyword) => {
    if (candidateMenuKeywords.has(menuKeyword)) {
      sharedMenuCount += 1;
    }
  });

  const sameCuisine =
    getCuisineCategory(baseRestaurant.category) === getCuisineCategory(candidateRestaurant.category);
  const sameRegion = getBroadRegion(baseRestaurant.region) === getBroadRegion(candidateRestaurant.region);
  const distanceKm = getDistanceKmBetweenRestaurants(baseRestaurant, candidateRestaurant);
  const distanceBonus =
    distanceKm == null ? 0 : Math.max(0, 16 - Math.min(distanceKm, 16));

  const score =
    sharedCreatorCount * 42 +
    sharedSourceCount * 32 +
    sharedMenuCount * 10 +
    (sameCuisine ? 12 : 0) +
    (sameRegion ? 10 : 0) +
    distanceBonus +
    Math.min(getRecommendationCount(candidateRestaurant.id), 6);

  return {
    restaurant: candidateRestaurant,
    score,
    distanceKm,
    sharedCreatorCount,
    sharedSourceCount,
    sharedMenuCount,
    sameCuisine,
    sameRegion,
  };
}

export function getRelatedRestaurants(restaurantId: string, limit = 6): RelatedRestaurant[] {
  const restaurant = getRestaurantById(restaurantId);
  if (!restaurant) {
    return [];
  }

  return restaurants
    .filter((candidate) => candidate.id !== restaurantId)
    .map((candidate) => buildRestaurantRelation(restaurant, candidate))
    .filter(
      (relation) =>
        relation.sharedCreatorCount > 0 ||
        relation.sharedSourceCount > 0 ||
        relation.sameCuisine ||
        relation.sameRegion
    )
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (left.distanceKm == null && right.distanceKm == null) {
        return left.restaurant.name.localeCompare(right.restaurant.name, "ko-KR");
      }

      if (left.distanceKm == null) return 1;
      if (right.distanceKm == null) return -1;
      return left.distanceKm - right.distanceKm;
    })
    .slice(0, limit);
}

export function getNearbyRestaurants(restaurantId: string, limit = 6): RelatedRestaurant[] {
  const restaurant = getRestaurantById(restaurantId);
  if (!restaurant) {
    return [];
  }

  return restaurants
    .filter((candidate) => candidate.id !== restaurantId)
    .map((candidate) => buildRestaurantRelation(restaurant, candidate))
    .filter((relation) => relation.distanceKm != null)
    .sort((left, right) => {
      if (left.distanceKm == null || right.distanceKm == null) {
        return left.score - right.score;
      }

      if (left.distanceKm !== right.distanceKm) {
        return left.distanceKm - right.distanceKm;
      }

      return right.score - left.score;
    })
    .slice(0, limit);
}

export function getAllCategories(): string[] {
  return Array.from(new Set(restaurants.map((restaurant) => restaurant.category).filter(Boolean))).sort(sortText);
}

export function getRegions(): string[] {
  return getBroadRegions();
}

export function getRestaurantsByCategory(category: string): Restaurant[] {
  return restaurants.filter(
    (restaurant) =>
      restaurant.category === category || getCuisineCategory(restaurant.category) === category
  );
}

export function getRestaurantsBySeries(series: string): Restaurant[] {
  const restaurantIds = new Set(
    visits
      .filter((visit) => visit.series === series)
      .map((visit) => visit.restaurantId)
      .filter(Boolean)
  );

  return restaurants.filter((restaurant) => restaurantIds.has(restaurant.id));
}

export function getSeriesList(): string[] {
  return Array.from(new Set(visits.map((visit) => visit.series).filter(Boolean))).sort(sortText);
}

const regionCounts = countBy(restaurants.map((restaurant) => restaurant.region));
const categoryCounts = countBy(
  restaurants.map((restaurant) => getCuisineCategory(restaurant.category))
);
const sortedRestaurants = [...restaurants].sort(
  (a, b) => getRecommendationCount(b.id) - getRecommendationCount(a.id) || sortText(a.name, b.name)
);
const sourceSearchEntries = sources
  .map((source) => ({
    source,
    restaurantCount: getSourceRestaurantCount(source.id),
  }))
  .filter((entry) => entry.restaurantCount > 0)
  .sort(
    (a, b) =>
      b.restaurantCount - a.restaurantCount ||
      sortText(a.source.name, b.source.name)
  );

export const searchData: SearchItem[] = [
  ...creators
    .filter((creator) => !sourceBackedCreatorIds.has(creator.id))
    .map((creator) => ({
    id: createSearchId("creator", creator.id),
    type: "creator" as const,
    name: getCreatorSearchName(creator),
    subtitle: `${creator.channelName} · ${creator.subscribers}`,
    icon: "🎬",
  })),
  ...regionCounts.map((entry) => ({
    id: createSearchId("region", entry.name),
    type: "region" as const,
    name: entry.name,
    subtitle: `맛집 ${entry.count}개`,
    icon: "📍",
  })),
  ...categoryCounts.map((entry) => ({
    id: createSearchId("food", entry.name),
    type: "food" as const,
    name: entry.name,
    subtitle: `맛집 ${entry.count}개`,
    icon: "🍽️",
  })),
  ...sourceSearchEntries.map((entry) => ({
    id: createSearchId("source", entry.source.id),
    type: "source" as const,
    name: entry.source.name,
    subtitle: `${getSourceTypeLabel(entry.source.type)} · 맛집 ${entry.restaurantCount}곳`,
    icon: "🗂️",
  })),
  ...sortedRestaurants.map((restaurant) => ({
    id: createSearchId("restaurant", restaurant.id),
    type: "restaurant" as const,
    name: restaurant.name,
    subtitle: restaurant.address || restaurant.region,
    icon: "🍴",
  })),
];

export const mockSearchData: SearchResult[] = [
  ...creators
    .filter((creator) => !sourceBackedCreatorIds.has(creator.id))
    .map((creator) => ({
    id: creator.id,
    type: "creator" as const,
    name: getCreatorSearchName(creator),
    platform: "YouTube",
    subscribers: creator.subscribers,
    image: creator.profileImage,
  })),
  ...regionCounts.map((entry) => ({
    id: createSearchId("region", entry.name),
    type: "region" as const,
    name: entry.name,
    parentRegion: getBroadRegion(entry.name),
    restaurantCount: entry.count,
  })),
  ...categoryCounts.map((entry) => ({
    id: createSearchId("food", entry.name),
    type: "food" as const,
    name: entry.name,
    restaurantCount: entry.count,
  })),
  ...sourceSearchEntries.map((entry) => ({
    id: entry.source.id,
    type: "source" as const,
    name: entry.source.name,
    image: entry.source.imageUrl,
    restaurantCount: entry.restaurantCount,
    sourceTypeLabel: getSourceTypeLabel(entry.source.type),
  })),
  ...sortedRestaurants.map((restaurant) => ({
    id: restaurant.id,
    type: "restaurant" as const,
    name: restaurant.name,
    category: restaurant.category,
    address: restaurant.address,
  })),
];

export type {
  Creator,
  MatpickDataSet,
  MenuItem,
  Restaurant,
  SearchItem,
  SearchResult,
  Source,
  SourceLink,
  Visit,
} from "./types";
