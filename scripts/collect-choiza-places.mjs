import fs from 'node:fs/promises';
import {lookup,sleep,cleanAddress,sameGeocodeAddress,distance} from './coordinate-audit.mjs';
import {getPlace,key,seedNames,isDeleted} from './verify-requested-topics.mjs';
import {nameKeys,normalizeName,addressParts} from './topic-publication/identity.mjs';
const dir='source-data/choiza-complete-2026-09-24';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const lines=async p=>{try{return (await fs.readFile(p,'utf8')).split('\n').filter(Boolean).map(JSON.parse)}catch(e){if(e.code==='ENOENT')return [];throw e}};
const videos=new Map((await read(dir+'/video-inventory.json')).map(v=>[v.id,v]));
const comments=new Map((await read(dir+'/creator-address-evidence.json')).map(v=>[v.videoId,v]));
const seeds=[];
function episode(v){const t=v?.title||'';const e=t.match(/EP\.?\s*(\d+)(?:-(\d+))?/i);return {season:Number(t.match(/최자로드\s*(\d)/)?.[1]||(/온더웨이|다시 쓰는|특별편/.test(t)?0:1)),episodeNumber:e?Number(e[1]):v?.explicitFinaleEpisode,episodePart:e?.[2],episodeSeries:/온더웨이/.test(t)?'온더웨이':/다시 쓰는/.test(t)?'다시 쓰는':/강원특별자치도 특별편/.test(t)?'강원 특별편':undefined};}
function add(s){const v=videos.get(s.videoId);seeds.push({...episode(v),...s,key:key(s.videoId+'|'+s.name+'|'+(s.address||s.region)),sourceUrl:v?.url||s.evidenceUrl,sourceDate:v?.publishedAt?.slice(0,10),videoTitle:v?.title});}
for(const b of await read(dir+'/blog-facts.json')){
 if(b.name==='금산제면소')continue; // Interview location; the episode does not establish a restaurant meal.
 add({name:b.name,address:b.address,videoId:b.videoIds[0],season:b.name==='넝쿨하눌가든'?2:b.season,episodeNumber:b.episode?Number(b.episode.split('-')[0]):undefined,episodePart:b.episode.split('-')[1],evidenceUrl:b.sourceUrl,evidenceType:'blog_episode_and_address'});
}
// Each row is an explicit venue from the official description. Region disambiguation is mandatory.
const pinned=`XICXrXTXneE|도쿄멘친테이혼포|서울 강남구
CjUlUkvdXkc|마마리마켓|서울 성동구
kv2ohUhQgtM|한우촌|광주 서구 쌍촌동
yQ_oRqiEeaA|청춘극장|서울 성동구 행당동
-5Voqflcoj0|소바쥬|서울 마포구
lwmndqMzJHo|모노로그|서울 강남구 청담동
tCcZHTBqT9Y|이타닉가든|서울 강남구
WbZUZrLeW8g|아저씨대구탕|부산 해운대구
CCL_EL2mYrI|굴과찜사랑|서울 성동구 행당동
0bhIvb9H4dI|기노|서울 마포구
ioCcE6kG1Zc|네기실비 신사점|서울 강남구 신사동
u4jD_Q0Rdfc|현대닭내장|전북 전주시
u4jD_Q0Rdfc|산동만두|서울 용산구 후암동
u4jD_Q0Rdfc|브리즈버거|서울 서초구 방배동
yrg03IgopB8|시시오|서울 강남구
zebww_x-NGA|영동식당|대전 중구
uNKLPete4Yc|거대곰탕|서울
yu5TucnhyaA|스시스즈메|서울
yAJbm7qbxnI|원조신촌설렁탕|서울 서대문구
y9LtBYTMqpM|압구정초원 도산대로점|서울 강남구
Csa1SRABHPM|김천식당|충북 보은군
tHayPKxE7t0|은행나무|전남 강진군
5mnqg6ziZNQ|레오레오캅|서울 용산구
7_sgLUKm1j4|옥스라이브파이어그릴|서울
BNZAE5RDxRQ|일억조|제주 제주시
eGaOsvB18WE|맥파이 탑동점|제주 제주시
glnsdmR_xTc|함경도찹쌀순대|서울 송파구
zlgHHgzFhfc|모코시야|서울 용산구
4B5P3toNrBs|통일면옥|대전 대덕구
jrLiUX7Fo_o|목로평양만두국|서울 강남구
hYJVZtoY1qA|SUSHI702|서울 강남구
V3p6J4x50fI|청수장|서울 성북구
lY1IigHIkV4|대물섬|서울 용산구 한남동
ay-BYRBHb6A|고향집|강원 인제군
YRZkxRVX-A8|정선면옥|강원 정선군`;
for(const l of pinned.split('\n')){const [videoId,name,region]=l.split('|');add({videoId,name,region,evidenceUrl:videos.get(videoId)?.url,evidenceType:'official_description_named_place'});}
// Official creator comments provide both the venue and street address for these episodes.
const addressed=`EPLbVckVF2w|황토마당|서울 용산구 한강대로62나길 20
n6a_gSuY7dg|장미식당|서울 성동구 금호로 84
qF3pjv-kMpA|돌담집|경기 가평군 설악면 한서로 106
4IFy1FVxKmg|닭내장집|서울 서대문구 수색로 28-5
uuFFGl-U3og|하늘성|서울 용산구 보광로7길 15
xeNt5vcHkk4|서북면옥|서울 광진구 자양로 199-1
MbAUNtyDocY|삼각지신림순대볶음|서울 용산구 한강대로62길 18
wi9uBAYxdN4|봉구네가마솥순대국|서울 서대문구 증가로10길 50
7TDaUsYp868|심마니약초백숙|서울 성동구 성덕정13길 4
wahTKmstWSY|덕정뒷고기|경남 김해시 덕정로 202
NSuwkeG_ro0|신설동순대국집|서울 동대문구 하정로4길 12`;
for(const l of addressed.split('\n')){const [videoId,name,address]=l.split('|');const c=comments.get(videoId);if(!c||c.name!==name||c.address!==address)throw Error('Missing creator evidence '+videoId);add({videoId,name,address,evidenceUrl:videos.get(videoId)?.url,evidenceType:'official_creator_comment_name_and_address',aliases:name==='닭내장집'?['닭발집']:name==='신설동순대국집'?['원조순대국','간판없는순대국집']:[]});}
for(const s of await read(dir+'/additional-seeds.json'))add(s);
const reviewFile=dir+'/seed-review.json';let reviews={};try{reviews=await read(reviewFile)}catch(e){if(e.code!=='ENOENT')throw e}
for(const s of seeds)Object.assign(s,reviews[s.key]||{});
await fs.writeFile(dir+'/seeds.json',JSON.stringify(seeds,null,2));
const deletions=(await read('matpick_all/client/src/data/restaurant-permanent-deletions.json')).restaurants;
const searches=new Map((await lines(dir+'/searches.ndjson')).map(p=>[p.query,p]));
const panels=new Map((await lines(dir+'/panels.ndjson')).map(p=>[p.id,p]));
async function search(q){if(searches.has(q))return searches.get(q);const r=await lookup(q);searches.set(q,r);await fs.appendFile(dir+'/searches.ndjson',JSON.stringify(r)+'\n');await sleep(500);return r;}
async function panel(id){if(panels.has(id))return panels.get(id);const r=await getPlace(id);panels.set(id,r);await fs.appendFile(dir+'/panels.ndjson',JSON.stringify(r)+'\n');await sleep(500);return r;}
const records=[];
for(const s of seeds){let result={...s};try{
 if(s.holdReason){result.status='evidence_hold';}
 else{
 const q=(s.address?cleanAddress(s.address):s.region)+' '+s.name;
 let ps=(await search(q)).places;
 if(s.aliases?.length)for(const alias of s.aliases)ps.push(...(await search((s.address?cleanAddress(s.address):s.region)+' '+alias)).places);
 ps=[...new Map(ps.map(p=>[p.id,p])).values()];
 const names=seedNames({...s,address:s.address||s.region});
 const regionMatches=p=>{if(!s.region)return true;const a=addressParts(s.region),b=addressParts(p.roadAddress?.replace('전남광주통합특별시',a.province==='전남'?'전남':'광주')||p.parcelAddress);return a.province===b.province&&a.areas.every(v=>b.areas.includes(v))&&(!s.region.match(/\S+동$/)||p.parcelAddress.includes(s.region.match(/\S+동$/)[0]));};
 if(!ps.length&&s.address)ps=(await search(cleanAddress(s.address).split(' ').slice(0,2).join(' ')+' '+s.name)).places;
 const match=p=>names.some(n=>nameKeys(p.name,p.roadAddress).includes(n)||normalizeName(p.name.replace(/\s+본점$/,''))===n)&&(s.address?[p.roadAddress,p.parcelAddress].some(a=>sameGeocodeAddress(s.address,a)):regionMatches(p));
 const candidates=ps.filter(match);result.candidates=ps;
 if(candidates.length===1){const p=await panel(candidates[0].id);result.place=p;
 const identity=match({...candidates[0],name:p.name,roadAddress:p.address})&&distance(p,candidates[0])<100;
 result.status=!identity?'panel_conflict':isDeleted({...s,name:p.name,address:p.address,aliases:[s.name,...s.aliases||[]]},deletions)?'permanently_deleted':p.status!=='Y'?'inactive_listing':p.category!=='음식점'?'not_restaurant':p.menus.length?'verified':'menu_missing';
 }else result.status=candidates.length?'ambiguous_branch':'place_not_matched';
 }
 }catch(e){result.status='error';result.error=e.message;if([403,429].includes(e.status))throw e;}
 records.push(result);if(records.length%20===0)console.log({done:records.length,total:seeds.length});
 await fs.writeFile(dir+'/verification.json',JSON.stringify({asOf:'2026-09-24',records},null,2));
}
console.log(Object.fromEntries([...new Set(records.map(r=>r.status))].map(s=>[s,records.filter(r=>r.status===s).length])));
