import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {auditDir,lookup,sleep,cleanAddress,sameGeocodeAddress,distance} from './coordinate-audit.mjs';
import {normalizeName,nameKeys,unitsConflict,addressParts} from './topic-publication/identity.mjs';
export const key=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,16);
export function seedNames(s){return [...new Set([s.name,...(s.aliases||[])].flatMap(n=>[...nameKeys(n,s.address),normalizeName(n.replace(/\([^)]*\)/g,''))]))].filter(Boolean);}
export function matchesPlace(s,p){
 const nameMatches=seedNames(s).some(n=>nameKeys(p.name,p.roadAddress||p.address).includes(n));
 const a=addressParts(s.address),b=addressParts(p.roadAddress||p.address||p.parcelAddress);
 const legacyPinMatches=s.approximateAddress&&a.province===b.province&&a.areas.some(v=>b.areas.includes(v))&&Number.isFinite(s.lat)&&Number.isFinite(s.lng)&&distance(s,p)<50;
 return nameMatches&&(legacyPinMatches||[p.roadAddress||p.address,p.parcelAddress].some(a=>sameGeocodeAddress(s.address,a)))&&!unitsConflict(a,addressParts(p.parcelAddress||p.address));
}
export function isDeleted(s,deletions){return deletions.some(d=>d.id===s.legacyId||(seedNames(s).some(n=>nameKeys(d.name,d.address).includes(n))&&(sameGeocodeAddress(s.address,d.address)||d.reason==='owner_requested_market_removal')));}
async function loadLines(file){try{return (await fs.readFile(file,'utf8')).split('\n').filter(Boolean).map(JSON.parse);}catch(e){if(e.code!=='ENOENT')throw e;return [];}}
export async function getPlace(id){const res=await fetch('https://place-api.map.kakao.com/places/panel3/'+id,{headers:{Accept:'application/json',appVersion:'6.6.0',pf:'PC',Origin:'https://place.map.kakao.com',Referer:'https://place.map.kakao.com/'+id,'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(20000)});if(!res.ok)throw Object.assign(new Error('HTTP '+res.status),{status:res.status});const d=await res.json(),s=d.summary||{},m=d.menu?.menus||{};return {id,checkedAt:new Date().toISOString(),name:s.name,address:s.address?.road||s.address?.disp,parcelAddress:s.address?.jibun,status:s.status,lat:Number(s.point?.lat),lng:Number(s.point?.lon),category:s.category?.name1,categoryDetail:s.category?.name,phone:s.phone_numbers?.[0]?.tel,homepages:s.homepages||[],listingUpdatedAt:s.meta?.updated_at,menuUpdatedAt:m.items_updated_at,menus:(m.items||[]).map((m,i)=>({id:'menu_'+i,name:m.name,price:String(m.price||''),isSignature:!!m.is_recommend})).filter(m=>m.name),url:'https://place.map.kakao.com/'+id};}
async function main(){
const chef=JSON.parse(await fs.readFile(auditDir+'/chef-seeds.json','utf8')).seeds;
const reviews=JSON.parse(await fs.readFile(auditDir+'/seed-reviews.json','utf8'));
const blog=[...new Map((await loadLines(auditDir+'/dudley-posts.ndjson')).map(p=>[p.logNo,p])).values()];
const seeds=new Map();
for(const p of blog)for(const place of p.places||[]){const k='the-dudley|'+normalizeName(place.name)+'|'+cleanAddress(place.address);let s=seeds.get(k);if(!s){s={...place,sourceId:'the-dudley',sourceUrl:p.url,sourceDate:p.publishedAt,evidenceType:'author_blog_attached_map',posts:[]};seeds.set(k,s);}s.posts.push({url:p.url,title:p.title,publishedAt:p.publishedAt});}
for(const s of [...chef,...reviews.extraSeeds])seeds.set(s.sourceId+'|'+s.name+'|'+s.address,s);
for(const s of seeds.values()){
 const review=reviews.byName[s.name];if(review){s.aliases=[...(s.aliases||[]),...(review.aliases||[])];Object.assign(s,Object.fromEntries(Object.entries(review).filter(([k])=>k!=='aliases')));}
}
const deletions=JSON.parse(await fs.readFile('matpick_all/client/src/data/restaurant-permanent-deletions.json','utf8')).restaurants;
const cacheFile=auditDir+'/topic-search.ndjson',searches=new Map((await loadLines(cacheFile)).map(p=>[p.query,p]));
const panelFile=auditDir+'/topic-panels.ndjson',panels=new Map((await loadLines(panelFile)).map(p=>[p.id,p]));
async function search(q){if(searches.has(q))return searches.get(q);const r=await lookup(q);searches.set(q,r);await fs.appendFile(cacheFile,JSON.stringify(r)+'\n');await sleep(300);return r;}
async function panel(id){if(panels.has(id))return panels.get(id);const r=await getPlace(id);panels.set(id,r);await fs.appendFile(panelFile,JSON.stringify(r)+'\n');await sleep(300);return r;}
const rows=[...seeds.values()].map(s=>({...s,key:key(s.sourceId+'|'+s.name+'|'+s.address)}));
await fs.writeFile(auditDir+'/topic-seeds.json',JSON.stringify(rows,null,2));
const resultFile=auditDir+'/topic-verification.ndjson',results=new Map((await loadLines(resultFile)).map(r=>[r.key,r]));
const todo=rows.filter(r=>!results.has(r.key)||process.argv.includes('--refresh'));
let next=0,done=0,blocked=false;
async function worker(){while(next<todo.length&&!blocked){const s=todo[next++];let result={...s};try{
 if(s.holdReason)result.status='source_conflict_hold';
 else if(!s.address)result.status='address_missing';
 else if(!/서울|부산|대구|인천|광주|대전|울산|경기|강원|충[남북청]|전[남북라]|경[남북상]|제주|세종/.test(s.address))result.status='overseas';
 else if(isDeleted(s,deletions))result.status='permanently_deleted';
 else {
 const query=cleanAddress(s.address)+' '+s.name;
 let options=(await search(query)).places;
 if(s.aliases?.length&&!options.some(p=>matchesPlace(s,p)))for(const alias of s.aliases.slice(0,2))options.push(...(await search(cleanAddress(s.address)+' '+alias)).places);
 options=[...new Map(options.map(p=>[p.id,p])).values()];
 let matched=options.filter(p=>matchesPlace(s,p));
 if(!matched.length){const more=(await search(s.address.split(' ').slice(0,2).join(' ')+' '+s.name)).places;options=[...new Map([...options,...more].map(p=>[p.id,p])).values()];matched=options.filter(p=>matchesPlace(s,p));}
 if(matched.length===1){const p=await panel(matched[0].id);result.place=p;
  const addressMatches=matchesPlace(s,{...matched[0],name:p.name,roadAddress:p.address})&&distance(matched[0],p)<100;
  result.status= !addressMatches?'panel_identity_conflict':p.status!=='Y'?'not_active_listing':p.category!=='음식점'?'not_restaurant':s.evidenceType==='supplied_guide_needs_affiliation_check'?'affiliation_review':p.menus.some(m=>/\d/.test(m.price))||s.verifiedMenus?.length?'verified_with_menu':'verified_without_price';
 }else{result.status=matched.length>1?'ambiguous_place':'no_exact_place';result.candidates=options.slice(0,6);}
 }
 }catch(e){result.status='lookup_error';result.error=e.message;if([403,429].includes(e.status))blocked=true;}
 results.set(s.key,result);await fs.appendFile(resultFile,JSON.stringify(result)+'\n');done++;if(done%50===0)console.log(JSON.stringify({verified:done,total:todo.length}));await sleep(300);
}}
await Promise.all(Array.from({length:3},worker));
const records=rows.map(s=>results.get(s.key)||{...s,status:'not_checked'});const counts=Object.fromEntries([...new Set(records.map(r=>r.status))].map(s=>[s,records.filter(r=>r.status===s).length]));await fs.writeFile(auditDir+'/topic-verification.json',JSON.stringify({total:rows.length,counts,records},null,2));console.log({total:rows.length,counts});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1;});
