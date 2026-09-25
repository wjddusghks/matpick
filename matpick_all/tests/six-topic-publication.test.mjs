import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeName, sameIdentity, safeSourceUrl } from '../../scripts/topic-publication/identity.mjs';

const json = file => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
const batch = json('../client/src/data/generated/six-topic-research.generated.json');
const data = json('../client/src/data/generated/public-dataset.json');
const input = json('../../source-data/six-topic-publication-2026-09-25/observations.json');
const report = json('../../source-data/six-topic-publication-2026-09-25/publication.json');
const deleted = json('../client/src/data/restaurant-permanent-deletions.json').restaurants;
const observations = new Map(input.rows.map(r => [r.key, r]));
const decisions = new Map(report.decisions.map(r => [r.key, r]));
const restaurants = new Map(data.restaurants.map(r => [r.id, r]));

test('six-topic publication accounts for every candidate and preserves review holds', () => {
  assert.equal(input.rows.length, 1772);
  assert.equal(decisions.size, input.rows.length);
  for (const r of input.rows) {
    const decision = decisions.get(r.key);
    assert.ok(decision, r.key);
    if (!r.status.startsWith('matched_priced') || r.priceDisagreement)
      assert.equal(decision.restaurantId, undefined, r.key);
    if (decision.restaurantId) {
      assert.ok(restaurants.has(decision.restaurantId), r.key);
      if (decision.duplicateOf)
        assert.equal(decision.restaurantId, decisions.get(decision.duplicateOf).restaurantId);
    }
  }
  assert.equal(data.restaurants.length, report.baselineRestaurants + report.newRestaurants);
  assert.equal(new Set(batch.restaurants.map(r => r.id)).size, batch.restaurants.length);
  assert.equal(batch.restaurants.length, report.newRestaurants);
});

test('new places have domestic map coordinates, no duplicate map IDs and no deleted identities', () => {
  for (const r of batch.restaurants) {
    assert.ok(r.lat > 33 && r.lat < 39 && r.lng > 124 && r.lng < 132, r.name);
    assert.ok(r.locationSourceUrls?.every(safeSourceUrl), r.name);
    assert.ok(!deleted.some(d => d.id === r.id || sameIdentity(r, d)), r.name);
    if (r.kakaoPlaceId) assert.equal(data.restaurants.filter(p => p.kakaoPlaceId === r.kakaoPlaceId).length, 1, r.name);
    const current = restaurants.get(r.id);
    const sourcePlaces = report.decisions.filter(d => d.restaurantId === r.id).flatMap(d => {
      const row = observations.get(d.key);
      return [row.place, ...(row.candidates || [])];
    });
    assert.ok(sourcePlaces.some(p => p.kakaoPlaceId === r.kakaoPlaceId && p.address === r.address && p.lat === r.lat && p.lng === r.lng), r.name);
    assert.equal(current.address, r.address);
    assert.equal(current.lat, Number(r.lat.toFixed(6)));
    assert.equal(current.lng, Number(r.lng.toFixed(6)));
  }
  for (const link of batch.sourceLinks) {
    assert.match(link.sourceUrl, /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/);
    assert.ok(data.sourceLinks.some(l => l.restaurantId === link.restaurantId && l.sourceId === link.sourceId && l.sourceUrl === link.sourceUrl), link.id);
  }
});

test('published prices have branch-associated non-AI evidence and retain source-date qualifications', () => {
  for (const r of batch.restaurants) {
    const facts = report.decisions.filter(d => d.restaurantId === r.id).flatMap(d => observations.get(d.key).menus || []);
    const keys = r.menus.map(m => normalizeName(m.name));
    assert.equal(new Set(keys).size, keys.length, r.name);
    for (const menu of r.menus) {
      const fact = facts.find(m => normalizeName(m.name) === normalizeName(menu.name) && m.price === menu.price && !m.sourceAiAssisted && safeSourceUrl(m.sourceUrl));
      assert.ok(fact, `${r.name}: ${menu.name}`);
      assert.ok(menu.description.includes(fact.sourceDate || '기준일 미상'), r.name);
    }
    assert.equal(r.menuPriceVerifiedAt, undefined, 'Lookup date must not become price verification date');
  }
  for (const [id, prices] of Object.entries(report.preservedPrices)) {
    const current = restaurants.get(id);
    for (const menu of prices)
      assert.ok(current.menus.some(m => m.name === menu.name && m.price === menu.price), `${id}: preserve ${menu.name}`);
  }
});
