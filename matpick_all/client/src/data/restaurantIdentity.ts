import type { Restaurant } from "./types";

export function normalizeLookupValue(value: string) {
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

export function buildRestaurantLookupKeys(
  restaurant: Pick<Restaurant, "name" | "address" | "region">
) {
  const normalizedAddress = normalizeAddressForLookup(restaurant.address);
  return buildRestaurantNameLookupCandidates(restaurant).map(
    (nameCandidate) => `${nameCandidate}|${normalizedAddress}`
  );
}
