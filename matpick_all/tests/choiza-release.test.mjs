import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { distance, sameGeocodeAddress } from '../../scripts/coordinate-audit.mjs';
import { isDeleted } from '../../scripts/verify-requested-topics.mjs';
const json = p => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const data = json('../client/src/data/generated/public-dataset.json');
const audit = json('../../source-data/location-release-audit-2026-09-24/coordinate-audit.json');
const batch = json('../client/src/data/generated/choiza-road.generated.json');
const verified = json('../../source-data/choiza-complete-2026-09-24/verification.json');
const publication = json('../../source-data/choiza-complete-2026-09-24/publication.json');
test('release coordinate audit covers every public row and holds unresolved locations', () => {
  assert.equal(audit.complete, true);
  assert.deepEqual(new Set(audit.records.map(r => r.id)), new Set(data.restaurants.map(r => r.id)));
  for (const r of data.restaurants) {
    const checked = audit.records.find(c => c.id === r.id);
    assert.equal(checked.address, r.address, r.id);
    assert.ok(distance(checked.before, r) < 1, r.name);
    if (checked.status !== 'coordinate_consistent') assert.ok(r.recommendationHold, r.name);
  }
  const on = data.restaurants.find(r => r.id === 'topic_enrichment_michelin-selected_c83cbdf6e43e');
  assert.ok(sameGeocodeAddress(on.address, '서울 강남구 도산대로92길 42'));
  assert.ok(distance(on, { lat: 37.5219845095712, lng: 127.049395293191 }) < 1);
});
test('published Choiza restaurants have matched current places, priced menus and explicit episode evidence', () => {
  const deleted = json('../client/src/data/restaurant-permanent-deletions.json').restaurants;
  for (const r of batch.restaurants) {
    assert.ok(!isDeleted(r, deleted), r.name);
    assert.ok(r.menus.length && r.menus.some(m => /[1-9]/.test(m.price)), r.name);
    assert.ok(r.menuPriceSources.every(s => s.url === r.placeUrl));
    assert.ok(verified.records.some(v => v.status === 'verified' && !v.holdReason && v.place.id === r.kakaoPlaceId && v.place.status === 'Y' && sameGeocodeAddress(v.place.address, r.address) && distance(v.place, r) < 1), r.name);
  }
  for (const link of batch.sourceLinks) {
    const decision = publication.decisions.find(d => d.status === 'published' && d.restaurantId === link.restaurantId && verified.records.find(v => v.key === d.key)?.sourceUrl === link.sourceUrl);
    assert.ok(decision, link.id);
    assert.ok(data.sourceLinks.some(l => l.id === link.id));
    assert.ok(Number.isInteger(link.episodeNumber) || /특별편/.test(link.label));
  }
  for (const d of publication.decisions.filter(d => d.status !== 'published')) {
    const v = verified.records.find(r => r.key === d.key);
    assert.ok(!batch.sourceLinks.some(l => l.sourceUrl === v.sourceUrl && l.restaurantId === d.restaurantId), d.name);
  }
});
