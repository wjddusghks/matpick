import type { Restaurant } from "@/data/types";

export type RestaurantEdit = {
  restaurantId: string;
  revision: number;
  updatedAt: string;
  createRequestId?: string;
  createdAt?: string;
  deletedAt?: string | null;
  changes: Partial<Restaurant>;
};

let savedEdits: RestaurantEdit[] = [];
let loadPromise: Promise<void> | undefined;

export function loadRestaurantEdits() {
  if (typeof window === "undefined") return Promise.resolve();
  loadPromise ??= fetch("/api/restaurants", {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  })
    .then(async response => {
      if (!response.ok) throw new Error("Restaurant edits unavailable");
      const payload = await response.json();
      if (Array.isArray(payload.edits)) savedEdits = payload.edits;
    })
    .catch(() => {
      /* The bundled catalog remains usable during a temporary API outage. */
    });
  return loadPromise;
}

export function applyRestaurantEdits(
  base: Restaurant[],
  edits = savedEdits,
  options: { includeDeleted?: boolean } = {}
): Restaurant[] {
  const byId = new Map(edits.map(edit => [edit.restaurantId, edit]));
  const baseIds = new Set(base.map(restaurant => restaurant.id));
  const created = edits
    .filter(edit => edit.createdAt && !baseIds.has(edit.restaurantId))
    .map(edit => ({ id: edit.restaurantId, ...edit.changes }) as Restaurant);
  return [...base, ...created]
    .filter(
      restaurant =>
        options.includeDeleted || !byId.get(restaurant.id)?.deletedAt
    )
    .map(restaurant => ({
      ...restaurant,
      ...byId.get(restaurant.id)?.changes,
      id: restaurant.id,
    }));
}
