import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// Pure validation: this script never publishes or edits platform state.
export function validateContent(post) {
  const problems = [];
  const allowed = { instagram: 'matpick.co.kr', naver_blog: 'nasa1769' };
  if (!allowed[post.channel] || post.account !== allowed[post.channel]) problems.push('Unapproved channel/account');
  if (!['ko', 'en'].includes(post.language)) problems.push('Language must be ko or en');
  if (!post.contentId) problems.push('Missing contentId');
  const text = `${post.title || ''}\n${post.body || ''}`;
  const tags = Array.isArray(post.hashtags) ? post.hashtags : [];
  if (!post.body?.trim()) problems.push('Missing body');
  if (!tags.length || tags.some(tag => !/^#[\p{L}\p{N}_]+$/u.test(tag))) problems.push('Missing or invalid hashtags');
  if (new Set(tags.map(tag => tag.toLowerCase())).size !== tags.length) problems.push('Duplicate hashtags');
  if (post.channel === 'instagram' && (tags.length < 3 || tags.length > 5)) problems.push('Instagram editorial range: 3–5 tags; check live platform limit');
  if (post.channel === 'naver_blog' && (tags.length < 5 || tags.length > 10)) problems.push('Naver editorial range: 5–10 tags');
  if (!tags.some(tag => /^#(matpick|맛픽)$/i.test(tag))) problems.push('Missing Matpick brand tag');
  if (post.channel === 'naver_blog' && post.language === 'en' && tags.some(tag => !/^#[A-Za-z0-9_]+$/.test(tag))) problems.push('English blog posts require English-only hashtags');
  if (post.channel === 'naver_blog' && post.language === 'ko' && tags.some(tag => !/^#[가-힣0-9_]+$/.test(tag))) problems.push('Korean blog posts require Korean-only hashtags');
  if (/다이닝\s*코드|dining\s*code|테이블링|tabling|망고플레이트|mangoplate/i.test(text)) problems.push('Competitor service name in public copy; keep evidence in internal sources');
  if (post.language === 'en' && !(/Matpick/i.test(text) && /Korean/i.test(text) && /YouTube/i.test(text) && /TV|television/i.test(text))) problems.push('English post needs the Matpick Korean-language YouTube/TV explanation');
  if (!post.sourcesFile) problems.push('Missing internal evidence file');
  if (!post.factsCheckedAt || Number.isNaN(Date.parse(post.factsCheckedAt))) problems.push('Missing/invalid fact-check date');
  if (post.aiIllustration && !/AI|인공지능/.test(text)) problems.push('Disclose the AI illustration');
  if (post.scheduledAt && !/T11:00:00\+09:00$/.test(post.scheduledAt)) problems.push('Scheduled time must remain 11:00 KST unless user changes it');
  return { valid: problems.length === 0, problems };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) throw new Error('Use: node validate-content.mjs post-manifest.json');
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  const posts = Array.isArray(payload) ? payload : [payload];
  const results = posts.map(post => ({ contentId: post.contentId, ...validateContent(post) }));
  console.log(JSON.stringify(results, null, 2));
  if (results.some(result => !result.valid)) process.exitCode = 1;
}
