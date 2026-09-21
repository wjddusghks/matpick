import rawDataset from "./matpick-data.json";
import menuResearch from "./generated/menu-research.generated.json";
import existingDataEnrichment from "./generated/existing-data-enrichment.generated.json";
import menuPriceFollowup from "./generated/menu-price-followup.generated.json";
import travelDiscovery from "./generated/travel-discovery.generated.json";
import topicExpansion from "./generated/topic-expansion.generated.json";
import restaurantOverrides from "./restaurant-overrides.json";
import restaurantExclusions from "./restaurant-exclusions.json";
import { creatorProfileImageOverrides } from "./creatorProfileImages";
import { sourceProfileImageOverrides } from "./sourceProfileImages";
import oldKorean100Dataset from "./generated/old-korean-100.generated.json";
import sikgaekBaekbanTripDataset from "./generated/sikgaek-baekban-trip.generated.json";
import culinaryClassWarsDataset from "./generated/culinary-class-wars.generated.json";
import jeonhyunmooPlanDataset from "./generated/jeonhyunmoo-plan-public.generated.json";
import jeonhyunmooPlanLegacy from "./generated/jeonhyunmoo-plan.generated.json";
import baekbanTripTopicEnrichment from "./generated/topic-enrichments/baekban-trip.enriched.json";
import baekjongWokTopicEnrichment from "./generated/topic-enrichments/baekjong-wok.enriched.json";
import deliciousGuysTopicEnrichment from "./generated/topic-enrichments/delicious-guys.enriched.json";
import michelin1StarTopicEnrichment from "./generated/topic-enrichments/michelin-1-star.enriched.json";
import michelin2StarsTopicEnrichment from "./generated/topic-enrichments/michelin-2-stars.enriched.json";
import michelin3StarsTopicEnrichment from "./generated/topic-enrichments/michelin-3-stars.enriched.json";
import michelinBibGourmandTopicEnrichment from "./generated/topic-enrichments/michelin-bib-gourmand.enriched.json";
import michelinSelectedTopicEnrichment from "./generated/topic-enrichments/michelin-selected.enriched.json";
import oldKorean100TopicEnrichment from "./generated/topic-enrichments/old-korean-100.enriched.json";
import popularRestaurantsTopicEnrichment from "./generated/topic-enrichments/popular-restaurants.enriched.json";
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

import { buildRestaurantLookupKeys } from "./restaurantIdentity";

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

function mergeRestaurantMenus(
  currentMenus: MenuItem[] = [],
  nextMenus: MenuItem[] = []
) {
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

function mergeRestaurantById(
  current: Restaurant,
  next: Restaurant
): Restaurant {
  const preferredAddressRestaurant =
    preferLongerText(current.address, next.address) === next.address
      ? next
      : current;
  const newerMenuEdition = Boolean(
    next.menuPriceVerifiedAt &&
      next.menuPriceVerifiedAt > (current.menuPriceVerifiedAt || "")
  );
  const olderMenuEdition = Boolean(
    current.menuPriceVerifiedAt &&
      current.menuPriceVerifiedAt > (next.menuPriceVerifiedAt || "")
  );
  const menuEdition = olderMenuEdition ? current : next;

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
    // A freshly checked menu is a replacement snapshot; do not label old prices as freshly checked.
    menus: newerMenuEdition
      ? mergeRestaurantMenus(next.menus ?? [])
      : olderMenuEdition
        ? mergeRestaurantMenus(current.menus ?? [])
        : mergeRestaurantMenus(current.menus ?? [], next.menus ?? []),
    menuPriceVerifiedAt: menuEdition.menuPriceVerifiedAt,
    menuPriceSources: menuEdition.menuPriceSources,
    menuPriceNote: menuEdition.menuPriceNote,
    menuPriceStatus: menuEdition.menuPriceStatus,
    thumbnailFileName:
      current.thumbnailFileName ?? next.thumbnailFileName ?? null,
    googlePlaceId: current.googlePlaceId ?? next.googlePlaceId ?? null,
    isOverseas: current.isOverseas ?? next.isOverseas,
  };
}

