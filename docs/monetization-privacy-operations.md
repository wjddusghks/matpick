# Matpick Monetization, Privacy, and Cost Operations

Updated: 2026-07-14

## AdSense rejection assessment

The rejection email was not available during this audit, so the cause below is an inference rather than a confirmed Google decision.

Most likely causes in the previous deployment:

1. SPA route HTML contained an empty `#root`, so a crawler that did not fully execute JavaScript saw metadata but no useful page body.
2. Many routes depended mainly on card images and short directory fields, with limited original editorial context.
3. About, privacy, terms, and contact pages were too brief for the actual account, analytics, advertising, and review features.
4. The AdSense script could be inserted by both prerendering and the React runtime, while the visible slot was unfilled.
5. No working site-level privacy choice was connected to Google/Meta measurement or ad loading.

`https://matpick.co.kr/ads.txt` was valid during the audit. It is not the likely rejection cause.

Code changes made for the next review:

- Prerender substantive, route-specific text and internal links for home, topics, episodes, creators, and restaurant pages.
- Include address, category, representative menu, operating status, and source context in restaurant HTML.
- Expand editorial methodology, image provenance, privacy, terms, and private rights-request guidance.
- Keep only the static AdSense account meta tag in prerendered HTML; load the SDK once after advertising permission.
- Hide unfilled AdSense slots and defer ad providers until close to the viewport.

Before requesting another review:

1. Wait until the production deployment and sitemap have been recrawled.
2. Test page source for `/`, `/about`, several topic pages, and several restaurant pages in Search Console URL Inspection.
3. Confirm every important route has useful text without relying on JavaScript.
4. In AdSense Privacy & messaging, enable a Google-certified CMP for the EEA, UK, and Switzerland. The in-site preference panel does not replace Google's certified-CMP requirement.
5. Review the exact rejection reason shown in AdSense and resolve any account-specific policy item before resubmitting.

Official references:

- https://support.google.com/adsense/answer/81904
- https://support.google.com/adsense/answer/7299563
- https://support.google.com/adsense/answer/10502938
- https://support.google.com/adsense/answer/13554020

## Revenue placement rules

- Home: one deferred Kakao AdFit placement and one Coupang Partners placement after the primary discovery content.
- Explore: Kakao near the collection header, Coupang after item 12, and AdSense after item 24.
- Restaurant and creator details: Kakao plus Coupang after the core content.
- Reviews: Kakao near the feed start, AdSense after item 12, and Coupang in the supporting column.
- Map: retain one compact Kakao AdFit placement; do not obscure map controls or search results.

Do not add ads that mimic restaurant cards, ask users to click, cover navigation, or create accidental clicks. Revenue should be compared by provider, route, mobile/desktop viewport, filled impressions, and outbound affiliate clicks, not by raw slot count.

Account checks:

- Confirm every Kakao AdFit unit is approved for `matpick.co.kr` and that desktop/mobile dimensions match the configured unit.
- Confirm the Coupang dynamic banner ID and tracking code belong to the active Partners account.
- Keep the required Coupang commission disclosure visible with every fallback or dynamic banner.
- Confirm Vercel production variables for all ad IDs after deployment.

## Privacy and legal operations

Implemented in code:

- Optional analytics and advertising remain off until the visitor makes a choice.
- Choices can be reopened from the footer and privacy page.
- First-party analytics, Google tags, Meta Pixel, AdSense, AdFit, and Coupang slots follow the saved choice.
- Privacy policy states actual data categories, purposes, 45-day analytics retention, 180-day member metric retention, service providers, international processing, rights, security controls, and the effective date.
- Terms cover user content, card artwork, scraping, ads, affiliates, corrections, takedowns, and limitations.

Owner action still required:

1. Add the operator's legal name or business name, business address, privacy officer name, and a monitored email/telephone number when available. Do not invent these values in code.
2. Verify the final policy with Korean counsel for the operator's business type, registration status, and actual vendor contracts.
3. Keep records of deletion, correction, copyright, and privacy requests received through the private contact channel.
4. Review vendor data-processing and international-transfer terms whenever Google, Meta, Vercel, Upstash, NAVER, Kakao, or Coupang settings change.

## Image protection

Public browser images cannot be made impossible to copy: every displayed image must reach the visitor's device and can be captured. Current controls are practical deterrents:

- Same-origin resource policy and image-specific anti-indexing headers.
- Search crawler disallow rules for card/source image directories.
- Context-menu, drag, and mobile touch-callout suppression on protected images.
- Terms prohibiting bulk copying, redistribution, resale, and scraping.

Do not move public card images behind a signed Vercel function only for anti-copying. It would increase function and transfer cost without preventing screenshots or browser-network capture. Use private signed storage only for genuinely private originals that are never rendered publicly.

## Vercel and map cost controls

Implemented:

- One-year immutable caching for hashed Vite assets.
- Seven-day browser/CDN caching for stable restaurant card directories.
- Deferred ad loading and a reduced home marquee sample of 18 unique cards.
- Removed the unused NAVER Maps geocoder submodule.
- Removed build-time sitemap timestamps that changed every URL on every deployment.

Recommended console and future work:

1. Enable Vercel spend alerts and review Fast Data Transfer, Image Optimization, and Function Invocations weekly.
2. Restrict NAVER Maps client IDs to production domains, set usage alerts, and disable unused map APIs.
3. Convert the largest PNG/JPEG cards to WebP or AVIF in a controlled migration while preserving dimensions and visual quality.
4. Split the roughly 5 MB application bundle by route and large dataset so visitors do not download admin and unrelated topic code on the first page.
5. Batch first-party analytics events if function invocation volume becomes material.
6. Keep maps route-scoped; do not load the NAVER SDK on list or detail pages that only need external map links.

Official references:

- https://vercel.com/docs/caching/cache-control-headers
- https://vercel.com/docs/caching/cdn-cache
- https://guide.ncloud-docs.com/docs/en/maps-overview
