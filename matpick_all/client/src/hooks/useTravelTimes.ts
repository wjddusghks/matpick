import { useEffect, useMemo, useRef, useState } from "react";
import type { Restaurant } from "@/data/types";
import {
  isValidTravelMode,
  type RestaurantTravelTimes,
} from "@/lib/travelTimes";

export function useTravelTimes(
  restaurants: Restaurant[],
  origin: { lat: number; lng: number } | null,
  revision: number
) {
  const ids = restaurants
    .filter(
      r =>
        !r.isOverseas &&
        r.lat >= 32 &&
        r.lat <= 39.5 &&
        r.lng >= 124 &&
        r.lng <= 132
    )
    .map(r => r.id);
  const originKey = JSON.stringify({
    lat: origin?.lat,
    lng: origin?.lng,
    revision,
  });
  const key = JSON.stringify({ ids, originKey });
  const [state, setState] = useState<{
    key: string;
    values: Record<string, RestaurantTravelTimes>;
    loading: boolean;
  }>({ key: "", values: {}, loading: false });
  const cache = useRef(
    new Map<string, { value: RestaurantTravelTimes; until: number }>()
  );
  useEffect(() => {
    if (!origin || !ids.length) return;
    const values: Record<string, RestaurantTravelTimes> = {};
    const missing: string[] = [];
    for (const id of ids) {
      const item = cache.current.get(originKey + id);
      if (item && item.until > Date.now()) values[id] = item.value;
      else missing.push(id);
    }
    if (
      origin.lat < 32 ||
      origin.lat > 39.5 ||
      origin.lng < 124 ||
      origin.lng > 132
    ) {
      for (const id of ids) values[id] = { driving: { status: "unsupported" } };
      setState({ key, values, loading: false });
      return;
    }
    setState({ key, values: { ...values }, loading: missing.length > 0 });
    if (!missing.length) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(async () => {
      // Only request newly revealed/expired rows, in the server's six-place batches.
      // Completed rows remain cached if a later click cancels a pending batch.
      for (let offset = 0; offset < missing.length && active; offset += 6) {
        const batch = missing.slice(offset, offset + 6);
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
          const response = await fetch("/api/routes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              origin: { lat: origin.lat, lng: origin.lng },
              restaurantIds: batch,
            }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("Route request failed");
          const payload = await response.json();
          if (!Array.isArray(payload.routes))
            throw new Error("Invalid response");
          for (const route of payload.routes) {
            if (
              !batch.includes(route.restaurantId) ||
              !isValidTravelMode(route.driving)
            )
              continue;
            const value = { driving: route.driving };
            values[route.restaurantId] = value;
            if (cache.current.size >= 300)
              cache.current.delete(cache.current.keys().next().value!);
            cache.current.set(originKey + route.restaurantId, {
              value,
              until:
                Date.now() +
                (route.driving.status === "unavailable" ? 30000 : 180000),
            });
          }
          if (active)
            setState({
              key,
              values: { ...values },
              loading: offset + 6 < missing.length,
            });
        } catch {
          // Stop on quota/network failure instead of issuing more requests.
          break;
        } finally {
          clearTimeout(timeout);
        }
      }
      if (!active) return;
      for (const id of ids)
        values[id] ??= { driving: { status: "unavailable" } };
      setState({ key, values: { ...values }, loading: false });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
    // Destination IDs and exact origin are represented in key.
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
