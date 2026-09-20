import { useCallback, useRef, useState } from "react";
import type { Restaurant } from "@/data/types";
import { createRouteClient } from "@/lib/routeClient";
import type { RestaurantTravelTimes } from "@/lib/travelTimes";

const client = createRouteClient();
export function useTravelTimes(
  restaurants: Restaurant[],
  origin: { lat: number; lng: number } | null,
  _revision: number
) {
  const key = origin ? `${origin.lat},${origin.lng}` : "";
  const current = useRef(key);
  current.current = key;
  const [state, setState] = useState<{
    key: string;
    values: Record<string, RestaurantTravelTimes>;
    loadingIds: string[];
  }>({ key, values: {}, loadingIds: [] });
  const request = useCallback(
    async (id: string) => {
      if (!origin || !restaurants.some(r => r.id === id)) return;
      setState(s => ({
        key,
        values: s.key === key ? s.values : {},
        loadingIds: Array.from(
          new Set([...(s.key === key ? s.loadingIds : []), id])
        ),
      }));
      const value = await client.request(origin, id);
      if (current.current !== key) return;
      setState(s => ({
        key,
        values: { ...(s.key === key ? s.values : {}), [id]: value },
        loadingIds: s.loadingIds.filter(x => x !== id),
      }));
    },
    [key, origin, restaurants]
  );
  // Search, rerender and show-more never initiate a route request.
  return {
    values: state.key === key ? state.values : {},
    loadingIds: state.key === key ? state.loadingIds : [],
    request,
  };
}
