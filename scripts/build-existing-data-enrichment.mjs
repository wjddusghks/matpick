import fs from 'node:fs/promises';
import { identityMatch } from './menu-research/matching.mjs';
const dir='source-data/existing-data-quality-2026-09-21';
const baseline=JSON.parse(await fs.readFile(dir+'/baseline.json','utf8'));
const results=JSON.parse(await fs.readFile(dir+'/results.json','utf8'));
const overrides=JSON.parse(await fs.readFile('matpick_all/client/src/data/restaurant-overrides.json','utf8'));
const patches={};const changes=[];const holds=[];
const norm=s=>String(s||'').replace(/\s/g,'').toLowerCase();
function distance(a,b){const rad=n=>n*Math.PI/180;return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lng-a.lng)/2)**2)));}
for (const r of baseline.restaurants) {
 const found=results.restaurants[r.id]; if(!found)continue;
 if(!['verified_priced','verified_menu_only','public_menu_unavailable'].includes(found.status)||!identityMatch(r,found.place).accepted){holds.push({id:r.id,name:r.name,address:r.address,status:found.status});continue;}
 const p=found.place;const patch={};const date=found.checkedAt.slice(0,10);
 const metres=distance(r,p);const coordinateValid=Number.isFinite(metres)&&p.lat>=33&&p.lat<=39&&p.lng>=124&&p.lng<=132;
 if(coordinateValid&&metres<=100){
   patch.locationVerifiedAt=date;patch.locationSourceUrls=[p.placeUrl];
   if(metres>=15){patch.lat=p.lat;patch.lng=p.lng;}
 }else holds.push({id:r.id,name:r.name,address:r.address,status:'coordinate_review',distanceMetres:Math.round(metres),original:{lat:r.lat,lng:r.lng},candidate:p});
 if(!r.phone?.trim()&&p.phone)patch.phone=p.phone;
 if(!r.kakaoPlaceId)patch.kakaoPlaceId=p.kakaoPlaceId;
 if(!r.placeUrl)patch.placeUrl=p.placeUrl;
 if(!r.category&&p.category)patch.category=p.category;
 if(found.menus.length&&(!r.menus?.some(m=>m.price?.trim())||found.status==='verified_priced')&&!overrides[r.id]?.menus){
  const menus=found.menus.map(m=>{const old=r.menus?.find(o=>norm(o.name)===norm(m.name));return {...m,id:old?.id||m.id,...(old?.isSignature?{isSignature:true}:{}),...(old?.description?{description:old.description}:{})};});
  patch.menus=menus;
  patch.menuPriceVerifiedAt=date;
  patch.menuPriceSources=[{label:'카카오지도 공개 메뉴 · 동일 지점 대조',url:p.placeUrl,...(found.sourceUpdatedAt?{publishedAt:found.sourceUpdatedAt.slice(0,10)}:{})}];
  patch.menuPriceStatus=found.status;
  patch.menuPriceNote='동일 상호·주소의 공개 메뉴를 확인한 날짜입니다. 현장 가격·영업 여부를 보증하지 않으며, 공개되지 않은 금액은 추정하지 않았습니다.';
 }
 // Explicit curator corrections retain priority over collected information.
 for(const key of Object.keys(overrides[r.id]||{})) delete patch[key];
 if(!Object.keys(patch).length)continue;
 patches[r.id]=patch;
 const fields=Object.keys(patch).filter(k=>JSON.stringify(patch[k])!==JSON.stringify(r[k]));
 const oldMenus=r.menus||[];const added=patch.menus?.filter(m=>!oldMenus.some(o=>norm(o.name)===norm(m.name))).length||0;
 const changedPrices=patch.menus?.filter(m=>{const old=oldMenus.find(o=>norm(o.name)===norm(m.name));return old&&norm(old.price)!==norm(m.price)}).map(m=>({name:m.name,before:oldMenus.find(o=>norm(o.name)===norm(m.name))?.price||'',after:m.price||''}))||[];
 changes.push({id:r.id,name:r.name,address:r.address,fields,menuCount:patch.menus?.length||0,addedMenuItems:added,changedPrices,source:p.placeUrl,checkedAt:found.checkedAt,distanceMetres:Math.round(metres)});
}
await fs.writeFile('matpick_all/client/src/data/generated/existing-data-enrichment.generated.json',JSON.stringify(patches,null,2)+'\n');
const summary={checked:Object.keys(results.restaurants).length,matched:Object.values(results.restaurants).filter(x=>['verified_priced','verified_menu_only','public_menu_unavailable'].includes(x.status)).length,enriched:changes.length,menuSnapshots:changes.filter(c=>c.fields.includes('menus')).length,menuItems:Object.values(patches).reduce((n,p)=>n+(p.menus?.length||0),0),addedMenuItems:changes.reduce((n,c)=>n+c.addedMenuItems,0),changedPrices:changes.reduce((n,c)=>n+c.changedPrices.length,0),phonesAdded:changes.filter(c=>c.fields.includes('phone')).length,coordinatesRefined:changes.filter(c=>c.fields.includes('lat')).length,locationsVerified:changes.filter(c=>c.fields.includes('locationVerifiedAt')).length,holds:holds.length};
await fs.writeFile(dir+'/enrichment-report.json',JSON.stringify({summary,changes,holds},null,2)+'\n');
console.log(summary);
