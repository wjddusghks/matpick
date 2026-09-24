import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sameAddress, normalizeName, addressParts} from './topic-publication/identity.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const auditDir=path.join(root,'source-data/expansion-coordinate-2026-09-24');
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export function cleanAddress(value) {
  let s=String(value||'').replace(/\([^)]*\)/g,' ').replace(/,/g,' ');
  for(const [a,b] of [['Seoul','서울'],['Busan','부산'],['Jeju','제주']]) if(new RegExp(a,'i').test(s)) s=b+' '+s.replace(new RegExp(a,'ig'),' ');
  s=s.replace(/\b(?:한국|Korea)\b/gi,' ').replace(/\b\d{5}\b/g,' ').replace(/([가-힣])\s+(\d+(?:번(?:가|나|다)?|가|나|다)?(?:길|로))/g,'$1$2').replace(/\s+/g,' ').trim().replace(/^서울 서울 /,'서울 ');
  const road=s.match(/^(.+?(?:대로|로|길)\s*\d+(?:-\d+)?)(?=\s|$)/);
  if(road)return road[1];
  const lot=s.match(/^(.+?(?:동\d*가|로\d+가|동|리)\s*(?:산\s*)?\d+(?:-\d+)?)(?=\s|$)/);
  return lot?.[1]||s;
}
// Only known administrative aliases are tolerated; street and building number remain exact.
export function sameGeocodeAddress(left,right) {
  let a=cleanAddress(left),b=cleanAddress(right);
  if(sameAddress(a,b))return true;
  const ap=addressParts(a),bp=addressParts(b);
  if(ap.province==='세종'&&bp.province==='세종')return ap.roads.some(r=>bp.roads.includes(r))||ap.parcels.some(r=>bp.parcels.includes(r));
  if(/^광주(?:광역시)?\s/.test(a)&&/^전남광주통합특별시\s/.test(b))b=b.replace(/^전남광주통합특별시/,'광주');
  if(/^인천(?:광역시)? (?:중구|동구) /.test(a)&&/^인천 (?:제물포구|영종구) /.test(b))b=b.replace(/^인천 (?:제물포구|영종구)/,a.match(/^인천(?:광역시)? (?:중구|동구)/)[0]);
  return sameAddress(a,b);
}
export function distance(a,b) {const rad=x=>x*Math.PI/180;const p=rad(b.lat-a.lat),q=rad(b.lng-a.lng);return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(p/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(q/2)**2)));}
export function chooseCoordinate(r,result) {
  const target=cleanAddress(r.address);
  const valid=p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&p.lat>32&&p.lat<39.5&&p.lng>124&&p.lng<132.5;
  const match=a=>sameGeocodeAddress(target,a);
  const names=[r.name,r.name.replace(/^(?:서울|부산|대구|인천|경기|제주|수원|강릉)\s+/,'')].map(normalizeName);
  const places=(result.places||[]).filter(p=>valid(p)&&names.includes(normalizeName(p.name))&&(match(p.roadAddress)||match(p.parcelAddress)));
  const addresses=(result.addresses||[]).filter(p=>valid(p)&&match(p.address));
  const options=places.length?places:addresses;
  if(!options.length)return {status:result.error?'lookup_error':'address_not_matched'};
  if(options.some(p=>distance(p,options[0])>40))return {status:'ambiguous_address',options};
  const candidate=options[0];
  const offset=valid(r)?distance(r,candidate):null;
  return {status:offset===null||offset>100?'coordinate_correction':'coordinate_consistent',basis:places.length?'same_name_and_address_place':'exact_address_geocode',offsetMeters:offset===null?null:Math.round(offset),candidate};
}
export async function lookup(query) {
 const u=new URL('https://search.map.kakao.com/mapsearch/map.daum');u.searchParams.set('q',query);u.searchParams.set('msFlag','A');u.searchParams.set('sort','0');
 const res=await fetch(u,{headers:{Referer:'https://map.kakao.com/','User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(20000)});
 if(!res.ok)throw Object.assign(new Error('HTTP '+res.status),{status:res.status});
 const d=await res.json();return {checkedAt:new Date().toISOString(),query,url:u.href,addresses:(d.address||[]).map(p=>({address:p.addr,lat:Number(p.lat),lng:Number(p.lon),relatedAddress:p.related_prefix_address+' '+String(p.related_address||'').split('^')[0]})),places:(d.place||[]).map(p=>({id:String(p.confirmid),name:p.name,roadAddress:p.new_address||'',parcelAddress:p.address||'',lat:Number(p.lat),lng:Number(p.lon),category:p.cate_name_depth1,categoryDetail:p.last_cate_name,open:p.openoff_status,url:'https://place.map.kakao.com/'+p.confirmid}))};
}
async function main(){
 await fs.mkdir(auditDir,{recursive:true});
 const d=JSON.parse(await fs.readFile(path.join(root,'matpick_all/client/src/data/generated/public-dataset.json'),'utf8'));
 const rows=d.restaurants;const queries=[...new Set(rows.filter(r=>!r.isOverseas).map(r=>cleanAddress(r.address)).filter(Boolean))];
 const limit=Number(process.argv.find(x=>x.startsWith('--limit='))?.split('=')[1]||queries.length);
 const cache=new Map();try{for(const line of (await fs.readFile(path.join(auditDir,'geocode-cache.ndjson'),'utf8')).split('\n').filter(Boolean)){const v=JSON.parse(line);cache.set(v.query,v);}}catch(e){if(e.code!=='ENOENT')throw e;}
 let next=0,done=0,blocked=false;const todo=queries.filter(q=>!cache.has(q)).slice(0,limit);
 async function worker(){while(next<todo.length&&!blocked){const query=todo[next++];let v;try{v=await lookup(query);}catch(e){v={query,error:e.message,checkedAt:new Date().toISOString()};if([403,429].includes(e.status))blocked=true;}
 cache.set(query,v);await fs.appendFile(path.join(auditDir,'geocode-cache.ndjson'),JSON.stringify(v)+'\n');done++;if(done%100===0)console.log(JSON.stringify({queried:done,total:todo.length}));await sleep(400);}}
 await Promise.all(Array.from({length:4},worker));
 const records=rows.map(r=>({id:r.id,name:r.name,address:r.address,query:cleanAddress(r.address),before:{lat:r.lat,lng:r.lng},...(r.isOverseas?{status:'overseas_out_of_scope'}:cache.has(cleanAddress(r.address))?chooseCoordinate(r,cache.get(cleanAddress(r.address))):{status:'not_queried'})}));
 const counts=Object.fromEntries([...new Set(records.map(r=>r.status))].map(s=>[s,records.filter(r=>r.status===s).length]));
 const report={asOf:'2026-09-24',total:rows.length,uniqueQueries:queries.length,counts,complete:!records.some(r=>r.status==='not_queried'||r.status==='lookup_error'),records};
 await fs.writeFile(path.join(auditDir,'coordinate-audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,records:undefined}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