function dedupeRestaurantsById(restaurantsToMerge: Restaurant[]) {
  const dedupedRestaurants: Restaurant[] = [];
  const indexByLookupKey = new Map<string, number>();
  const indexById = new Map<string, number>();
  const canonicalRestaurantIdMap = new Map<string, string>();

  restaurantsToMerge.forEach(restaurant => {
    const existingIndex =
      indexById.get(restaurant.id) ??
      buildRestaurantLookupKeys(restaurant)
        .map(lookupKey => indexByLookupKey.get(lookupKey))
        .find((value): value is number => value != null);

    if (existingIndex == null) {
      const nextIndex = dedupedRestaurants.length;
      dedupedRestaurants.push(restaurant);
      indexById.set(restaurant.id, nextIndex);
      canonicalRestaurantIdMap.set(restaurant.id, restaurant.id);
      buildRestaurantLookupKeys(restaurant).forEach(lookupKey => {
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
    indexById.set(restaurant.id, existingIndex);
    buildRestaurantLookupKeys(dedupedRestaurants[existingIndex]).forEach(
      lookupKey => {
        indexByLookupKey.set(lookupKey, existingIndex);
      }
    );
  });

  return {
    restaurants: dedupedRestaurants,
    canonicalRestaurantIdMap,
  };
}

function mergeDatasets(
  base: MatpickDataSet,
  extras: SourceDataset[]
): MatpickDataSet {
  const mergedRestaurants = [...base.restaurants];
  const mergedSources = [...(base.sources ?? [])];
  const mergedSourceLinks = [...(base.sourceLinks ?? [])];
  const restaurantIdMap = new Map<string, string>();
  const existingRestaurantIndex = new Map<string, number>();
  const existingRestaurantIndexById = new Map<string, number>();

  mergedRestaurants.forEach((restaurant, index) => {
    existingRestaurantIndexById.set(restaurant.id, index);
    buildRestaurantLookupKeys(restaurant).forEach(lookupKey => {
      existingRestaurantIndex.set(lookupKey, index);
    });
  });

  extras.forEach(extra => {
    const sourceIds = new Set((extra.sources ?? []).map(source => source.id));
    const patchOnlyDataset =
      sourceIds.size > 0 &&
      Array.from(sourceIds).every(sourceId =>
        patchOnlySourceIds.has(sourceId)
      ) &&
      (extra.restaurants ?? []).every(restaurant =>
        restaurant.id.startsWith("topic_enrichment_")
      );
    const patchableRestaurantIds = patchOnlyDataset
      ? new Set(
          mergedSourceLinks
            .filter(link => sourceIds.has(link.sourceId))
            .map(link => link.restaurantId)
        )
      : null;

    (extra.sources ?? []).forEach(source => {
      if (!mergedSources.some(item => item.id === source.id)) {
        mergedSources.push(source);
      }
    });

    (extra.restaurants ?? []).forEach(restaurant => {
      const existingIndex =
        existingRestaurantIndexById.get(restaurant.id) ??
        buildRestaurantLookupKeys(restaurant)
          .map(lookupKey => existingRestaurantIndex.get(lookupKey))
          .find(
            (value): value is number =>
              value != null &&
              (!patchableRestaurantIds ||
                patchableRestaurantIds.has(mergedRestaurants[value].id))
          );

      if (existingIndex != null) {
        const existing = mergedRestaurants[existingIndex];
        mergedRestaurants[existingIndex] = mergeRestaurantById(
          existing,
          restaurant
        );
        restaurantIdMap.set(restaurant.id, existing.id);
        existingRestaurantIndexById.set(restaurant.id, existingIndex);
        buildRestaurantLookupKeys(mergedRestaurants[existingIndex]).forEach(
          lookupKey => {
            existingRestaurantIndex.set(lookupKey, existingIndex);
          }
        );
        return;
      }

      if (patchOnlyDataset) {
        return;
      }

      mergedRestaurants.push(restaurant);
      const insertedIndex = mergedRestaurants.length - 1;
      existingRestaurantIndexById.set(restaurant.id, insertedIndex);
      buildRestaurantLookupKeys(restaurant).forEach(lookupKey => {
        existingRestaurantIndex.set(lookupKey, insertedIndex);
      });
      restaurantIdMap.set(restaurant.id, restaurant.id);
    });

    (extra.sourceLinks ?? []).forEach(link => {
      const remappedRestaurantId =
        restaurantIdMap.get(link.restaurantId) ?? link.restaurantId;
      if (
        patchOnlyDataset &&
        !restaurantIdMap.has(link.restaurantId) &&
        !mergedRestaurants.some(
          restaurant => restaurant.id === remappedRestaurantId
        )
      ) {
        return;
      }
      const dedupeKey = `${link.sourceId}:${remappedRestaurantId}:${link.ordinal ?? ""}:${link.label ?? ""}`;

      if (
        mergedSourceLinks.some(
          item =>
            `${item.sourceId}:${item.restaurantId}:${item.ordinal ?? ""}:${item.label ?? ""}` ===
            dedupeKey
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
  const dedupedRestaurantIds = new Set(
    deduped.restaurants.map(restaurant => restaurant.id)
  );
  const normalizedSourceLinks = new Map<string, SourceLink>();

  mergedSourceLinks.forEach(link => {
    const canonicalRestaurantId =
      deduped.canonicalRestaurantIdMap.get(link.restaurantId) ??
      link.restaurantId;

    if (!dedupedRestaurantIds.has(canonicalRestaurantId)) {
      return;
    }

    // Preserve separate appearances while counting distinct sources elsewhere.
    const dedupeKey = `${link.sourceId}:${canonicalRestaurantId}:${link.ordinal ?? ""}:${link.label ?? ""}`;
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

  const aliases = new Map<string, string>([
    ...Array.from(restaurantIdMap),
    ...Array.from(deduped.canonicalRestaurantIdMap),
  ]);
  restaurantIdMap.forEach((target, alias) => {
    aliases.set(alias, deduped.canonicalRestaurantIdMap.get(target) ?? target);
  });
  return {
    restaurantAliases: Object.fromEntries(aliases),
    creators: base.creators,
    visits: base.visits.map(visit => ({
      ...visit,
      restaurantId: aliases.get(visit.restaurantId) ?? visit.restaurantId,
    })),
    restaurants: deduped.restaurants,
    sources: mergedSources,
    sourceLinks: Array.from(normalizedSourceLinks.values()),
  };
}

const hiddenCreatorIds = new Set<string>(["UCfpaSruWW3S4dibonKXENjA"]);
const sourceIdsPendingEvidence = new Set<string>(["culinary-class-wars"]);
const publicDataSourceIds = new Set(
  [
    "ttoganjip",
    "popular-restaurants",
    "delicious-guys",
    "michelin",
    "old-korean-100",
    "baekjong-wok",
    "sikgaek-baekban-trip",
    "wednesday-gourmet",
    "culinary-class-wars",
    "jeonhyunmoo-plan",
    "busan-bite",
    "jeju-bite",
    "travel-bite",
    ...topicExpansion.sources.map(source => source.id),
  ].filter(sourceId => !sourceIdsPendingEvidence.has(sourceId))
);

function filterDatasetForVisibleContent(
  dataset: MatpickDataSet
): MatpickDataSet {
  const visibleCreators = dataset.creators.filter(
    creator => !hiddenCreatorIds.has(creator.id)
  );
  const visibleVisits: Visit[] = [];
  const visibleSourceLinks = (dataset.sourceLinks ?? []).filter(link =>
    publicDataSourceIds.has(link.sourceId)
  );
  const referencedRestaurantIds = new Set<string>();

  visibleVisits.forEach(visit => {
    if (visit.restaurantId) {
      referencedRestaurantIds.add(visit.restaurantId);
    }
  });

  visibleSourceLinks.forEach(link => {
    if (link.restaurantId) {
      referencedRestaurantIds.add(link.restaurantId);
    }
  });

  return {
    ...dataset,
    creators: visibleCreators.filter(creator =>
      visibleVisits.some(visit => visit.creatorId === creator.id)
    ),
    visits: visibleVisits,
    restaurants: dataset.restaurants.filter(restaurant =>
      referencedRestaurantIds.has(restaurant.id)
    ),
    sources: (dataset.sources ?? []).filter(source =>
      publicDataSourceIds.has(source.id)
    ),
    sourceLinks: visibleSourceLinks,
  };
}

const baseDataset = rawDataset as MatpickDataSet;
const dataset = filterDatasetForVisibleContent(
  mergeDatasets(baseDataset, [
    culinaryClassWarsDataset as SourceDataset,
    // Preserve canonical IDs already used by other public sources, without publishing unverified TV links.
    { restaurants: jeonhyunmooPlanLegacy.restaurants } as SourceDataset,
    oldKorean100Dataset as SourceDataset,
    baekjongWokTopicEnrichment as SourceDataset,
    sikgaekBaekbanTripDataset as SourceDataset,
    wednesdayGourmetDataset as SourceDataset,
    ttoganjipTopicEnrichment as SourceDataset,
    popularRestaurantsTopicEnrichment as SourceDataset,
    deliciousGuysTopicEnrichment as SourceDataset,
    baekbanTripTopicEnrichment as SourceDataset,
    wednesdayGourmetTopicEnrichment as SourceDataset,
    oldKorean100TopicEnrichment as SourceDataset,
    michelin3StarsTopicEnrichment as SourceDataset,
    michelin2StarsTopicEnrichment as SourceDataset,
    michelin1StarTopicEnrichment as SourceDataset,
    michelinBibGourmandTopicEnrichment as SourceDataset,
    michelinSelectedTopicEnrichment as SourceDataset,
    travelDiscovery as SourceDataset,
    jeonhyunmooPlanDataset as SourceDataset,
    topicExpansion as SourceDataset,
  ])
);
const creatorsWithProfileImages: Creator[] = dataset.creators.map(creator => ({
  ...creator,
  profileImage:
    creatorProfileImageOverrides[creator.id] ?? creator.profileImage,
}));
const sourcesWithProfileImages: Source[] = (dataset.sources ?? []).map(
  source => ({
    ...source,
    imageUrl: sourceProfileImageOverrides[source.id] ?? source.imageUrl,
  })
);
const excludedRestaurantIds = new Set(restaurantExclusions.restaurantIds);
const normalizedDataset: MatpickDataSet = {
  ...dataset,
  restaurants: dataset.restaurants.map(restaurant => ({
    ...restaurant,
    ...(!restaurant.menus?.length
      ? (menuResearch as Record<string, Partial<Restaurant>>)[restaurant.id]
      : {}),
    ...(existingDataEnrichment as Record<string, Partial<Restaurant>>)[restaurant.id],
    ...(menuPriceFollowup as Record<string, Partial<Restaurant>>)[restaurant.id],
    ...(restaurantOverrides as Record<string, Omit<Partial<Restaurant>, "id">>)[
      restaurant.id
    ],
    ...(excludedRestaurantIds.has(restaurant.id)
      ? { recommendationHold: restaurantExclusions.reason }
      : {}),
    id: restaurant.id,
  })),
  creators: creatorsWithProfileImages,
  sources: sourcesWithProfileImages,
};

const relocationTargets = new Map(
  normalizedDataset.restaurants
    .filter(
      restaurant =>
        restaurant.operationState === "moved" &&
        restaurant.replacementRestaurantId
    )
    .map(restaurant => [restaurant.id, restaurant.replacementRestaurantId!])
);
const originalLinks = normalizedDataset.sourceLinks ?? [];
const linkKeys = new Set(
  originalLinks.map(
    link =>
      `${link.restaurantId}:${link.sourceId}:${link.ordinal ?? ""}:${link.label ?? ""}`
  )
);
const relocatedLinks: SourceLink[] = [];
for (const link of originalLinks) {
  const target = relocationTargets.get(link.restaurantId);
  if (!target) continue;
  const key = `${target}:${link.sourceId}:${link.ordinal ?? ""}:${link.label ?? ""}`;
  if (linkKeys.has(key)) continue;
  linkKeys.add(key);
  relocatedLinks.push({
    ...link,
    id: `${link.id}:relocated`,
    restaurantId: target,
  });
}
// Keep historical evidence on the old page and carry it to the relocated recommendation.
export const publicDataset: MatpickDataSet = {
  ...normalizedDataset,
  // Menu IDs are only local React keys. Keep research IDs in source files, not every browser download.
  restaurants: normalizedDataset.restaurants.map(restaurant => {
    // Google identifiers are research-only: the UI uses Naver links and verified map coordinates.
    const { googlePlaceId: _researchGoogleId, ...publicRestaurant } =
      restaurant;
    return {
      ...publicRestaurant,
      menus: restaurant.menus?.map((menu, index) => {
        const { isSignature, ...fields } = menu;
        return {
          ...fields,
          id: `m${index.toString(36)}`,
          ...(isSignature ? { isSignature: true } : {}),
        };
      }),
    };
  }),
  sourceLinks: [...originalLinks, ...relocatedLinks],
};
