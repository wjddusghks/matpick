import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {loadAppModules, projectRoot} from '../scripts/load-public-data.mjs';
const [data, policy] = await loadAppModules(['/src/data/index.ts', '/src/data/permanentRestaurantDeletions.ts']);
const deleted = JSON.parse(await fs.readFile(path.join(projectRoot, 'client/src/data/restaurant-permanent-deletions.json'), 'utf8'));
test('owner-deleted listings disappear from details, source lists and aliases', () => {
  assert.equal(deleted.restaurants.length, 72);
  for (const row of deleted.restaurants) {
    assert.equal(data.getRestaurantById(row.id), null, row.id);
    assert.ok(!data.sourceLinks.some(link => link.restaurantId === row.id));
    assert.ok(!Object.values(data.restaurantAliases).includes(row.id));
  }
});

test('the remaining 55 are removed while all newly priced and address-review records are preserved', async () => {
  const report = JSON.parse(await fs.readFile(path.join(projectRoot, '../source-data/blog-followup-2026-09-24/report.json'), 'utf8'));
  const remaining = report.rows.filter(row => ['price_identity', 'names_only'].includes(row.category) && !row.menuApplied);
  assert.equal(remaining.length, 55);
  const requestedIds = new Set(remaining.map(row => row.id));
  assert.deepEqual(new Set(deleted.restaurants.filter(row => row.reason === 'owner_requested_unresolved_menu_removal').map(row => row.id)), requestedIds);
  for (const row of report.rows) {
    assert.equal(data.getRestaurantById(row.id) === null, requestedIds.has(row.id), row.name);
  }
});
test('a later feed with a different ID cannot restore the same deleted location', () => {
  const row = deleted.restaurants.find(row => row.address !== '-');
  const seed = { creators: [], restaurants: [{ ...row, id: 'reimport', region: '' }, { id: 'other-branch', name: row.name, address: '다른 지점 주소', region: '' }], visits: [], sourceLinks: [{ restaurantId: 'reimport', sourceId: 'new-topic' }], restaurantAliases: { 'old-alias': 'reimport' } };
  const result = policy.removePermanentlyDeletedRestaurants(seed);
  assert.deepEqual(result.restaurants.map(row => row.id), ['other-branch']);
  assert.deepEqual(result.sourceLinks, []);
  assert.deepEqual(result.restaurantAliases, {});
});

test('markets stay removed when reimported with addresses, without deleting individual stalls', () => {
  const restaurants = [
    { id: 'market1', name: '고현시장', address: '경남 거제시 거제중앙로17길 6', region: '경남 거제시' },
    { id: 'market2', name: '서울 망원시장', address: '서울 마포구 망원로8길 7', region: '서울 마포구' },
    { id: 'market3', name: '문산자유시장', address: '경기 파주시 문산읍 문향로 57', region: '경기 파주시' },
    { id: 'stall', name: '망원시장 떡집', address: '서울 마포구 망원로8길 7', region: '서울 마포구' },
  ];
  const result = policy.removePermanentlyDeletedRestaurants({creators: [], restaurants, visits: []});
  assert.deepEqual(result.restaurants.map(row => row.id), ['stall']);
});
