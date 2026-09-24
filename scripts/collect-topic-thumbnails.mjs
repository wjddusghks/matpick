import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'matpick_all/client/public/source-covers');
const researchDir = path.join(root, 'source-data/topic-thumbnails-2026-09-24');
const env = await fs.readFile(path.join(root, 'source-data/topic-census-2026-09-22/.env.local'), 'utf8');
const key = env.match(/^YOUTUBE_DATA_API_KEY\s*=\s*["']?([^\s"']+)/m)?.[1];
assert.ok(key, 'YouTube credential is not configured');
const channels = [
  ['seommaeul-hoontae', 'UCkBoDzncl64EZ-Ggh4g5pCw'],
  ['meatking', 'UC1oXmhvYHVI2bApphh3IzuQ'],
  ['hoesarang', 'UCoLPofyAZuuq6v4EWrWRguw'],
  ['tteokbokkiqueen', 'UCAoyR-sL6B0S93AMR-HVTvg'],
  ['choiza-road', 'UCYdUe6y0F8TQS6siNVS7QMw'],
  ['the-dudley', 'UCmJEpV4hLzGWLU5rrdOHMhQ'],
];
// One metadata request for all six channels. The credential is never logged or saved.
const url = new URL('https://www.googleapis.com/youtube/v3/channels');
url.searchParams.set('part', 'snippet');
url.searchParams.set('id', channels.map(([, id]) => id).join(','));
url.searchParams.set('key', key);
let response;
try { response = await fetch(url, {signal: AbortSignal.timeout(30000)}); }
catch { throw new Error('YouTube metadata network request failed'); }
if (!response.ok) throw new Error(`YouTube metadata returned ${response.status}`);
const metadata = await response.json();
const items = new Map(metadata.items.map(item => [item.id, item]));
const results = [];
for (const [slug, id] of channels) {
  const item = items.get(id);
  assert.ok(item, `Channel not returned: ${slug}`);
  const assetUrl = item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.high.url;
  const image = await fetch(assetUrl, {signal: AbortSignal.timeout(30000)});
  assert.ok(image.ok && image.headers.get('content-type')?.startsWith('image/'), `Invalid image: ${slug}`);
  const ext = image.headers.get('content-type').includes('png') ? 'png' : 'jpg';
  const filename = `${slug}.${ext}`;
  const bytes = Buffer.from(await image.arrayBuffer());
  await fs.writeFile(path.join(out, filename), bytes);
  results.push({id: slug, title: item.snippet.title, channelId: id,
    sourceUrl: `https://www.youtube.com/channel/${id}`, assetUrl,
    imageUrl: `/source-covers/${filename}`, checkedAt: '2026-09-24', bytes: bytes.length});
}
await fs.mkdir(researchDir, {recursive: true});
await fs.writeFile(path.join(researchDir, 'youtube.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results.map(({id, title, bytes}) => ({id, title, bytes}))));
