import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createLocalSuggestionStore } from '../scripts/local-suggestions.mjs';

test('legacy submission can be edited, published, drafted without leaking changes, republished and withdrawn', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'matpick-editor-'));
  try {
    const store = createLocalSuggestionStore(path.join(dir, 'inbox.json'));
    const id = '22222222-2222-4222-8222-222222222222';
    await store.saveSuggestion(store.validateSuggestion({requestId:id,name:'테스트전용편집국밥',location:'부산 해운대구 테스트로 9876',menus:[{name:'국밥',price:'10000'}],consent:true}));
    await assert.rejects(store.updateSuggestion(id,'approved'), /좌표/);
    await store.updateSuggestion(id,'pending','admin',{lat:35.16,lng:129.16,locationVerified:true},false);
    assert.equal((await store.listPublishedSuggestions()).length,0);
    await store.updateSuggestion(id,'approved');
    assert.equal((await store.listPublishedSuggestions())[0].restaurant.menus[0].price,'10000');
    await store.updateSuggestion(id,'approved','admin',{menus:[{name:'국밥',price:12000,unit:'1인분'}],lat:null,lng:null,locationVerified:false},false);
    assert.equal((await store.listSuggestions()).items[0].lat,null);
    assert.equal((await store.listPublishedSuggestions())[0].restaurant.menus[0].price,'10000');
    await assert.rejects(store.updateSuggestion(id,'approved'), /좌표/);
    await store.updateSuggestion(id,'approved','admin',{lat:35.17,lng:129.17,locationVerified:true});
    const current = (await store.listPublishedSuggestions())[0].restaurant;
    assert.equal(current.menus[0].price,'12000');
    assert.equal(current.lat,35.17);
    await store.updateSuggestion(id,'pending');
    assert.equal((await store.listPublishedSuggestions()).length,0);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
