import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { recordAnalyticsEvent, readAnalyticsSummary } = require('../../api/analytics/_analyticsStore.js');

test('social attribution counts arrivals once and ignores untrusted campaign values', async () => {
  const keys = ['KV_REST_API_URL','KV_REST_API_TOKEN','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'];
  const previous = keys.map(k => process.env[k]);
  keys.forEach(k => delete process.env[k]);
  try {
    const sessionId = `campaign-test-${Date.now()}`;
    const path = '/map?type=query&value=Busan&utm_source=pinterest&utm_medium=social&utm_campaign=korea-food&utm_content=20260929-en-busan';
    const before = await readAnalyticsSummary({scope:'all'});
    await recordAnalyticsEvent({type:'session_start', sessionId, path});
    await recordAnalyticsEvent({type:'session_start', sessionId, path});
    await recordAnalyticsEvent({type:'page_view', sessionId, path});
    await recordAnalyticsEvent({type:'session_start', sessionId:sessionId+'bad', path:'/?utm_source=unknown&utm_content=email%40example.com'});
    const after = await readAnalyticsSummary({scope:'all'});
    const label = 'pinterest / social / korea-food / 20260929-en-busan';
    assert.equal(after.topCampaigns.find(x => x.label === label)?.count, (before.topCampaigns.find(x => x.label === label)?.count || 0) + 1);
    assert.ok(!after.topCampaigns.some(x => x.label.includes('example.com') || x.label.includes('unknown')));
    assert.equal(after.counts.sessions - before.counts.sessions, 2);
  } finally {
    keys.forEach((k,i) => previous[i] === undefined ? delete process.env[k] : process.env[k] = previous[i]);
  }
});

test('Redis attribution uses atomic dedupe and exposes campaign summaries', async () => {
  const oldFetch = globalThis.fetch;
  const keys = ['KV_REST_API_URL','KV_REST_API_TOKEN'];
  const previous = keys.map(k => process.env[k]);
  process.env.KV_REST_API_URL = 'https://redis.example.test';
  process.env.KV_REST_API_TOKEN = 'test-only';
  const commands = [];
  globalThis.fetch = async url => {
    const command = new URL(url).pathname.slice(1).split('/').map(decodeURIComponent);
    commands.push(command);
    const result = command[0] === 'HGETALL' && command[1].endsWith(':campaigns')
      ? ['threads / social / korea-food / en-jeju', '2'] : command[0] === 'HGETALL' ? [] : 1;
    return {ok:true, json:async () => ({result})};
  };
  try {
    await recordAnalyticsEvent({type:'session_start',sessionId:'redis-test',path:'/?utm_source=threads&utm_medium=social&utm_campaign=korea-food&utm_content=en-jeju'});
    const atomic = commands.filter(c => c[0] === 'EVAL');
    assert.equal(atomic.length, 2); // daily and cumulative stores
    assert.ok(atomic.every(c => c[1].includes("added == 1") && c.at(-1) === 'threads / social / korea-food / en-jeju'));
    assert.ok(commands.some(c => c[0] === 'EXPIRE' && c[1].endsWith(':campaigns')));
    const summary = await readAnalyticsSummary({scope:'all'});
    assert.deepEqual(summary.topCampaigns, [{label:'threads / social / korea-food / en-jeju',count:2}]);
  } finally {
    globalThis.fetch = oldFetch;
    keys.forEach((k,i) => previous[i] === undefined ? delete process.env[k] : process.env[k] = previous[i]);
  }
});
