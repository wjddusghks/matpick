import fs from 'node:fs/promises';
import {auditDir,cleanAddress,distance,sameGeocodeAddress} from './coordinate-audit.mjs';
const read=async f=>JSON.parse(await fs.readFile(f,'utf8'));
const audit=await read(auditDir+'/coordinate-audit.json');
const follow=await read(auditDir+'/coordinate-followup.json');
const manual=await read(auditDir+'/coordinate-manual-decisions.json');
const cache=(await fs.readFile(auditDir+'/geocode-cache.ndjson','utf8')).split('\n').filter(Boolean).map(JSON.parse);
const followCache=(await fs.readFile(auditDir+'/coordinate-followup-cache.ndjson','utf8')).split('\n').filter(Boolean).map(JSON.parse);
const overridesFile='matpick_all/client/src/data/restaurant-overrides.json';
const overrides=await read(overridesFile),decisions=new Map();
for(const r of audit.records.filter(r=>r.status==='coordinate_correction'))decisions.set(r.id,{...r,sourceUrl:cache.find(c=>c.query===r.query)?.url});
for(const r of follow.filter(r=>r.status==='coordinate_resolved'))decisions.set(r.id,r);
const pending=[];
for(const r of follow.filter(r=>r.status==='needs_manual_review')){
 const choices=r.alternateCoordinates||[];
 // Keep the original parcel as the reference. A new shop elsewhere needs separate relocation proof.
 const valid=choices.filter(p=>sameGeocodeAddress(r.alternateParcel,p.address)||sameGeocodeAddress(r.alternateParcel,p.relatedAddress));
 if(valid.length&&!valid.some(p=>distance(p,valid[0])>40)){
  const p=valid.find(p=>sameGeocodeAddress(r.alternateParcel,p.address))||valid[0];
  const newAddress=/\d/.test(p.relatedAddress||'')&&/로|길/.test(p.relatedAddress)?p.relatedAddress:p.address;
  decisions.set(r.id,{...r,status:'parcel_location_resolved',basis:'original_record_parcel_geocode',candidate:p,correctedAddress:newAddress,offsetMeters:Math.round(distance(r.before,p)),sourceUrl:followCache.find(c=>c.query===r.alternateParcel)?.url,note:'기존 지번 주소의 위치만 대조했습니다. 현재 영업·이전 여부 확인과는 별개입니다.'});
 }else pending.push(r);
}
for(const r of manual)decisions.set(r.id,r);
// A hotel's street-address centroid can be hundreds of metres from the restaurant.
// Prefer an exact named branch when the second pass has that stronger evidence.
try{for(const r of await read(auditDir+'/coordinate-place-check.json'))if(r.candidate)decisions.set(r.id,r);}catch(e){if(e.code!=='ENOENT')throw e;}
const originalSnapshot=auditDir+'/coordinate-overrides-before.json';
try{await fs.access(originalSnapshot);}catch{await fs.writeFile(originalSnapshot,JSON.stringify(Object.fromEntries([...decisions.keys()].map(id=>[id,overrides[id]||null])),null,2));}
const applied=[];
for(const r of decisions.values()){
 const p=r.candidate;if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lng))throw new Error('Invalid coordinate: '+r.id);
 const sources=[p.url,r.sourceUrl,r.additionalSource].filter(Boolean);
 if(!sources.length)throw new Error('Missing location evidence: '+r.id);
 const note=r.note||'등록 주소와 지도 위치를 대조해 정정했습니다. 현재 영업 여부를 확인한 표시는 아닙니다.';
 const prior=overrides[r.id]||{};
 const patch={...prior,lat:p.lat,lng:p.lng,...(r.correctedAddress?{address:r.correctedAddress}:{}),locationVerifiedAt:'2026-09-24',locationSourceUrls:sources,dataReviewNote:[prior.dataReviewNote,note].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' ')};
 if(p.id&&r.basis!=='exact_address_geocode'){patch.kakaoPlaceId=p.id;patch.placeUrl=p.url;}
 overrides[r.id]=patch;
 applied.push({id:r.id,name:r.name,before:{address:r.address,...r.before},after:{address:patch.address||r.address,lat:p.lat,lng:p.lng},offsetMeters:Math.round(distance(r.before,p)),basis:r.basis,sources,note});
}
await fs.writeFile(overridesFile,JSON.stringify(overrides,null,2)+'\n');
const remaining=pending.filter(r=>!decisions.has(r.id));
const changed=applied.filter(r=>distance(r.before,r.after)>=1||r.before.address!==r.after.address);
const confirmedWithoutChange=applied.filter(r=>!changed.includes(r));
await fs.writeFile(auditDir+'/coordinate-applied.json',JSON.stringify({audited:audit.total,consistentWithin100m:audit.counts.coordinate_consistent,changed:changed.length,coordinateChangesOver100m:changed.filter(r=>r.offsetMeters>100).length,addressChanges:changed.filter(r=>r.before.address!==r.after.address).length,pending:remaining,confirmedWithoutChange,applied:changed},null,2));
console.log({audited:audit.total,changed:changed.length,coordinateChangesOver100m:changed.filter(r=>r.offsetMeters>100).length,addressChanges:changed.filter(r=>r.before.address!==r.after.address).length,pending:remaining.map(r=>r.name)});
