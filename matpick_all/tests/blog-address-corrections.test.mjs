import test from 'node:test';
import assert from 'node:assert/strict';
import {loadAppModules} from '../scripts/load-public-data.mjs';
const [data, eligibility] = await loadAppModules(['/src/data/index.ts','/src/lib/restaurantEligibility.ts']);
test('relocated restaurants use their new address and new point together', () => {
  for (const [id,address,lat,lng] of [
    ['sikgaek-baekban-trip_restaurant_669','시장북2길 5-2',37.1735259,128.9920899],
    ['sikgaek-baekban-trip_restaurant_181','무술목길 142-1',34.6952026,127.7773875],
  ]) {
    const r=data.getRestaurantById(id);
    assert.ok(r.address.includes(address));
    assert.ok(Math.abs(r.lat-lat)<0.00001 && Math.abs(r.lng-lng)<0.00001);
    assert.ok(r.locationSourceUrls.length>1);
  }
});
test('duplicated relocated listings retain history but only one is recommended', () => {
  for (const [oldId,id] of [
    ['topic_enrichment_baekjong-wok_e18df91f2f72','sikgaek-baekban-trip_restaurant_093'],
    ['sikgaek-baekban-trip_restaurant_484','topic_enrichment_baekjong-wok_372971463e2d'],
  ]) {
    const old=data.getRestaurantById(oldId),current=data.getRestaurantById(id);
    assert.ok(old && current);
    assert.equal(old.replacementRestaurantId,id);
    assert.equal(eligibility.isRestaurantRecommendable(old),false);
    assert.equal(eligibility.isRestaurantRecommendable(current),true);
    assert.ok(data.sourceLinks.some(link=>link.restaurantId===oldId));
  }
});
test('historical closure evidence cannot turn old menu prices into current offers', () => {
  const r=data.restaurants.find(row => row.name === '서울 어바웃진스');
  assert.ok(r);
  assert.equal(r.operationState,'closed');
  assert.equal(eligibility.isRestaurantRecommendable(r),false);
  assert.notEqual(r.menuPriceStatus,'blog-price-snapshot');
  assert.ok(r.operationSourceUrl.startsWith('https://data.seoul.go.kr/'));
});
