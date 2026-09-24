import fs from 'node:fs/promises';
import {auditDir,lookup,sleep,cleanAddress,sameGeocodeAddress,distance} from './coordinate-audit.mjs';
import {nameKeys} from './topic-publication/identity.mjs';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const audit=await read(auditDir+'/coordinate-audit.json');
const applied=await read(auditDir+'/coordinate-applied.json');
const reviews=await read(auditDir+'/seed-reviews.json');
const cacheFile=auditDir+'/coordinate-place-cache.ndjson',cache=new Map();
for(const file of ['topic-search.ndjson','coordinate-followup-cache.ndjson','coordinate-place-cache.ndjson']){
 try{for(const line of(await fs.readFile(auditDir+'/'+file,'utf8')).split('\n').filter(Boolean)){const r=JSON.parse(line);cache.set(r.query,r);}}catch(e){if(e.code!=='ENOENT')throw e;}
}
async function search(query){if(cache.has(query))return cache.get(query);const r=await lookup(query);cache.set(query,r);await fs.appendFile(cacheFile,JSON.stringify(r)+'\n');await sleep(400);return r;}
const result=[];let done=0;
for(const correction of applied.applied){
 const r=audit.records.find(x=>x.id===correction.id);
 const aliases=[r.name,...(reviews.byName[r.name]?.aliases||[])];
 const names=aliases.flatMap(n=>nameKeys(n,cleanAddress(r.address)));
 const matches=p=>nameKeys(p.name,p.roadAddress).some(n=>names.includes(n))&&[r.address,correction.after.address].some(a=>sameGeocodeAddress(a,p.roadAddress)||sameGeocodeAddress(a,p.parcelAddress));
 let options=(await search(cleanAddress(correction.after.address)+' '+r.name)).places;
 if(!options.some(matches))options.push(...(await search(cleanAddress(correction.after.address).split(' ').slice(0,2).join(' ')+' '+r.name.replace(/^(?:서울|부산|대구|인천|경기|제주|수원|강릉)\s+/,''))).places);
 const exact=[...new Map(options.filter(matches).map(p=>[p.id,p])).values()];
 if(exact.length===1){const p=exact[0];result.push({...r,candidate:p,basis:'same_name_and_address_place',sourceUrl:p.url,correctedAddress:correction.after.address!==r.address?correction.after.address:undefined,offsetMeters:Math.round(distance(r.before,p)),addressCentroidOffsetMeters:Math.round(distance(correction.after,p)),note:'동일 상호·주소의 개별 점포 위치를 확인했습니다. 대형 부지의 주소 중심점보다 점포 위치를 우선합니다. 현재 영업 확인과는 별개입니다.'});}
 else result.push({id:r.id,name:r.name,status:exact.length?'ambiguous_place':'address_only_location',candidateIds:exact.map(p=>p.id)});
 if(++done%30===0)console.log({checked:done,total:applied.applied.length});
}
await fs.writeFile(auditDir+'/coordinate-place-check.json',JSON.stringify(result,null,2));
console.log({checked:result.length,matched:result.filter(r=>r.candidate).length,largeCentroidDifferences:result.filter(r=>r.addressCentroidOffsetMeters>100).map(r=>({name:r.name,meters:r.addressCentroidOffsetMeters,oldToPlace:r.offsetMeters}))});
