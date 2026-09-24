import fs from 'node:fs/promises';
import {auditDir,cleanAddress} from './coordinate-audit.mjs';
import {plain} from './collect-requested-blogs.mjs';
import {normalizeName} from './topic-publication/identity.mjs';
const old=JSON.parse(await fs.readFile('source-data/culinary-class-wars/restaurants.json','utf8'));
const html=await fs.readFile(auditDir+'/.cache/guide.html','utf8');
const paragraphs=[...html.matchAll(/<p[^>]*class="[^"]*se-text-paragraph[^>]*>([\s\S]*?)<\/p>/g)].map(m=>plain(m[1])).filter(Boolean);
const blocks=paragraphs.join('\n').split('✅').slice(1).map(b=>({heading:b.split('\n')[0],addresses:b.split('\n').filter(l=>l.startsWith('■'))}));
const alias={SOIGNE:['스와니예'],'BISTROT de YOUNTVILLE':['BISTYROT de YOUNTVILLE','비스트로 드 욘트빌'],'IMOK Smoke Dining':['이목스모크다이닝'],'Original Numbers 청담':['오리지널 넘버스'],'소울 SOUL':['소울'],'에그앤플라워 해방촌 본점':['에그앤플라워'],'앰배서더 서울 풀만 호빈':['호빈'],'코자차 kojacha':['코자차'],'오스테리아 샘킴':['오스리아 샘킴'],'네기라이브':['네기라이브'],'동경밥상 본점':['동경밥상']};
const keys=r=>[r.restaurantName,r.matchedPlaceName,...(alias[r.restaurantName]||[])].filter(Boolean).map(normalizeName);
const seeds=[];const covered=new Set();
for(const r of old.filter(x=>x.season===1)){
 const b=blocks.find(b=>keys(r).some(k=>normalizeName(b.heading+' '+b.addresses.join(' ')).includes(k))&&[r.chefName,r.contestantName].some(v=>normalizeName(b.heading).includes(normalizeName(v))));
 if(!b)continue;covered.add(b.heading);
 seeds.push({name:r.restaurantName,aliases:alias[r.restaurantName]||[],address:r.address,lat:r.lat,lng:r.lng,chef:r.chefName,contestant:r.contestantName,season:1,sourceId:'culinary-class-wars-chefs',sourceUrl:'https://blog.naver.com/tour_toctoc/223593400472',sourceDate:'2024-09',evidenceType:'supplied_guide_corroborates_previous_research',legacyId:r.id,oldPlaceId:r.kakaoPlaceId||null});
}
const guides=[];
for(const type of ['백수저','흑수저']){
 const url=`https://tournwine.com/entry/흑백요리사2-${type}-셰프-출연진-및-식당-리스트-총정리`;const res=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!res.ok)throw new Error('Guide HTTP '+res.status);const content=await res.text();
 const headings=[...content.matchAll(/<h4\b[^>]*>([\s\S]*?)<\/h4>/g)];
 for(let i=0;i<headings.length;i++){
  const h=plain(headings[i][1]);if(!h.includes('셰프 출연진'))continue;
  const block=content.slice(headings[i].index+headings[i][0].length,headings[i+1]?.index||content.length);
  const lis=[...block.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(m=>plain(m[1]));
  const restaurantLine=lis.find(l=>/식당명|셰프 식당/.test(l))||'';
  const names=[...restaurantLine.matchAll(/<([^>]+)>/g)].map(m=>m[1]);
  const chefLabel=h.split(':').slice(1).join(':').replace(/닉네임\s*/, '').replace(/['‘’]/g,'').trim();
  const entries=[];
  for(const name of names){
   const n=normalizeName(name.replace(/\([^)]*\)/g,''));
   const candidates=old.filter(r=>r.season===2&&keys(r).some(k=>k===n));const r=candidates.length===1?candidates[0]:null;
   const sameChef=r&&[r.chefName,r.contestantName].some(c=>normalizeName(c)===normalizeName(chefLabel));
   const item={name:r?.restaurantName||name,aliases:[name,...(r?alias[r.restaurantName]||[]:[])],address:r?.address||'',chef:sameChef?r.chefName:chefLabel,contestant:chefLabel,season:2,sourceId:'culinary-class-wars-chefs',sourceUrl:url,sourceDate:type==='백수저'?'2025-12-16':'2025-12-18',evidenceType:sameChef?'two_directory_identity_agreement':'supplied_guide_needs_affiliation_check',legacyId:r?.id||null,oldPlaceId:r?.kakaoPlaceId||null};
   if(/모노로그|금룡|136길|백운한정식/.test(name))item.holdReason='출연 당시와 현재 소속 또는 영업점 근거 추가 확인';
   if(/KOCHI|Mari|Namu|Gaji|Oyatte/i.test(name))item.holdReason='해외 식당';
   seeds.push(item);entries.push({name,chef:chefLabel,matchedLegacyId:r?.id||null});
  }
  guides.push({sourceUrl:url,chef:chefLabel,restaurants:entries,hasRestaurant:!!names.length});
 }
}
// Corrections verified in the preceding research: retain old affiliations in the archive.
for(const r of seeds){if(/비아.*톨레도|디핀/.test(r.name))r.holdReason='이전 식당 또는 셰프 퇴사 확인. 현재 점포와 분리';if(/네기라이브/.test(r.name)){r.aliases.push(r.name,'코레츠 라이브');r.name='코레츠 라이브';r.currentNameSource='https://baamkong.tistory.com/entry/성수-맛집-네기라이브-런치-후기-코레츠-라이브';}}
for(const r of JSON.parse(await fs.readFile('source-data/dudley-chefs-followup-2026-09-24/findings.json','utf8')).records.filter(r=>['vesuvio','notre'].includes(r.key)))seeds.push({name:r.name,aliases:[],address:r.address,chef:r.chef,season:1,sourceId:'culinary-class-wars-chefs',sourceUrl:r.sources.find(s=>s.kind==='booking_page_ui').url,sourceDate:'2026-09-24',evidenceType:'current_booking_affiliation',verifiedMenus:r.menuObservations.filter(m=>m.price).map((m,i)=>({id:'m'+i,name:m.name,price:m.price.toLocaleString('ko-KR')+'원'}))});
await fs.writeFile(auditDir+'/chef-seeds.json',JSON.stringify({seeds,guides,unmatchedSeason1:blocks.filter(b=>!covered.has(b.heading))},null,2));
console.log(JSON.stringify({seeds:seeds.length,season1:seeds.filter(r=>r.season===1).length,season2:seeds.filter(r=>r.season===2).length,unmatchedSeason1:blocks.filter(b=>!covered.has(b.heading)).map(b=>b.heading),needsAffiliation:seeds.filter(s=>s.evidenceType==='supplied_guide_needs_affiliation_check').map(s=>s.name)},null,2));
