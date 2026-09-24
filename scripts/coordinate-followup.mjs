import fs from 'node:fs/promises';
import {auditDir,lookup,sleep,cleanAddress,chooseCoordinate,sameGeocodeAddress,distance} from './coordinate-audit.mjs';
import {normalizeName,nameKeys} from './topic-publication/identity.mjs';
const report=JSON.parse(await fs.readFile(auditDir+'/coordinate-audit.json','utf8'));
const cacheFile=auditDir+'/coordinate-followup-cache.ndjson',cache=new Map();
try{for(const l of(await fs.readFile(cacheFile,'utf8')).split('\n').filter(Boolean)){const r=JSON.parse(l);cache.set(r.query,r);}}catch(e){if(e.code!=='ENOENT')throw e;}
async function search(q){if(cache.has(q))return cache.get(q);const r=await lookup(q);cache.set(q,r);await fs.appendFile(cacheFile,JSON.stringify(r)+'\n');await sleep(400);return r;}
const rows=[];
for(const r of report.records.filter(r=>r.status==='address_not_matched')){
 const par=r.address.match(/\(([^)]+)\)/)?.[1]||'';
 const prefix=cleanAddress(r.address).match(/^(.+?(?:[시군] )?(?:[가-힣]+구 |[가-힣]+군 )?(?:[가-힣]+[읍면] )?)(?=[가-힣0-9]+(?:로|길|동))/)?.[1]||'';
 const normalizedName=r.name.replace(/\([^)]*\)/g,'').trim();
 const queries=[cleanAddress(r.address)+' '+normalizedName];
 if(par&&/\d/.test(par))queries.push(prefix+par);
 queries.push(r.address.split(' ').slice(0,2).join(' ')+' '+normalizedName.replace(/^(?:서울|부산|대구|광주|인천|홍천|완도|고성|충주|영덕|대전|성남|의왕|하남)\s+/,''));
 const found=[];
 for(const q of queries){const d=await search(q);found.push(d);}
 const names=nameKeys(normalizedName,r.address);
 const places=[...new Map(found.flatMap(d=>d.places).map(p=>[p.id,p])).values()].filter(p=>nameKeys(p.name,p.roadAddress).some(n=>names.includes(n)));
 let matched=places.filter(p=>sameGeocodeAddress(r.address,p.roadAddress)||sameGeocodeAddress(r.address,p.parcelAddress));
 let basis='same_name_and_address_place';
 if(!matched.length&&par&&/\d/.test(par)){matched=places.filter(p=>sameGeocodeAddress(prefix+par,p.parcelAddress));basis='same_name_and_original_parcel';}
 if(matched.length===1){const p=matched[0];rows.push({...r,status:'coordinate_resolved',basis,candidate:p,offsetMeters:Math.round(distance(r.before,p)),correctedAddress:basis==='same_name_and_original_parcel'?p.roadAddress:undefined});}
 else {const alt=par?found.flatMap(d=>d.addresses).filter(p=>sameGeocodeAddress(prefix+par,p.address)||sameGeocodeAddress(prefix+par,p.relatedAddress)):[];
  rows.push({...r,status:'needs_manual_review',alternateParcel:prefix+par,foundPlaces:places,alternateCoordinates:alt});}
}
await fs.writeFile(auditDir+'/coordinate-followup.json',JSON.stringify(rows,null,2));console.log(JSON.stringify({total:rows.length,resolved:rows.filter(r=>r.status==='coordinate_resolved').length,pending:rows.filter(r=>r.status!=='coordinate_resolved').map(r=>({name:r.name,address:r.address,parcel:r.alternateParcel,places:r.foundPlaces}))},null,2));
