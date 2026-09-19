import aliases from "./legacy-restaurant-aliases.json";

// Keep favorites available without downloading the restaurant catalog on the home page.
export function resolveRestaurantId(id: string): string {
  return (aliases as Record<string, string>)[id] ?? id;
}
