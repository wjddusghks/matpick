import fs from 'node:fs/promises';
import {auditDir,cleanAddress,sameGeocodeAddress,distance} from './coordinate-audit.mjs';
import {seedNames,isDeleted,matchesPlace,key} from './verify-requested-topics.mjs';
import {nameKeys} from './topic-publication/identity.mjs';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const publicFile='matpick_all/client/src/data/generated/public-dataset.json';
const current=await read(publicFile);
const baselineFile=auditDir+'/publication-baseline.json';
let baseline;try{baseline=await read(baselineFile);}catch{baseline={restaurantIds:current.restaurants.map(r=>r.id),topicCounts:Object.fromEntries(['the-dudley','culinary-class-wars-chefs'].map(s=>[s,new Set(current.sourceLinks.filter(l=>l.sourceId===s).map(l=>l.restaurantId)).size]))};await fs.writeFile(baselineFile,JSON.stringify(baseline,null,2));}
const baselineIds=new Set(baseline.restaurantIds);
const existingCatalog=current.restaurants.filter(r=>baselineIds.has(r.id));
const hidden=(await read('matpick_all/client/src/data/generated/culinary-class-wars.generated.json')).restaurants;
const deletions=(await read('matpick_all/client/src/data/restaurant-permanent-deletions.json')).restaurants;
const reviews=await read(auditDir+'/seed-reviews.json');
const verification=await read(auditDir+'/topic-verification.json');
const overrides=await read('matpick_all/client/src/data/restaurant-overrides.json');
const output={restaurants:[],sourceLinks:[],patches:{}};
const decisions=[];const byPlace=new Map(),byTopic=new Map();
const price=s=>/^\d[\d,]*$/.test(s)?Number(s.replace(/,/g,'')).toLocaleString('ko-KR')+'원':s;
for(const raw of verification.records){
 const r={...raw,...reviews.byName[raw.name]};r.aliases=[...(raw.aliases||[]),...(reviews.byName[raw.name]?.aliases||[])];
 if(!['verified_with_menu','verified_without_price'].includes(raw.status)||r.holdReason){decisions.push({key:r.key,name:r.name,status:r.holdReason?'source_conflict_hold':r.status,sourceId:r.sourceId});continue;}
 const p=r.place;
 if(!matchesPlace(r,{...p,roadAddress:p.address,parcelAddress:r.place.parcelAddress?cleanAddress(r.address).split(' ').slice(0,2).join(' ')+' '+p.parcelAddress:''})&&!r.approximateAddress){
  // Search-stage road address evidence is retained in the verified record. Never let later edits change the identity.
  if(!sameGeocodeAddress(r.address,p.address)){decisions.push({key:r.key,name:r.name,status:'build_identity_hold',sourceId:r.sourceId});continue;}
 }
 if(isDeleted(r,deletions)||isDeleted({...r,name:p.name,address:p.address},deletions)){decisions.push({key:r.key,name:r.name,status:'permanently_deleted',sourceId:r.sourceId});continue;}
 const variants={...r,aliases:[...r.aliases,p.name]};
 const candidates=existingCatalog.filter(e=>
   (e.kakaoPlaceId===p.id||seedNames(variants).some(n=>nameKeys(e.name,cleanAddress(e.address)).includes(n)))&&
   (sameGeocodeAddress(p.address,e.address)||sameGeocodeAddress(r.address,e.address)));
 if(candidates.length>1){decisions.push({key:r.key,name:r.name,status:'existing_duplicate_review',sourceId:r.sourceId,existingIds:candidates.map(c=>c.id)});continue;}
 let existing=candidates[0];
 if(existing&&(existing.operationState==='closed'||existing.operationState==='moved'||existing.recommendationHold)){decisions.push({key:r.key,name:r.name,status:'existing_operation_hold',sourceId:r.sourceId});continue;}
 const menus=(r.verifiedMenus?.length?r.verifiedMenus:p.menus).map(m=>({...m,price:price(m.price)}));
 const hasPrice=menus.some(m=>/\d/.test(m.price||''));
 if(!hasPrice&&!existing){decisions.push({key:r.key,name:r.name,status:'menu_price_pending',sourceId:r.sourceId});continue;}
 let id=existing?.id||byPlace.get(p.id);
 if(!id){
  const old=hidden.filter(e=>e.kakaoPlaceId===p.id&&sameGeocodeAddress(e.address,p.address));
  id=old.length===1?old[0].id:'requested_topic_'+key(p.id);
  const restaurant={id,name:p.name,region:cleanAddress(p.address).split(' ').slice(0,2).join(' '),address:p.address,lat:p.lat,lng:p.lng,category:p.categoryDetail||'음식점',representativeMenu:menus.filter(m=>!/콜키지|와인|주류|주차/.test(m.name)).slice(0,3).map(m=>m.name).join(' · ')||menus[0]?.name||p.categoryDetail,imageUrl:'',menus,kakaoPlaceId:p.id,placeUrl:p.url,...(p.phone?{phone:p.phone}:{}),locationVerifiedAt:'2026-09-24',locationSourceUrls:[p.url],menuPriceVerifiedAt:'2026-09-24',menuPriceStatus:'public-menu-checked',menuPriceSources:[{label:r.verifiedMenuSource?'예약·메뉴 안내':'카카오맵 공개 메뉴',url:r.verifiedMenuSource||p.url}],menuPriceNote:r.menuNote||'조회 당시 공개된 메뉴입니다. 방문 시 구성과 가격이 달라질 수 있습니다.',dataReviewNote:'소개 이력과 현재 지도 상호·주소를 대조했습니다. 현재 영업은 지도 등록 상태 기준이며 전화 확인은 하지 않았습니다.'};
  output.restaurants.push(restaurant);output.patches[id]=restaurant;byPlace.set(p.id,id);
 }
 // Fresh booking-page observations may correct a specific older price on an existing record.
 if(existing&&r.verifiedMenus?.length&&r.verifiedMenuSource){output.patches[id]={menus,menuPriceVerifiedAt:'2026-09-24',menuPriceSources:[{label:'예약·메뉴 안내',url:r.verifiedMenuSource}],menuPriceStatus:'public-menu-checked',menuPriceNote:r.menuNote||'조회 당시 공개 가격. 방문 전 확인해 주세요.'};}
 const topicKey=r.sourceId+'|'+id;
 if(!byTopic.has(topicKey)){
  const sourceUrl=r.sourceUrl;
  const label=r.sourceId==='the-dudley'?'더들리 소개 식당':`시즌 ${r.season} · ${r.chef||r.contestant}`;
  output.sourceLinks.push({id:'requested_source_'+key(topicKey),restaurantId:id,sourceId:r.sourceId,label,sourceUrl,note:r.sourceId==='the-dudley'?'소개 당시 후기이며 메뉴·가격은 별도로 대조했습니다.':`출연 셰프의 식당 소개 이력. 현재 재직 여부는 방문 전 확인해 주세요.`});byTopic.set(topicKey,id);
 }
 decisions.push({key:r.key,name:r.name,status:'published',sourceId:r.sourceId,restaurantId:id,newRestaurant:!baseline.restaurantIds.includes(id),placeId:p.id,menuItems:menus.length,sourceUrl:r.sourceUrl,placeUrl:p.url});
}
await fs.writeFile('matpick_all/client/src/data/generated/requested-topic-expansion.generated.json',JSON.stringify(output,null,2)+'\n');
const report={asOf:'2026-09-24',baseline,addedRestaurantRows:output.restaurants.length,topicLinks:Object.fromEntries(['the-dudley','culinary-class-wars-chefs'].map(s=>[s,output.sourceLinks.filter(l=>l.sourceId===s).length])),menuItems:output.restaurants.reduce((n,r)=>n+r.menus.length,0),decisions};
await fs.writeFile(auditDir+'/publication.json',JSON.stringify(report,null,2));console.log({...report,baseline:undefined,decisions:undefined});
