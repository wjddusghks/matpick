import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditDir,sleep} from './coordinate-audit.mjs';
export function decode(s){return String(s||'').replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ');}
export const plain=s=>decode(String(s||'').replace(/<[^>]*>/g,' ')).replace(/[\u200b-\u200d]/g,'').replace(/\s+/g,' ').trim();
async function get(url){const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(25000)});if(!r.ok)throw Object.assign(new Error('HTTP '+r.status),{status:r.status});return r.text();}
export function extractPost(html,post){
 const maps=[];
 for(const m of html.matchAll(/data-module="([^"]+)"/g)){try{const d=JSON.parse(decode(m[1])).data;if(d?.address&&d.title&&d.latitude)maps.push({name:d.title,address:d.address,lat:Number(d.latitude),lng:Number(d.longitude),naverPlaceId:String(d.locationId||'')});}catch{}}
 for(const m of html.matchAll(/data-linkdata='([^']+)'/g)){try{const d=JSON.parse(decode(m[1]));if(d.address&&d.name)maps.push({name:d.name,address:d.address,lat:Number(d.latitude),lng:Number(d.longitude),naverPlaceId:String(d.placeId||'')});}catch{}}
 for(const m of html.matchAll(/data-module='([^']+)'/g)){try{const d=JSON.parse(decode(m[1]));for(const p of d.data?.places||[])if(p.address&&p.name)maps.push({name:p.name,address:p.address,lat:Number(p.latlng?.latitude),lng:Number(p.latlng?.longitude),naverPlaceId:String(p.placeId||'')});}catch{}}
 let paragraphs=[...html.matchAll(/<p[^>]*class="[^"]*(?:se-text-paragraph|se_textarea)[^>]*>([\s\S]*?)<\/p>/g)].flatMap(m=>m[1].split(/<br\s*\/?\s*>/i).map(plain)).filter(Boolean);
 const legacyStart=html.indexOf(`id="post-view${post.logNo}"`);
 let legacy='';
 if(legacyStart>=0){let depth=1,end=legacyStart;for(const m of html.slice(legacyStart).matchAll(/<\/?div\b[^>]*>/g)){depth+=m[0].startsWith('</')?-1:1;if(!depth){end=legacyStart+m.index;break;}}legacy=html.slice(legacyStart,end);}
 if(!paragraphs.length)paragraphs=[...legacy.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].flatMap(m=>m[1].split(/<br\s*\/?\s*>/i).map(plain)).filter(Boolean);
 const legacyMapUrls=[...html.matchAll(/<iframe[^>]*src="(https:\/\/mashup\.map\.naver\.com\/[^" ]+)"/g)].map(m=>decode(m[1]));
 const places=[...new Map(maps.map(p=>[p.naverPlaceId+'|'+p.name+'|'+p.address,p])).values()];
 const addressClues=paragraphs.filter(p=>p.length<180&&/^(?:주소\s*[:：]?\s*)?(?:서울|부산|대구|인천|광주|대전|울산|제주|경기|강원|충청|충남|충북|전라|전남|전북|경상|경남|경북|세종)/.test(p)&&/(?:로|길|동|리)\s*\d/.test(p)).slice(0,8);
 // Only short factual price mentions; never save full review prose or photos.
 const priceMentions=paragraphs.filter(p=>p.length<85&&/(?:\d[\d,]*\s*원|\d+(?:\.\d+)?\s*만\s*원)/.test(p)&&/점심|저녁|런치|디너|코스|가격|오마카세|정식|메뉴|원/.test(p)).slice(0,8);
 return {...post,checkedAt:new Date().toISOString(),readStatus:paragraphs.length||places.length?'body_read':'legacy_body_or_unreadable',paragraphCount:paragraphs.length,places,addressClues,priceMentions,legacyMapUrls,titleNameClue:post.title.split(/\s[-–:]\s/)[0].trim(),historical:true};
}
async function main(){await fs.mkdir(auditDir,{recursive:true});
 const indexFile=path.join(auditDir,'dudley-index.json');let index;
 try{index=JSON.parse(await fs.readFile(indexFile,'utf8'));}catch{
  const posts=new Map();let count=Infinity;let page=1;
  while(posts.size<count){const url=`https://blog.naver.com/PostTitleListAsync.naver?blogId=elixir0827&viewdate=&currentPage=${page}&categoryNo=&parentCategoryNo=&countPerPage=30`;const text=await get(url);const d=JSON.parse(text.replace(/\\'/g,"'"));const list=d.postList||[];if(page===1)console.log('index metadata',JSON.stringify({keys:Object.keys(d),totalCount:d.totalCount}));if(!list.length)break;const before=posts.size;for(const p of list)posts.set(p.logNo,{logNo:p.logNo,title:decodeURIComponent(p.title.replace(/\+/g,' ')),publishedAt:p.addDate,categoryNo:p.categoryNo,url:`https://blog.naver.com/elixir0827/${p.logNo}`});count=Number(d.totalCount)||1148;if(posts.size===before)throw new Error('Pagination repeated');page++;await sleep(500);}
  index={expectedCount:count,indexed:posts.size,indexComplete:posts.size===count,posts:[...posts.values()]};await fs.writeFile(indexFile,JSON.stringify(index,null,2));
 }
 const cacheFile=path.join(auditDir,'dudley-posts.ndjson');const cache=new Map();try{for(const l of(await fs.readFile(cacheFile,'utf8')).split('\n').filter(Boolean)){const p=JSON.parse(l);cache.set(p.logNo,p);}}catch(e){if(e.code!=='ENOENT')throw e;}
 let next=0,done=0,blocked=false;const todo=index.posts.filter(p=>!cache.has(p.logNo)||(process.argv.includes('--retry-unreadable')&&!['body_read','non_restaurant_shared_post'].includes(cache.get(p.logNo).readStatus)));
 async function worker(){while(next<todo.length&&!blocked){const p=todo[next++];let result;try{result=extractPost(await get(`https://blog.naver.com/PostView.naver?blogId=elixir0827&logNo=${p.logNo}`),p);
 for(const url of result.legacyMapUrls||[]){const h=await get(url);const name=plain(h.match(/id="previewTitle1"[^>]*>([\s\S]*?)<\/h4>/)?.[1]);const address=plain(h.match(/id="previewAddress1"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/)?.[1]);const point=h.match(/center=([\d.]+),([\d.]+)/);if(name&&address&&point)result.places.push({name,address,lat:Number(point[2]),lng:Number(point[1]),naverPlaceId:'',legacyMapUrl:url,approximateAddress:true});await sleep(250);}
 if(!result.paragraphCount&&!result.places.length&&/^\[공유\].*(?:템플릿|블로그 서명)/.test(p.title))result.readStatus='non_restaurant_shared_post';
 }catch(e){result={...p,readStatus:'fetch_failed',error:e.message};if([403,429].includes(e.status))blocked=true;}cache.set(p.logNo,result);await fs.appendFile(cacheFile,JSON.stringify(result)+'\n');done++;if(done%100===0)console.log(JSON.stringify({postsRead:done,total:todo.length}));await sleep(500);}}
 await Promise.all(Array.from({length:3},worker));
 const records=[...cache.values()];const summary={expectedCount:index.expectedCount,indexed:index.indexed,indexComplete:index.indexComplete,attempted:records.length,bodyRead:records.filter(p=>p.readStatus==='body_read').length,nonRestaurantShared:records.filter(p=>p.readStatus==='non_restaurant_shared_post').length,unreadable:records.filter(p=>!['body_read','non_restaurant_shared_post'].includes(p.readStatus)).length,withMap:records.filter(p=>p.places?.length).length,retrievalComplete:index.indexComplete&&records.length===index.indexed&&records.every(p=>['body_read','non_restaurant_shared_post'].includes(p.readStatus)),allRestaurantsCurrentlyVerified:false};await fs.writeFile(path.join(auditDir,'dudley-summary.json'),JSON.stringify(summary,null,2));console.log(summary);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
