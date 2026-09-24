import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sameAddress} from '../../scripts/topic-publication/identity.mjs';
import {chooseCoordinate,cleanAddress,sameGeocodeAddress,distance} from '../../scripts/coordinate-audit.mjs';
import {matchesPlace,isDeleted} from '../../scripts/verify-requested-topics.mjs';
import {selectExactGeocode} from '../scripts/geocode-result.mjs';
const json=relative=>JSON.parse(readFileSync(new URL(relative,import.meta.url),'utf8'));
test('parcel suffixes and building numbers cannot become partial road matches',()=>{
 assert.equal(sameAddress('서울 중구 을지로6가 1-1','서울 중구 을지로6가 1-17'),false);
 assert.equal(sameAddress('서울 중구 을지로 6','서울 중구 을지로6가 1-1'),false);
 assert.equal(sameAddress('서울 중구 을지로 32-1','서울 중구 을지로 32-10'),false);
 assert.equal(sameAddress('서울 중구 을지로6가 1-1','서울특별시 중구 을지로6가 1-1'),true);
});
test('geocoder ignores a nearby first result and accepts only the requested building',()=>{
 const address='제주 제주시 탑동로 144';
 const neighbor={roadAddress:'제주특별자치도 제주시 탑동로 142',x:'126.51',y:'33.51'};
 assert.equal(selectExactGeocode(address,{addresses:[neighbor]}),null);
 const exact={roadAddress:address,x:'126.52',y:'33.52'};
 assert.deepEqual(selectExactGeocode(address,{addresses:[neighbor,exact]}),{lat:33.52,lng:126.52,matchedAddress:address});
 assert.equal(selectExactGeocode(address,{addresses:[exact,{...exact,y:'35.0'}]}),null);
});
test('geocoding tolerates printed spacing and recorded administrative aliases, not different districts',()=>{
 assert.equal(cleanAddress('해운대구 마린시티 3로 37, 2층, Busan, 48118, 한국'),'부산 해운대구 마린시티3로 37');
 assert.equal(sameGeocodeAddress('세종특별자치시 나성북로 30','세종 나성북로 30'),true);
 assert.equal(sameGeocodeAddress('인천 중구 도원로8번길 68','인천 제물포구 도원로8번길 68'),true);
 assert.equal(sameGeocodeAddress('서울 중구 중앙로 10','서울 강남구 중앙로 10'),false);
});
test('topic verification rejects namesakes, different units and deleted restaurants',()=>{
 const seed={name:'진미식당',address:'서울 중구 을지로 10 101호'};
 const p={name:'진미식당',roadAddress:'서울 중구 을지로 10',parcelAddress:'서울 중구 다동 1 102호'};
 assert.equal(matchesPlace(seed,p),false);
 assert.equal(matchesPlace({...seed,address:'서울 중구 을지로 11'},p),false);
 assert.equal(isDeleted({...seed,aliases:['진미 식당']},[{id:'removed',name:'진미 식당',address:'서울 중구 을지로 10'}]),true);
});
test('all applied coordinate decisions reach the public map without losing source evidence',()=>{
 const report=json('../../source-data/expansion-coordinate-2026-09-24/coordinate-applied.json');
 const data=json('../client/src/data/generated/public-dataset.json');
 assert.equal(report.audited,3476);
 for(const correction of report.applied){const current=data.restaurants.find(r=>r.id===correction.id);assert.ok(current,correction.id);assert.ok(distance(current,correction.after)<1,correction.name);assert.equal(current.address,correction.after.address);assert.ok(current.locationSourceUrls.length);}
});
test('new topic listings have an active matching place, sourced prices and no resurrected deletions',()=>{
 const batch=json('../client/src/data/generated/requested-topic-expansion.generated.json');
 const verification=json('../../source-data/expansion-coordinate-2026-09-24/topic-verification.json');
 const deletions=json('../client/src/data/restaurant-permanent-deletions.json').restaurants;
 const data=json('../client/src/data/generated/public-dataset.json');
 const baseline=json('../../source-data/expansion-coordinate-2026-09-24/publication-baseline.json');
 assert.deepEqual(new Set(data.restaurants.map(r=>r.id)),new Set([...baseline.restaurantIds,...batch.restaurants.map(r=>data.restaurantAliases[r.id]||r.id)]));
 for(const r of batch.restaurants){assert.ok(!isDeleted(r,deletions));assert.ok(r.menus.some(m=>/\d/.test(m.price||'')),r.name);assert.ok(r.menuPriceSources.length);assert.ok(verification.records.some(v=>v.place?.id===r.kakaoPlaceId&&v.place.status==='Y'&&v.place.category==='음식점'));const current=data.restaurants.find(p=>p.id===(data.restaurantAliases[r.id]||r.id));assert.ok(current,r.name);assert.ok(distance(r,current)<1,r.name);}
 for(const s of ['the-dudley','culinary-class-wars-chefs'])assert.ok(new Set(data.sourceLinks.filter(l=>l.sourceId===s).map(l=>l.restaurantId)).size>50);
});
