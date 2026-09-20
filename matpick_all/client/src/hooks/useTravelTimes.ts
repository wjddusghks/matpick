import { useEffect, useMemo, useRef, useState } from "react";
import type { Restaurant } from "@/data/types";
import { getOdsayWebTransit } from "@/lib/odsayTransit";
import {
  isValidTravelMode,
  type RestaurantTravelTimes,
} from "@/lib/travelTimes";
const ODSAY_WEB_KEY = import.meta.env.VITE_ODSAY_WEB_API_KEY?.trim() ?? "";

export function useTravelTimes(
  restaurants: Restaurant[],
  origin: { lat: number; lng: number } | null,
  revision: number
) {
  const ids = restaurants
    .slice(0, 6)
    .filter(
      restaurant =>
        !restaurant.isOverseas &&
        restaurant.lat >= 32 &&
        restaurant.lat <= 39.5 &&
        restaurant.lng >= 124 &&
        restaurant.lng <= 132
    )
    .map(restaurant => restaurant.id);
  const key = JSON.stringify({
    ids,
    lat: origin?.lat,
    lng: origin?.lng,
    revision,
  });
  const [state, setState] = useState<{
    key: string;
    values: Record<string, RestaurantTravelTimes>;
    loading: boolean;
  }>({ key: "", values: {}, loading: false });
  const cache = useRef(
    new Map<
      string,
      { values: Record<string, RestaurantTravelTimes>; until: number }
    >()
  );
  useEffect(() => {
    if (!origin || !ids.length) return;
    const cached = cache.current.get(key);
    if (cached && cached.until > Date.now()) {
      setState({ key, values: cached.values, loading: false });
      return;
    }
    if (
      origin.lat < 32 ||
      origin.lat > 39.5 ||
      origin.lng < 124 ||
      origin.lng > 132
    ) {
      setState({
        key,
        values: Object.fromEntries(
          ids.map(id => [
            id,
            {
              driving: { status: "unsupported" },
              transit: { status: "unsupported" },
            },
          ])
        ),
        loading: false,
      });
      return;
    }
    const controller = new AbortController();
    setState({ key, values: {}, loading: true });
    let timeout: ReturnType<typeof setTimeout>;
    const timer = setTimeout(async () => {
      timeout = setTimeout(() => controller.abort(), 15000);
      let values: Record<string, RestaurantTravelTimes> = {};
      const webTransit = ODSAY_WEB_KEY
        ? Promise.all(
            restaurants
              .slice(0, 6)
              .filter(restaurant => ids.includes(restaurant.id))
              .map(async restaurant => ({
                id: restaurant.id,
                result: await getOdsayWebTransit(
                  origin,
                  restaurant,
                  ODSAY_WEB_KEY,
                  controller.signal
                ),
              }))
          )
        : Promise.resolve([]);
      try {
        const response = await fetch("/api/routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: { lat: origin.lat, lng: origin.lng },
            restaurantIds: ids,
            skipTransit: Boolean(ODSAY_WEB_KEY),
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Route request failed");
        const payload = await response.json();
        if (!Array.isArray(payload.routes)) throw new Error("Invalid response");
        for (const route of payload.routes)
          if (
            ids.includes(route.restaurantId) &&
            isValidTravelMode(route.driving) &&
            isValidTravelMode(route.transit)
          )
            values[route.restaurantId] = {
              driving: route.driving,
              transit: route.transit,
            };
      } catch {
        /* Render an explicit unavailable state, never a made-up estimate. */
      }
      const transitResults = await webTransit;
      clearTimeout(timeout);
      for (const id of ids)
        values[id] ??= {
          driving: { status: "unavailable" },
          transit: { status: "unavailable" },
        };
      for (const transit of transitResults)
        values[transit.id].transit = transit.result;
      if (!active) return;
      // Cache lives only in this mounted page; never persist routes or origins.
      if (cache.current.size >= 5) cache.current.clear();
      const failed = Object.values(values).some(
        value =>
          value.driving.status === "unavailable" ||
          value.transit.status === "unavailable"
      );
      cache.current.set(key, {
        values,
        until: Date.now() + (failed ? 30000 : 180000),
      });
      if (active) setState({ key, values, loading: false });
    }, 350);
    let active = true;
    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(timeout);
      controller.abort();
    };
    // key includes both the destination list and the exact origin; stale responses cannot replace it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return useMemo(
    () =>
      state.key === key
        ? state
        : { key, values: {}, loading: Boolean(origin && ids.length) },
    [key, state]
  );
}
