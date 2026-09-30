import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createLocalSuggestionStore} from '../scripts/local-suggestions.mjs';
const require=createRequire(import.meta.url);
const {queryCatalog}=require('../../api/restaurants/_catalog.js');
const {searchRestaurants}=require('../../api/restaurants/_search.js');
const {buildPublication,validateSuggestion}=require('../../api/restaurants/_suggestionStore.js');
const restaurant={id:'test',name:'맛픽테스트국밥',address:'부산 해운대구 테스트로 123',region:'부산',category:'한식',lat:35.16,lng:129.16,menus:[{name:'돼지국밥',price:'10000'}]};
test('English phrases, romanization, initials and Korean find the same place',()=>{
  for(const q of ['Busan pork soup','Pusan dwaeji gukbap','부산 돼지국밥','ㅁㅍㅌㅅㅌ','matpik']) assert.equal(searchRestaurants(q,[restaurant],()=>[])[0]?.restaurant.id,'test',q);
  assert.equal(searchRestaurants('Seoul pork soup',[restaurant],()=>[]).length,0);
  for(const q of ['tteokbokki','topokki','spicy rice cakes']) assert.equal(searchRestaurants(q,[{...restaurant,menus:[{name:'떡볶이'}]}],()=>[]).length,1,q);
});
test('live catalog search returns bounded related suggestions and no runtime exception',()=>{
  const result=queryCatalog({type:'search',q:'Busan pork soup'});
  assert.equal(result.status,200);
  assert.ok(result.body.totalCount>0);
  assert.ok(result.body.suggestions.length<=24);
});
test('approval publishes, rejection revokes, private submission fields never leak',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'matpick-community-'));
  try {
    const store=createLocalSuggestionStore(path.join(dir,'inbox.json'));
    const input=validateSuggestion({requestId:'11111111-1111-4111-8111-111111111111',name:'테스트전용추천국밥',location:'부산 해운대구 테스트로 9876',lat:35.16,lng:129.16,menus:[{name:'국밥',price:'10000'}],consent:true,reason:'PRIVATE_REASON'});
    await store.saveSuggestion(input);
    assert.equal((await store.listPublishedSuggestions()).length,0);
    await store.updateSuggestion(input.requestId,'approved','local-admin',{...input,locationVerified:true});
    const pubs=await store.listPublishedSuggestions();
    const result=queryCatalog({type:'source',value:'community-picks'},[],pubs);
    assert.equal(result.body.totalCount,1);
    assert.equal(result.body.restaurants[0].menus[0].price,'10000');
    assert.ok(!JSON.stringify(result).includes('PRIVATE_REASON'));
    assert.equal(queryCatalog({view:'detail',id:pubs[0].restaurant.id},[],pubs).status,200);
    assert.equal(queryCatalog({type:'nearby',lat:35.16,lng:129.16},[],pubs).body.restaurants[0].id,pubs[0].restaurant.id);
    await store.updateSuggestion(input.requestId,'rejected');
    assert.equal((await store.listPublishedSuggestions()).length,0);
    assert.equal(queryCatalog({view:'detail',id:pubs[0].restaurant.id}).status,404);
    assert.throws(()=>buildPublication({...input,lat:null,lng:null,locationVerified:true}),/좌표/);
  } finally {await rm(dir,{recursive:true,force:true});}
});
