import fs from 'node:fs/promises';
import {sleep} from './coordinate-audit.mjs';
export const dir='source-data/choiza-complete-2026-09-24';
export const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const plain=s=>s.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/[ \t]+/g,' ').trim();
async function blogs(){
 const home='https://amatna.tistory.com';const links=new Set();
 for(let page=1;page<=5;page++){
  const url=home+'/?page='+page,res=await fetch(url);if(!res.ok)throw new Error('Blog HTTP '+res.status);
  const h=await res.text();for(const m of h.matchAll(/href="(\/\d+)"/g))links.add(home+m[1]);await sleep(350);
 }
 const result=[];
 for(const url of links){
  const res=await fetch(url);if(!res.ok)throw new Error('Blog HTTP '+res.status);const html=await res.text();
  const t=plain(html.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,''));
  const fields={};for(const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)){const cells=[...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(v=>plain(v[1]));if(cells.length===2)fields[cells[0]]=cells[1];}
  const title=plain(html.match(/<title>([\s\S]*?)<\/title>/)?.[1]||'');
  const season=t.match(/\[?최자로드\s*([123])\]?\s*EP/i)?.[1]||t.match(/최자로드\s*시즌\s*([123])/)?.[1];
  const episode=t.match(/EP\.?\s*(\d+(?:-\d+)?)/i)?.[1];
  const videoIds=[...new Set([...html.matchAll(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu.be\/)([A-Za-z0-9_-]{11})/g)].map(m=>m[1]))];
  if(fields['상호명'])result.push({name:fields['상호명'],address:fields['주소'],historicalMenus:fields['메뉴'],season:season?Number(season):1,episode:episode||'',sourceUrl:url,title,videoIds,checkedAt:new Date().toISOString(),note:'2020년 글: 소개 식별 근거. 현재 영업·가격은 별도 대조 필요.'});await sleep(350);
 }
 await fs.writeFile(dir+'/blog-facts.json',JSON.stringify(result,null,2));console.log({blogs:result.length,items:result.map(r=>({name:r.name,address:r.address,season:r.season,ep:r.episode,url:r.sourceUrl}))});
}
if(process.argv.includes('--blogs'))await blogs();
