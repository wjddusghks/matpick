import fs from 'node:fs/promises';
const dir='source-data/choiza-complete-2026-09-24';
const file=dir+'/additional-seeds.json';
const rows=JSON.parse(await fs.readFile(file,'utf8'));
const input=`5e2S4YdJ2IY|보보식당|서울 강남구|official_description
DmXz9yyWEHo|영이네|서울 용산구 이태원동|official_description
4N28AyQ3zNU|평사리참숯뒷통구이|경남 김해시|official_description
fimEtiIy22M|골목길|서울 용산구|official_description
GKqA4DvWlEU|우촌숯불갈비|서울 성동구|official_description
Q1acfyQ3xXk|산지|서울 강남구|official_description
GdusDbOXI_4|진향|서울 마포구|official_description
Bz2SEDf7eUo|분식|서울 서대문구|official_description
SBY5Jtfe54I|비야게레로|서울 강남구|official_description
EFB18WyD1G0|신당한우곱창|서울 중구|official_description
nh7aDcksMtI|마케나이데|서울 용산구|official_description
b8haUWdjYUM|남영탉|서울 용산구|official_description
mkpw7JKbXWI|명화식육식당|광주 광산구|official_tags
EB5CcJfPwBI|초가뭉텅찌개|강원 춘천시|official_tags
u-ZHrbthhgE|닭진미강원집|서울 중구|official_tags
gbaDJuX2Ets|송강|서울 서초구 방배동|official_tags
IVYZL_OE3kk|금강산식당|서울 용산구 청파동|official_tags
UnE7FIdPPhE|우주옥|서울 마포구|official_description
Fk0Kg7jJ7DM|야반|경기 이천시|official_tags
1bENUw7xD6k|두레국수|서울 강남구|official_tags
zm5WF9Kabwg|88포장마차|전남 목포시|official_tags
jUAESe10WEc|꿉당 성수점|서울 성동구|official_tags
ZVYqfOnW1iU|사돈집|강원 속초시|official_tags
dOGpXEOiYH8|금돼지식당|서울 중구|official_tags
AFLizX0NwNw|뚝도농원|서울 성동구|official_tags
eZ-0KBt890s|네기실비|서울 강남구|official_tags
nfozV5gIFGE|삼창교자|서울 강남구|official_tags
MzPvmiSKcj8|태백닭갈비|강원 태백시|official_tags
TwlzZI0jZw0|맛이차이나|서울 마포구|official_tags
xyL_NtUgRrU|스시702|서울 강남구|official_tags
MpcXCA7aVh8|남북통일|서울 마포구|official_tags
kvc7QooDhkE|옛집|서울 마포구|official_tags
2rbY752cpYI|오산횟집|강원 양양군|official_tags
u5haD6yLpnw|원주복추어탕|강원 원주시|official_tags
IiLfRG6YbEo|명랑막국수|강원 원주시|official_description
IiLfRG6YbEo|명월집|경기 가평군|official_description
r3haobf1qkQ|은주정|서울 중구|official_description
UxMXbgceWKs|사랑방참숯화로구이|서울 용산구|official_description
zwR8nizRxZ4|영동포차나|서울 강남구|official_description
rf0Rk0O9480|청실홍실|서울 서초구|official_description
851eK2oD1eY|신비갈비살|서울 강남구|official_description
rmnTY7RTENU|호수집|서울 중구|official_description
y27NetXyef8|오븟|서울 강남구|official_description
z5sqB8pygyk|해태치킨|전남 구례군|official_title
z5sqB8pygyk|중동구판장|전남 구례군|official_title
60HACKXWJZk|문배동육칼 본점|서울 용산구|official_tags
QxErY8Pl3mI|고미태|서울 마포구|official_tags
StFXWgFjZlA|고미태|서울 마포구|official_tags
zRW_wdV4D_w|문어국밥|강원 속초시|official_tags
tc0B4yrXbvI|모녀가리비|강원 속초시|official_tags_takeaway
tc0B4yrXbvI|코끼리만두분식|강원 속초시|official_tags_takeaway`;
for(const line of input.split('\n')){
 const [videoId,name,region,evidenceType]=line.split('|');
 if(!rows.some(s=>s.videoId===videoId&&s.name===name))rows.push({videoId,name,region,evidenceType,evidenceUrl:'https://www.youtube.com/watch?v='+videoId});
}
await fs.writeFile(file,JSON.stringify(rows,null,2)+'\n');
