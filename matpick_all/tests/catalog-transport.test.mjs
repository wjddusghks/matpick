import test from 'node:test';
import assert from 'node:assert/strict';
import {loadAppModules} from '../scripts/load-public-data.mjs';

test('compact catalog restores every menu key and preserves all public restaurant fields', async () => {
  const [built, runtime] = await loadAppModules([
    '/src/data/buildPublicDataset.ts',
    '/src/data/index.ts',
  ]);
  const serialized = JSON.parse(JSON.stringify(built.publicDataset));
  assert.deepEqual(runtime.restaurants, serialized.restaurants);
  assert.deepEqual(runtime.sourceLinks, serialized.sourceLinks);
});
