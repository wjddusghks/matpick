import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { identityMatch } from '../../scripts/menu-research/matching.mjs';
const require=createRequire(import.meta.url);
const dataset=require('../client/src/data/generated/public-dataset.json');
const baseline=require('../../source-data/existing-data-quality-2026-09-21/baseline.json');
const patches=require('../client/src/data/generated/existing-data-enrichment.generated.json');
const results=require('../../source-data/existing-data-quality-2026-09-21/results.json');
test('existing restaurant enrichment requires the same named branch and address',()=>{
  for(const [id,patch] of Object.entries(patches)){
    const original=baseline.restaurants.find(r=>r.id===id);
    assert.ok(original);assert.ok(identityMatch(original,results.restaurants[id].place).accepted,id);
    assert.ok(dataset.restaurants.some(r=>r.id===id));
    if(patch.menus)assert.ok(patch.menuPriceSources.length&&patch.menuPriceVerifiedAt);
    if(patch.phone)assert.ok(!original.phone);
  }
});
test('domestic restaurant coordinates cannot silently point to an overseas namesake',()=>{
  for(const r of dataset.restaurants.filter(r=>!r.isOverseas)){
    assert.ok(r.lat>=33&&r.lat<=39&&r.lng>=124&&r.lng<=132,`${r.id}: ${r.lat},${r.lng}`);
  }
  const r=dataset.restaurants.find(r=>r.id==='topic_enrichment_michelin-1-star_717da4a81695');
  assert.equal(r.region,'서울 강남구');assert.equal(r.kakaoPlaceId,'548205674');assert.ok(r.locationSourceUrls.length>=2);
});
