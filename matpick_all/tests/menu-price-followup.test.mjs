import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { buildPriceFollowupPatch } from '../../scripts/menu-research/price-followup.mjs';

const evidence = JSON.parse(await fs.readFile(new URL('../../source-data/menu-price-followup-2026-09-21/price-evidence-70.json', import.meta.url), 'utf8'));
test('all 70 records retain provenance; unresolved candidates never become a current price', () => {
  assert.equal(evidence.restaurants.length, 70);
  for (const row of evidence.restaurants) {
    const patch = buildPriceFollowupPatch(row);
    assert.ok(row.sources.length || row.mapEvidence.length, row.id);
    if (patch.menus) assert.ok(patch.menuPriceSources.length, row.id);
    if (!patch.menus) assert.equal(patch.menuPriceVerifiedAt, undefined, row.id);
    if (row.status === 'delivery_price_only') assert.equal(patch.menus, undefined);
  }
});
test('a different address or floor cannot publish an otherwise priced menu', () => {
  const row = structuredClone(evidence.restaurants.find(r => r.name === '기와강'));
  assert.ok(buildPriceFollowupPatch(row).menus.length);
  row.mapEvidence[0].place.address = '서울 강남구 논현로152길 9 5층';
  assert.equal(buildPriceFollowupPatch(row).menus, undefined);
});
test('service fees and empty prices do not become meal prices', () => {
  const row = structuredClone(evidence.restaurants.find(r => r.name === '기와강'));
  row.menus.push({ ...row.menus[0], name: '상차림비', price: '30,000원' });
  row.menus.push({ ...row.menus[0], name: '계절 메뉴', price: undefined });
  const menus = buildPriceFollowupPatch(row).menus;
  assert.ok(!menus.some(m => m.name === '상차림비'));
  assert.equal(menus.find(m => m.name === '계절 메뉴').price, undefined);
});
