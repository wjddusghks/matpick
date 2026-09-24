import fs from 'node:fs/promises';
const dir = 'source-data/choiza-complete-2026-09-24';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const [videos, verification, publication, audit, data] = await Promise.all([
  read(dir + '/video-inventory.json'), read(dir + '/verification.json'), read(dir + '/publication.json'),
  read('source-data/location-release-audit-2026-09-24/coordinate-audit.json'),
  read('matpick_all/client/src/data/generated/public-dataset.json'),
]);
const records = new Map(verification.records.map(r => [r.key, r]));
const seeded = new Set(verification.records.map(r => r.videoId));
const special = {
  p4kavOhiqLQ: '해외 식당 편: 국내 공개 지도에서 제외',
  o61_pDGovfc: '개인 바비큐 편: 일반 식당 이용 근거 없음',
  J6G1VsnejI4: '루프탑 조리 편: 일반 식당 이용 근거 없음',
  rUFJ62QhMZM: '섬 야외 식사 편: 일반 식당 이용 근거 없음',
  ND3cy3HfxkU: '낚시·직접 조리 편: 일반 식당 이용 근거 없음',
  VbElBzjsoe8: '비하인드 영상', wErRq_m4Gd8: '이벤트 안내',
  '5tm9ojdLji4': '에필로그·인터뷰', '331s6jBqAqw': '시즌 예고편', kXd1wY7EVd0: '이전 부산 편 모음',
};
const coverage = {
  asOf: '2026-09-24', inventoryCount: videos.length,
  selectedLongForms: videos.filter(v => v.longForm).length,
  longFormsWithIdentifiedCandidates: videos.filter(v => v.longForm && seeded.has(v.id)).length,
  unseededLongForms: videos.filter(v => v.longForm && !seeded.has(v.id)).map(v => ({
    ...v, classification: special[v.id] || (/배부른 소리/.test(v.title) ? '토크 형식: 언급·촬영 장소·실제 방문 구분 추가 검토' : '미분류'),
  })),
  limitation: '공식 채널 메타데이터 목록을 대조한 결과입니다. 모든 영상 전편 시청 완료나 모든 방문 식당의 완전한 목록을 의미하지 않습니다. 쇼츠·중복 편집본은 별도 방문 증거로 자동 등록하지 않았습니다.',
};
await fs.writeFile(dir + '/coverage.json', JSON.stringify(coverage, null, 2) + '\n');
const status = {
  place_not_matched: '현재 지도 상호·주소 불일치 또는 검색 미확보',
  evidence_hold: '영상 지점·이전·현 운영 연결 근거 보류',
  menu_missing: '현재 지도 메뉴 자료 없음',
  existing_duplicate_review: '기존 맛픽에 동일 후보가 여러 개 있어 병합 검토 필요',
};
const esc = s => String(s || '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const published = publication.decisions.filter(d => d.status === 'published');
const held = publication.decisions.filter(d => d.status !== 'published');
const report = `# 맛픽 반영 및 조사 기록 — 2026-09-24

## 반영 범위

- 최자로드: 기존 식당 포함 **${publication.publishedRestaurants}곳**, 소개 근거 **${publication.appearances}건**. 신규 **${publication.newRestaurants}곳**, 신규 식당의 메뉴·가격 **${publication.newMenuItems}건**.
- 공식 영상 제목·설명·제작자 댓글·확보된 자막과 블로그의 상호·주소를 대조하고, 현재 카카오맵의 동일 상호·주소·좌표·메뉴가 연결되는 곳만 반영했습니다.
- 지도에서 영업 중인 목록과 현재 표시 메뉴를 확인한 결과이며, 모든 식당에 전화해 영업을 확약받은 것은 아닙니다. 방문 당일 가격·영업 여부는 달라질 수 있습니다.
- 과거 블로그 가격은 최신 가격으로 사용하지 않았습니다. 포장 소개는 별도 표시했습니다. 영구 삭제된 식당은 다시 등록하지 않았습니다.
- 회차를 시즌·본편·온더웨이·다시 쓰는·부별로 구분했습니다. 목록 순번을 회차로 바꾸지 않습니다.

## 좌표 대조

전체 **${audit.total}곳**을 빠짐없이 조회했습니다. 주소 대조 통과 **${audit.counts.coordinate_consistent}곳**, 주소로 정확한 점을 정하지 못한 **${audit.counts.address_not_matched}곳**은 추천 보류 상태입니다. 건물 주소 기준 오차 100m 이내 또는 동일 상호·주소가 확인된 장소 좌표를 사용하며, 출입구 단위 정확성까지 보장하는 검사는 아닙니다.

‘온’은 **서울 강남구 도산대로92길 42 지하 1층**, **37.521985, 127.049395**로 확인했습니다. 기흥·동탄으로 표시되던 잘못된 좌표는 교정됐습니다. 운영 서버에 저장된 별도 관리자 수정 데이터에서도 이를 덮어쓰는 좌표 수정은 없었습니다.

| 추천 보류 식당 | 저장 주소 | 대조 결과 |
|---|---|---|
${audit.records.filter(r => r.status !== 'coordinate_consistent').map(r => `| ${esc(r.name)} | ${esc(r.address)} | ${esc(r.status)} |`).join('\n')}

## 조사 범위와 미완료 항목

공식 채널 메타데이터 **${videos.length}개** 중 긴 영상 **${coverage.selectedLongForms}개**를 분류했고, **${coverage.longFormsWithIdentifiedCandidates}개**에서 식당 후보를 연결했습니다. 후보 **${publication.checkedCandidates}건** 중 **${published.length}건** 반영, **${held.length}건** 보류입니다. 후보는 같은 식당이 다른 영상에 나오는 경우를 포함합니다.

${coverage.limitation}

| 추가 식당 등록으로 연결하지 않은 영상 | 분류 |
|---|---|
${coverage.unseededLongForms.map(v => `| [${esc(v.title)}](${v.url}) | ${v.classification} |`).join('\n')}

## 보류 후보와 이유

검색되지 않는다는 이유만으로 폐업 처리하지 않았습니다. 아래 후보는 공개 최자로드 식당 목록에 새로 추가하지 않았습니다.

| 식당 | 지역·주소 | 보류 사유 | 소개 근거 |
|---|---|---|---|
${held.map(d => { const r = records.get(d.key); return `| ${esc(d.name)} | ${esc(r.address || r.region)} | ${esc(r.holdReason || status[d.status] || d.status)} | [확인 링크](${d.evidenceUrl}) |`; }).join('\n')}

## 반영된 소개 근거

| 식당 | 현재 주소 | 구분·회차 | 메뉴·가격 확인 | 소개 근거 |
|---|---|---|---|---|
${published.map(d => { const r = records.get(d.key); const current = data.restaurants.find(v => v.id === (data.restaurantAliases[d.restaurantId] || d.restaurantId)); return `| ${esc(current?.name || d.name)} | ${esc(current?.address)} | ${esc([r.episodeSeries, r.season ? '시즌 ' + r.season : '', r.episodeNumber != null ? r.episodeNumber + '회' : '특별편', r.episodePart ? r.episodePart + '부' : ''].filter(Boolean).join(' · '))} | [현재 공개 메뉴](${d.placeUrl}) | [영상·소개 근거](${r.sourceUrl}) |`; }).join('\n')}

## 관리자 전용 레드리본

[공식 지역 안내](https://linktr.ee/cocacolaredribbon_N)의 서울·수도권·강원/충청·경상·전라·제주 6개 지도 링크를 관리자 자료실로 연결했습니다. 메인 썸네일·자료실은 관리자만 표시하며, 서버도 서명된 관리자 로그인 토큰을 확인합니다. 일반 방문자에게 목록을 내려주지 않으며 검색·사이트맵에도 넣지 않습니다.

이 작업은 공식 링크를 묶은 참고 자료실입니다. 블루리본 식당 목록 자체를 복제·수집한 상태는 아닙니다. 사용자께서 공유한 블루리본 안내에 따라, 데이터 수집·재게시를 진행하려면 제공자의 사전 서면 허가 범위를 확인해야 합니다. 관리자에게만 보이게 해도 수집 허가가 생기는 것은 아닙니다.

## youtubeplace 비교·재사용

[사이트 소개](https://youtubeplace.co.kr/about)에서 별도 공개 API·일괄 재사용 허락을 확인하지 못했습니다. 상호 후보를 참고해 공식 영상과 현재 식당 정보를 독립적으로 확인하는 방식으로 진행했습니다. 해당 사이트 데이터베이스 전체를 가져오려면 제공자가 허용하는 데이터 제공·재사용 범위를 먼저 확인해야 합니다. 나무위키 요청 URL은 브라우저에서 접근이 차단되어 직접 인용하지 않았습니다.
`;
await fs.mkdir('deliverables/release-2026-09-24', { recursive: true });
await fs.writeFile('deliverables/release-2026-09-24/README.md', report);
console.log({ coverage: { inventory: videos.length, longForms: coverage.selectedLongForms, withCandidates: coverage.longFormsWithIdentifiedCandidates }, held: held.length, report: 'deliverables/release-2026-09-24/README.md' });
