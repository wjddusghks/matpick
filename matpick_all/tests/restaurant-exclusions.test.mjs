import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {loadAppModules,projectRoot} from '../scripts/load-public-data.mjs';
const [data,eligibility]=await loadAppModules(['/src/data/index.ts','/src/lib/restaurantEligibility.ts']);
const read=p=>fs.readFile(path.resolve(projectRoot,p),'utf8').then(JSON.parse);
const excluded=await read('client/src/data/restaurant-exclusions.json');
const evidence=await read('../source-data/menu-price-followup-2026-09-21/excluded-119.json');
test('all requested 119 records are excluded from recommendation and topic lists without deleting history',()=>{
  assert.equal(excluded.restaurantIds.length,119);
  assert.deepEqual(new Set(excluded.restaurantIds),new Set(evidence.restaurants.map(r=>r.id)));
  const ids=new Set(excluded.restaurantIds);
  for(const id of ids){
    const r=data.getRestaurantById(id);
    assert.ok(r,`Historical record missing: ${id}`);
    assert.equal(eligibility.isRestaurantRecommendable(r),false,id);
    assert.ok(!data.searchRestaurants(r.name).some(x=>x.restaurant.id===id),id);
  }
  for(const source of data.sources){
    const visible=data.getRestaurantsBySource(source.id);
    assert.ok(visible.every(r=>!ids.has(r.id)),source.id);
    assert.equal(data.getSourceRestaurantCount(source.id),visible.length);
  }
});
test('menu and delivery records are not accidentally selected for exclusion',()=>{
  for(const r of evidence.restaurants)assert.ok(!['naver_priced','delivery_price_found'].includes(r.status));
  assert.equal(evidence.operationStatesChanged,false);
});
