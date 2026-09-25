import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sameIdentity, sameAddress, nameKeys, normalizeName, safeSourceUrl, unitsConflict, addressParts } from './topic-publication/identity.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = 'source-data/six-topic-publication-2026-09-25';
const dataPath = 'matpick_all/client/src/data/';
const baselineCommit = '9573aa49dbbada9484f11a19014b40433184905d';
const asOf = '2026-09-25';
const read = async file => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
const write = async (file, value) => fs.writeFile(path.join(root, file), JSON.stringify(value, null, 2) + '\n');
const hash = value => crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
const pick = (value, keys) => Object.fromEntries(keys.filter(key => value?.[key] !== undefined).map(key => [key, value[key]]));
const coordinates = p => Number.isFinite(p?.lat) && Number.isFinite(p?.lng) && p.lat > 33 && p.lat < 39 && p.lng > 124 && p.lng < 132;
const addresses = p => [p?.address, p?.parcelAddress, p?.alternativeAddress].filter(Boolean);
const addressMatch = (a, b) => !unitsConflict(addressParts(a.address), addressParts(b.address)) && addresses(a).some(x => addresses(b).some(y => sameAddress(x, y)));
const nameCache = new WeakMap();
const names = r => { if (!nameCache.has(r)) nameCache.set(r, nameKeys(r.name, r.address)); return nameCache.get(r); };
const identity = (a, b) => names(a).some(n => names(b).includes(n)) && addressMatch(a, b) && (sameIdentity(a, b, addresses(a)) || sameIdentity(b, a, addresses(b)));
const priceExists = m => /[1-9]/.test(String(m?.price || ''));
const menuKey = m => normalizeName(m.name);
const date = value => {
  const s = String(value || '').replace(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?/, (_, y, m, d) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
  return /^\d{4}-\d{2}-\d{2}/.test(s) && Number.isFinite(Date.parse(s.slice(0, 10))) ? s.slice(0, 10) : '';
};
const youtube = value => {
  try {
    const url = new URL(value);
    if (!['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname)) return '';
    const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v');
    return /^[\w-]{11}$/.test(id || '') ? `https://www.youtube.com/watch?v=${id}` : '';
  } catch { return ''; }
};
const allowedEvidence = new Set(['official_description', 'official_video_description', 'official-detail', 'creator_comment']);

await fs.mkdir(path.join(root, directory), { recursive: true });
// Freeze only factual observations, source URLs and identity decisions, not downloaded page bodies.
// Subsequent runs need only this tracked input and the recorded baseline Git commit.
if (process.argv.includes('--freeze')) {
  const facts = await read('deliverables/six-topic-menus-2026-09-25/facts.json');
  const queue = new Map((await read('source-data/six-topic-research-2026-09-25/queue.json')).map(r => [r.key, r]));
  const rows = facts.rows.map(r => {
    const q = queue.get(r.key);
    const base = pick(r, ['key', 'topic', 'name', 'originalAddress', 'address', 'status']);
    if (!r.status.startsWith('matched_priced')) return base;
    return {
      ...base, topicId: q.topicId, restaurantId: q.restaurantId,
      ...pick(r, ['place', 'candidates', 'existingMatpickId', 'identityBasis', 'identityCheck', 'sourceOperationStatus', 'priceDisagreement', 'checkedAt', 'reused', 'crossTopicReuse', 'sources']),
      evidence: q.evidence.map(e => pick(e, ['sourceUrl', 'sourceKind', 'publishedAt', 'hasCorrectionOrOperationNote'])),
      menus: r.menus.map(m => ({ ...pick(m, ['name', 'price', 'sourceUrl', 'sourceAiAssisted', 'checkedAt']), sourceDate: date(m.sourceUpdatedAt || m.updatedAt || m.mod_at) })),
    };
  });
  await write(directory + '/observations.json', { asOf, baselineCommit, scope: facts.scope, rows });
}
const input = await read(directory + '/observations.json');
const baseline = JSON.parse(execFileSync('git', ['show', `${input.baselineCommit}:${dataPath}generated/public-dataset.json`], { cwd: root, maxBuffer: 30 * 1024 * 1024, encoding: 'utf8' }));
const deletions = (await read(dataPath + 'restaurant-permanent-deletions.json')).restaurants;
const output = { restaurants: [], sourceLinks: [], patches: {} };
const decisions = [];
const groups = new Map();
const catalog = [...baseline.restaurants];
const originalIds = new Set(catalog.map(r => r.id));
const existingLinks = new Set(baseline.sourceLinks.map(l => `${l.restaurantId}|${l.sourceId}|${youtube(l.sourceUrl)}`));
const deleted = r => deletions.some(d => [r.restaurantId, r.existingMatpickId].includes(d.id) || [r, r.place].filter(Boolean).some(p => identity(p, d)));
const active = r => !r.recommendationHold && !['closed', 'moved', 'temporarily_closed'].includes(r.operationState);
const distance = (a, b) => Math.hypot((a.lat - b.lat) * 111000, (a.lng - b.lng) * 88000);

for (const row of input.rows) {
  const decision = { key: row.key, topic: row.topic, name: row.name, status: row.status };
  decisions.push(decision);
  const hold = reason => { decision.status = reason; };
  if (!row.status.startsWith('matched_priced')) continue;
  if (deleted(row)) { hold('permanently_deleted'); continue; }
  if (row.priceDisagreement) { hold('price_conflict'); continue; }
  if (row.sourceOperationStatus && !['Y', 'existing_catalog_only', 'listing_only'].includes(row.sourceOperationStatus)) { hold('operation_review'); continue; }
  let place = row.place;
  if (!coordinates(place)) {
    const matches = (row.candidates || []).filter(p => coordinates(p) && identity(place, p));
    if (matches.length === 1) place = matches[0];
  }
  const matching = catalog.filter(r => identity(row.place, r) || identity(row, r) || (place.kakaoPlaceId && r.kakaoPlaceId === place.kakaoPlaceId && addressMatch(place, r)));
  if (matching.length > 1) { hold('existing_duplicate_review'); continue; }
  const match = matching[0];
  if (match && !active(match)) { hold('existing_operation_hold'); continue; }
  if (!match && !coordinates(place)) { hold('coordinate_review'); continue; }
  // The same map identifier with a different address may indicate relocation, not a new branch.
  if (!match && catalog.some(r => place.kakaoPlaceId && r.kakaoPlaceId === place.kakaoPlaceId)) { hold('same_place_address_review'); continue; }
  if (!match && catalog.some(r => distance(place, r) < 100 && names(r).some(n => n.length > 1 && (normalizeName(place.name).includes(n) || n.includes(normalizeName(place.name)))))) { hold('nearby_name_duplicate_review'); continue; }
  const topicEvidence = row.evidence.filter(e => allowedEvidence.has(e.sourceKind) && !e.hasCorrectionOrOperationNote && youtube(e.sourceUrl));
  const publishedEvidence = match ? baseline.sourceLinks.filter(l => l.restaurantId === match.id && l.sourceId === row.topicId && youtube(l.sourceUrl)).map(l => ({ sourceUrl: l.sourceUrl, publishedAt: l.broadcastDate })) : [];
  const evidence = [...topicEvidence, ...publishedEvidence];
  if (!evidence.length) { hold('topic_evidence_review'); continue; }
  const menus = row.menus.filter(m => m.name?.trim() && priceExists(m) && !m.sourceAiAssisted && safeSourceUrl(m.sourceUrl));
  if (!menus.length) { hold('menu_evidence_review'); continue; }
  const id = match?.id || `six_topic_${hash(place.kakaoPlaceId || place.name + '|' + place.address)}`;
  let group = groups.get(id);
  if (!group) {
    const restaurant = match || {
      id, name: place.name, address: place.address,
      region: place.address.split(' ').slice(0, 2).join(' '),
      lat: place.lat, lng: place.lng, imageUrl: '', category: '음식점', representativeMenu: '',
      ...(place.kakaoPlaceId ? { kakaoPlaceId: place.kakaoPlaceId } : {}),
      placeUrl: place.sourceUrl,
      locationVerifiedAt: asOf, locationSourceUrls: [place.sourceUrl].filter(Boolean),
    };
    group = { restaurant, rows: [], menus: [], isNew: !originalIds.has(id) };
    groups.set(id, group);
    if (!match) catalog.push(restaurant);
  }
  group.rows.push(row); group.menus.push(...menus);
  let addedLinks = 0;
  for (const e of evidence) {
    const sourceUrl = youtube(e.sourceUrl), key = `${id}|${row.topicId}|${sourceUrl}`;
    if (existingLinks.has(key)) continue;
    existingLinks.add(key); addedLinks++;
    output.sourceLinks.push({ id: `six_topic_link_${hash(key)}`, restaurantId: id, sourceId: row.topicId, label: `${row.topic} 소개${date(e.publishedAt) ? ` · ${date(e.publishedAt)}` : ''}`, sourceUrl, ...(date(e.publishedAt) ? { broadcastDate: date(e.publishedAt) } : {}) });
  }
  Object.assign(decision, { status: 'accepted', restaurantId: id, newRestaurant: group.isNew, duplicateOf: group.rows.length > 1 ? group.rows[0].key : undefined, addedLinks });
}

for (const [id, group] of groups) {
  const r = group.restaurant;
  // Resolve only observations whose date establishes an order. Conflicting equally dated
  // prices stay out; AI-assisted records are not authoritative publication evidence.
  const byName = new Map();
  for (const m of group.menus) {
    const k = menuKey(m); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(m);
  }
  const selected = [];
  for (const menus of byName.values()) {
    menus.sort((a, b) => (b.sourceDate || '').localeCompare(a.sourceDate || ''));
    const top = menus[0], peers = menus.filter(m => m.sourceDate === top.sourceDate);
    if (new Set(peers.map(m => String(m.price).replace(/[,\s]/g, ''))).size > 1) continue;
    selected.push(top);
  }
  // Existing priced menus remain authoritative. Add missing dishes and fill missing prices
  // only; historical snapshots must not replace a newer or manually curated menu price.
  const menus = (r.menus || []).map((m, index) => ({ ...m, id: m.id || `preserved_${index}` }));
  const newFacts = [];
  for (const fact of selected) {
    const existing = menus.find(m => menuKey(m) === menuKey(fact));
    if (existing && priceExists(existing)) continue;
    const item = { name: fact.name.trim(), price: fact.price, description: fact.sourceDate ? `${fact.sourceDate} 자료의 가격 · 방문 전 확인` : '자료 기준일 미상 · 방문 전 가격 확인' };
    if (existing) Object.assign(existing, item);
    else menus.push({ id: `six_menu_${hash(id + '|' + menuKey(fact))}`, ...item });
    newFacts.push(fact);
  }
  if (!newFacts.length && group.isNew) throw new Error(`No unambiguous menu for new restaurant: ${id}`);
  const sources = new Map((r.menuPriceSources || []).map(s => [s.url + '|' + (s.publishedAt || ''), s]));
  for (const m of newFacts) {
    const key = m.sourceUrl + '|' + m.sourceDate;
    if (!sources.has(key)) sources.set(key, { url: m.sourceUrl, label: '메뉴·가격 공개 자료', ...(m.sourceDate ? { publishedAt: m.sourceDate } : {}) });
  }
  const patch = {
    menus,
    representativeMenu: r.representativeMenu || menus.filter(m => !/소주|맥주|음료|콜키지|주차|주류/.test(m.name)).slice(0, 3).map(m => m.name).join(' · ') || menus[0]?.name || '',
    menuPriceStatus: group.isNew ? 'sourced-price-snapshot' : 'supplemented-price-snapshot',
    menuPriceNote: [r.menuPriceNote, '추가 메뉴는 출처에 게시된 가격 기록입니다. 항목별 자료 날짜를 확인해 주세요. 기준일 미상·과거 가격이 포함되며 현재 영업·가격은 방문 전 확인이 필요합니다.'].filter(Boolean).join(' '),
    menuPriceSources: [...sources.values()],
    // Collection date is not a price effective date. Preserve any existing verification.
    ...(r.menuPriceVerifiedAt ? { menuPriceVerifiedAt: r.menuPriceVerifiedAt } : {}),
  };
  if (group.isNew) output.restaurants.push({ ...r, ...patch });
  else if (newFacts.length) output.patches[id] = patch;
  group.supplementedMenuItems = newFacts.length;
  for (const d of decisions.filter(d => d.restaurantId === id)) {
    d.status = group.isNew ? 'new_restaurant' : newFacts.length ? 'existing_supplement' : d.addedLinks ? 'source_association_only' : 'already_registered';
    d.supplementedMenuItems = newFacts.length;
  }
}
const statuses = {};
for (const d of decisions) statuses[d.status] = (statuses[d.status] || 0) + 1;
const report = {
  asOf, baselineCommit: input.baselineCommit, candidateRows: input.rows.length,
  baselineRestaurants: baseline.restaurants.length,
  newRestaurants: output.restaurants.length,
  existingRestaurantsSupplemented: Object.keys(output.patches).length,
  newSourceLinks: output.sourceLinks.length,
  acceptedCandidateRows: decisions.filter(d => d.restaurantId).length,
  collapsedCandidateDuplicates: decisions.filter(d => d.duplicateOf).length,
  existingRestaurantMatches: new Set(decisions.filter(d => d.restaurantId && !d.newRestaurant).map(d => d.restaurantId)).size,
  newMenuItems: output.restaurants.reduce((n, r) => n + r.menus.length, 0),
  supplementedMenuItems: [...groups.values()].filter(g => !g.isNew).reduce((n, g) => n + g.supplementedMenuItems, 0),
  preservedPrices: Object.fromEntries(baseline.restaurants.filter(r => output.patches[r.id]).map(r => [r.id, (r.menus || []).filter(priceExists).map(m => pick(m, ['name', 'price']))])),
  statuses, decisions,
};
await write(dataPath + 'generated/six-topic-research.generated.json', output);
await write(directory + '/publication.json', report);
if (process.argv.includes('--apply')) {
  const overrides = await read(dataPath + 'restaurant-overrides.json');
  const current = await read(dataPath + 'generated/public-dataset.json');
  const menuSignature = r => JSON.stringify((r?.menus || []).map(m => pick(m, ['name', 'price', 'description'])));
  for (const [id, patch] of Object.entries(output.patches)) {
    const value = menuSignature(current.restaurants.find(r => r.id === id));
    if (![menuSignature(baseline.restaurants.find(r => r.id === id)), menuSignature(patch)].includes(value)) throw new Error(`Menu changed after research baseline; review before applying: ${id}`);
    overrides[id] = { ...overrides[id], ...patch };
  }
  await write(dataPath + 'restaurant-overrides.json', overrides);
}
console.log(JSON.stringify({ ...report, decisions: undefined, preservedPrices: undefined }, null, 2));
