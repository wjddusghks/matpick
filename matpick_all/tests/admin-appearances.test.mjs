import test from 'node:test';
import assert from 'node:assert/strict';
import {loadAppModules} from '../scripts/load-public-data.mjs';
const [helpers]=await loadAppModules(['/src/lib/adminRestaurantAppearances.ts']);
const sources=[{id:'tv',name:'방송',type:'tv_show'},{id:'guide',name:'가이드',type:'guide'},{id:'creator',name:'채널',type:'creator'}];
test('admin episode labels preserve seasons and distinguish different shows',()=>{
  const result=helpers.getAdminAppearances([
    {sourceId:'tv',label:'시즌 4 EP.12',broadcastDate:'2026-09-18',sourceUrl:'https://example.com/episode'},
    {sourceId:'tv',label:'시즌 4 EP.12'},
    {sourceId:'tv',label:'시즌 3 EP.12'},
    {sourceId:'creator',label:'12회'},
  ],sources);
  assert.equal(result.length,3);
  assert.equal(new Set(result.map(r=>r.key)).size,3);
  assert.equal(result.find(r=>r.episode==='시즌 4 EP.12').date,'2026-09-18');
});
test('directory ordinals and guide editions are never invented as episodes',()=>{
  assert.deepEqual(helpers.getAdminAppearances([{sourceId:'tv',ordinal:53,label:'방송 소개'},{sourceId:'guide',ordinal:100,label:'100회 기념 선정'}],sources),[]);
  assert.equal(helpers.normalizeAdminRestaurantSearch('전현무계획 EP.12'),helpers.normalizeAdminRestaurantSearch('전현무계획 12회'));
});
