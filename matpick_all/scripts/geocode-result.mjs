import { sameGeocodeAddress, distance } from '../../scripts/coordinate-audit.mjs';

// A geocoder may return a nearby building when the requested number does not exist.
// Never accept the first result without checking the complete address.
export function selectExactGeocode(address, payload) {
  const matches = (payload?.addresses ?? []).filter(result =>
    [result.roadAddress, result.jibunAddress].some(value => sameGeocodeAddress(address, value))
  ).map(result => ({lat: Number(result.y), lng: Number(result.x), matchedAddress: result.roadAddress || result.jibunAddress}))
    .filter(result => result.lat > 32 && result.lat < 39.5 && result.lng > 124 && result.lng < 132.5);
  if (!matches.length || matches.some(result => distance(result, matches[0]) > 40)) return null;
  return matches[0];
}
