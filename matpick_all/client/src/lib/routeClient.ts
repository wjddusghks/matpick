import { isValidTravelMode, type RestaurantTravelTimes } from "./travelTimes";
export function createRouteClient(
  fetcher: typeof fetch = (...args) => fetch(...args),
  now = () => Date.now()
) {
  const cache = new Map<
    string,
    { value: RestaurantTravelTimes; until: number }
  >();
  const pending = new Map<string, Promise<RestaurantTravelTimes>>();
  return {
    request(
      origin: { lat: number; lng: number },
      id: string
    ): Promise<RestaurantTravelTimes> {
      const key = `${origin.lat},${origin.lng}|${id}`;
      const hit = cache.get(key);
      if (hit && hit.until > now()) return Promise.resolve(hit.value);
      const inflight = pending.get(key);
      if (inflight) return inflight;
      const task = (async () => {
        let value: RestaurantTravelTimes = {
          driving: { status: "unavailable" },
        };
        try {
          const res = await fetcher("/api/routes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ origin, restaurantIds: [id] }),
            signal: AbortSignal.timeout(12000),
          });
          if (!res.ok) throw new Error("Route unavailable");
          const body = await res.json(),
            route = body.routes?.find(
              (r: { restaurantId: string }) => r.restaurantId === id
            );
          if (route && isValidTravelMode(route.driving))
            value = { driving: route.driving };
        } catch {
          /* The external directions link stays available. */
        }
        if (cache.size >= 100) cache.delete(cache.keys().next().value!);
        cache.set(key, {
          value,
          until: now() + (value.driving.status === "ok" ? 300000 : 30000),
        });
        return value;
      })();
      pending.set(key, task);
      void task.finally(() => pending.delete(key));
      return task;
    },
  };
}
