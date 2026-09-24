import fs from 'node:fs/promises';
import { sameGeocodeAddress, cleanAddress } from './coordinate-audit.mjs';
import { seedNames, isDeleted, key } from './verify-requested-topics.mjs';
import { nameKeys } from './topic-publication/identity.mjs';
const dir = 'source-data/choiza-complete-2026-09-24';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const current = await read('matpick_all/client/src/data/generated/public-dataset.json');
let baseline;
try { baseline = await read(dir + '/publication-baseline.json'); }
catch (e) {
  if (e.code !== 'ENOENT') throw e;
  baseline = { restaurantIds: current.restaurants.map(r => r.id), links: current.sourceLinks.filter(l => l.sourceId === 'choiza-road') };
  await fs.writeFile(dir + '/publication-baseline.json', JSON.stringify(baseline, null, 2) + '\n');
}
const baselineIds = new Set(baseline.restaurantIds);
const existing = current.restaurants.filter(r => baselineIds.has(r.id));
const deletions = (await read('matpick_all/client/src/data/restaurant-permanent-deletions.json')).restaurants;
const verification = await read(dir + '/verification.json');
const output = { restaurants: [], sourceLinks: [], patches: {} };
const byPlace = new Map();
const decisions = [];
const price = s => /^\d[\d,]*$/.test(s) ? Number(s.replace(/,/g, '')).toLocaleString('ko-KR') + '원' : s;
for (const seed of verification.records) {
  const decision = { key: seed.key, name: seed.name, videoId: seed.videoId, status: seed.status, evidenceUrl: seed.evidenceUrl };
  decisions.push(decision);
  if (seed.status !== 'verified' || seed.holdReason) continue;
  const p = seed.place;
  const names = seedNames({ ...seed, address: p.address, aliases: [...seed.aliases || [], p.name] });
  if (isDeleted({ ...seed, name: p.name, address: p.address }, deletions)) { decision.status = 'permanently_deleted'; continue; }
  const candidates = existing.filter(r => (r.kakaoPlaceId === p.id || names.some(n => nameKeys(r.name, r.address).includes(n))) && sameGeocodeAddress(r.address, p.address));
  if (candidates.length > 1) { decision.status = 'existing_duplicate_review'; continue; }
  const match = candidates[0];
  if (match?.recommendationHold || ['closed', 'moved'].includes(match?.operationState)) { decision.status = 'existing_operation_hold'; continue; }
  const menus = p.menus.map(m => ({ ...m, price: price(m.price) }));
  if (!menus.some(m => /[1-9]/.test(m.price || ''))) { decision.status = 'price_review'; continue; }
  const id = match?.id || byPlace.get(p.id) || 'choiza_place_' + key(p.id);
  const menuPatch = {
    menus,
    representativeMenu: menus.filter(m => !/콜키지|와인|주류|주차/.test(m.name)).slice(0, 3).map(m => m.name).join(' · ') || menus[0].name,
    menuPriceVerifiedAt: '2026-09-24',
    menuPriceStatus: 'public-menu-checked',
    menuPriceSources: [{ label: '카카오맵 공개 메뉴', url: p.url }],
    menuPriceNote: '조회 당시 공개된 메뉴입니다. 방문 시 구성과 가격이 달라질 수 있습니다.',
  };
  if (!match && !byPlace.has(p.id)) {
    output.restaurants.push({ id, name: p.name, address: p.address, region: cleanAddress(p.address).split(' ').slice(0, 2).join(' '), lat: p.lat, lng: p.lng, category: p.categoryDetail || '음식점', imageUrl: '', kakaoPlaceId: p.id, placeUrl: p.url, ...(p.phone ? { phone: p.phone } : {}), locationVerifiedAt: '2026-09-24', locationSourceUrls: [p.url], ...menuPatch });
    byPlace.set(p.id, id);
  }
  // Existing hand-checked menus remain authoritative. Fill only absent menus/prices.
  if (match && (!match.menus?.length || !match.menus.some(m => /[1-9]/.test(m.price || '')))) output.patches[id] = menuPatch;
  const label = [seed.episodeSeries, seed.season ? `시즌 ${seed.season}` : '', seed.episodeNumber != null ? `${seed.episodeNumber}회${seed.episodePart ? ` ${seed.episodePart}부` : ''}` : '특별편'].filter(Boolean).join(' · ');
  const linkId = 'choiza_appearance_' + key(id + '|' + (seed.videoId || seed.evidenceUrl));
  if (!output.sourceLinks.some(l => l.id === linkId)) output.sourceLinks.push({
    id: linkId, restaurantId: id, sourceId: 'choiza-road', label, sourceUrl: seed.sourceUrl,
    broadcastDate: seed.sourceDate, season: seed.season || undefined, episodeNumber: seed.episodeNumber,
    episodeSeries: seed.episodeSeries, episodePart: seed.episodePart,
    note: seed.evidenceType?.includes('takeaway') ? '방송에서 포장 메뉴를 소개한 식당입니다.' : undefined,
  });
  Object.assign(decision, { status: 'published', restaurantId: id, newRestaurant: !baselineIds.has(id), placeId: p.id, placeUrl: p.url, menuItems: menus.length });
}
await fs.writeFile('matpick_all/client/src/data/generated/choiza-road.generated.json', JSON.stringify(output, null, 2) + '\n');
const report = { asOf: '2026-09-24', checkedCandidates: verification.records.length, newRestaurants: output.restaurants.length, publishedRestaurants: new Set(output.sourceLinks.map(l => l.restaurantId)).size, appearances: output.sourceLinks.length, newMenuItems: output.restaurants.reduce((n, r) => n + r.menus.length, 0), decisions };
await fs.writeFile(dir + '/publication.json', JSON.stringify(report, null, 2) + '\n');
console.log({ ...report, decisions: undefined });
