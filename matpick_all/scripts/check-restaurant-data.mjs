import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadPublicData, projectRoot } from "./load-public-data.mjs";

const data = await loadPublicData();
const errors = [];
const warnings = [];
const ids = new Set();
const sourceIds = new Set(data.sources.map(source => source.id));
const placeGroups = new Map();
const coordinateGroups = new Map();
for (const restaurant of data.restaurants) {
  if (ids.has(restaurant.id))
    errors.push(`Duplicate restaurant ID: ${restaurant.id}`);
  ids.add(restaurant.id);
  if (!restaurant.name.trim() || !restaurant.address.trim())
    errors.push(`Missing name/address: ${restaurant.id}`);
  if (
    !Number.isFinite(restaurant.lat) ||
    !Number.isFinite(restaurant.lng) ||
    restaurant.lat === 0 ||
    restaurant.lng === 0 ||
    Math.abs(restaurant.lat) > 90 ||
    Math.abs(restaurant.lng) > 180
  )
    errors.push(`Invalid coordinates: ${restaurant.id}`);
  const brief = {
    id: restaurant.id,
    name: restaurant.name,
    address: restaurant.address,
    lat: restaurant.lat,
    lng: restaurant.lng,
  };
  if (restaurant.kakaoPlaceId)
    placeGroups.set(restaurant.kakaoPlaceId, [
      ...(placeGroups.get(restaurant.kakaoPlaceId) ?? []),
      brief,
    ]);
  const point = `${restaurant.lat.toFixed(5)},${restaurant.lng.toFixed(5)}`;
  coordinateGroups.set(point, [...(coordinateGroups.get(point) ?? []), brief]);
  // Broad sanity check only; it is not a geocoding verdict.
  if (
    restaurant.region.startsWith("서울") &&
    !(
      restaurant.lat > 37.3 &&
      restaurant.lat < 37.8 &&
      restaurant.lng > 126.7 &&
      restaurant.lng < 127.3
    )
  )
    warnings.push({ kind: "seoul-coordinate-review", ...brief });
  if (data.getRecommendationCount(restaurant.id) < 1)
    errors.push(`No recommendation source: ${restaurant.id}`);
}
for (const link of data.sourceLinks) {
  if (!ids.has(link.restaurantId))
    errors.push(`Dangling restaurant reference: ${link.id}`);
  if (!sourceIds.has(link.sourceId))
    errors.push(`Dangling source reference: ${link.id}`);
}
const rawAliases = JSON.parse(
  await readFile(
    path.join(projectRoot, "client/src/data/legacy-restaurant-aliases.json"),
    "utf8"
  )
);
for (const [alias, target] of Object.entries(rawAliases)) {
  if (
    ids.has(alias) ||
    alias === target ||
    !ids.has(target) ||
    rawAliases[target]
  )
    errors.push(`Invalid or chained alias: ${alias} -> ${target}`);
}
const overrides = JSON.parse(
  await readFile(
    path.join(projectRoot, "client/src/data/restaurant-overrides.json"),
    "utf8"
  )
);
for (const [id, patch] of Object.entries(overrides)) {
  if (!ids.has(id) || "id" in patch) errors.push(`Invalid override ID: ${id}`);
  if (("lat" in patch || "lng" in patch) && (!patch.locationVerifiedAt || !patch.locationSourceUrls?.length))
    errors.push(`Coordinate correction needs verification date and source URLs: ${id}`);
  if (
    patch.operationState &&
    !["unknown", "operating", "closed", "moved", "temporarily_closed"].includes(
      patch.operationState
    )
  )
    errors.push(`Invalid operation state: ${id}`);
  if (
    patch.operationState &&
    patch.operationState !== "unknown" &&
    (!patch.operationVerifiedAt || !patch.operationSourceUrl)
  )
    errors.push(`Operation status needs verification date and source: ${id}`);
  if (
    patch.replacementRestaurantId &&
    (!ids.has(patch.replacementRestaurantId) ||
      patch.replacementRestaurantId === id)
  )
    errors.push(`Invalid relocation target: ${id}`);
}
for (const [placeId, restaurants] of placeGroups)
  if (restaurants.length > 1)
    warnings.push({ kind: "same-place-id-review", placeId, restaurants });
for (const [point, restaurants] of coordinateGroups)
  if (restaurants.length > 1)
    warnings.push({ kind: "shared-coordinate-review", point, restaurants });
const report = {
  restaurants: ids.size,
  sourceLinks: data.sourceLinks.length,
  aliases: Object.keys(rawAliases).length,
  recommendationHolds: data.restaurants.filter(restaurant => restaurant.recommendationHold)
    .map(({ id, name, recommendationHold }) => ({ id, name, reason: recommendationHold })),
  verifiedLocationCorrections: data.restaurants.filter(restaurant => restaurant.locationVerifiedAt).length,
  unclassified: data.restaurants
    .filter(
      restaurant => data.getCuisineCategory(restaurant.category) === "미분류"
    )
    .map(({ id, name, category }) => ({ id, name, category })),
  errors,
  warnings,
};
await mkdir(path.join(projectRoot, "reports"), { recursive: true });
await writeFile(
  path.join(projectRoot, "reports/restaurant-data-check.json"),
  JSON.stringify(report, null, 2) + "\n"
);
console.log(
  `${ids.size} restaurants, ${data.sourceLinks.length} source links, ${report.aliases} aliases; ${errors.length} errors, ${warnings.length} review groups.`
);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
}
