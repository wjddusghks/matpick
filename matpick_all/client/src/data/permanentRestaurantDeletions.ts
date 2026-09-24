import deletions from './restaurant-permanent-deletions.json';
import { buildRestaurantLookupKeys } from './restaurantIdentity';
import type { MatpickDataSet } from './types';

// Apply after all imports so a later feed cannot restore an owner-deleted listing.
export function removePermanentlyDeletedRestaurants(dataset: MatpickDataSet): MatpickDataSet {
  const deletedIds = new Set(deletions.restaurants.map(row => row.id));
  const deletedKeys = new Set(deletions.restaurants.flatMap(row => buildRestaurantLookupKeys({ ...row, region: '' })));
  // Market-wide entries must stay removed even if a later feed supplies an address.
  // Exact names only: individual restaurants inside those markets remain eligible.
  const deletedMarketNames = new Set(deletions.restaurants
    .filter(row => row.reason === 'owner_requested_market_removal')
    .flatMap(row => [row.name, row.name.split(' ').slice(1).join(' ')])
    .map(name => name.replace(/\s+/g, '')));
  const aliases = dataset.restaurantAliases ?? {};
  for (const [alias, target] of Object.entries(aliases)) {
    if (deletedIds.has(alias)) deletedIds.add(target);
  }
  for (const restaurant of dataset.restaurants) {
    if (deletedMarketNames.has(restaurant.name.replace(/\s+/g, '')) ||
        buildRestaurantLookupKeys(restaurant).some(key => deletedKeys.has(key))) deletedIds.add(restaurant.id);
  }
  const restaurants = dataset.restaurants.filter(row => !deletedIds.has(row.id));
  const presentIds = new Set(restaurants.map(row => row.id));
  return {
    ...dataset,
    restaurants,
    visits: dataset.visits.filter(row => presentIds.has(row.restaurantId)),
    sourceLinks: dataset.sourceLinks?.filter(row => presentIds.has(row.restaurantId)),
    restaurantAliases: Object.fromEntries(Object.entries(aliases).filter(([alias, target]) =>
      !deletedIds.has(alias) && presentIds.has(target))),
  };
}
