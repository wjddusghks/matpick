# Matpick Content Automation

This document defines the first automation layer for producing Matpick planned-topic content.

## Goal

Build a command-driven pipeline that can:

1. Plan a food topic such as `동탄 맛집 BEST 7`.
2. Search the public web like a researcher instead of using Kakao Place or Naver Place APIs.
3. Extract candidate restaurants, addresses, menus, prices, and real image candidates from cited pages.
4. Cross-check evidence across multiple sources.
5. Produce Matpick-compatible draft data.
6. Render 4:5 card-news assets using real source images after usage review.
7. Save all artifacts under `카드데이터`.

The first implementation creates the draft workspace and research contract. Later workers can fill the draft with browser-collected evidence.

## Content Types

### Episode Content

Examples: `또간집 EP.92`, TV show episodes, YouTube videos with fixed restaurant lists.

Use when the source already decides the restaurants. The automation should collect from the source, extract restaurants, verify details, and link each restaurant back to the episode.

### Planned Topic Content

Examples: `동탄 맛집 BEST 7`, `홍대 라멘 맛집 BEST 4`, `대학로 떡볶이 BEST 3`.

Use when Matpick must decide the topic and restaurant list. The automation should generate search queries, compare public evidence, score candidates, and select restaurants that fit the topic.

## No Place API Policy

Do not depend on Kakao Place API, Naver Place API, or Google Places API for this pipeline.

Allowed sources:

- Search result pages.
- Public blog posts and articles.
- Public Instagram pages or supplied screenshots.
- Restaurant official pages and social accounts.
- Public menu images or posts with clear menu/price evidence.

Every extracted fact must keep evidence:

- `sourceId`
- `sourceUrl`
- `capturedAt`
- `rawText` or `ocrText`
- `confidence`
- `usageStatus` for images

## Draft Folder Contract

Automation drafts are saved to a safe working directory by default:

```text
matpick_all/data-exports/content-automation/<topic-folder>/
  topic.json
  restaurants.json
  sources.json
  image-sources.json
  evidence-report.json
  run-log.json
```

When the workspace is ready to publish or review inside the visual card repository, pass `--out-root`:

```text
카드데이터/_automation-drafts/<topic-folder>/
  topic.json
  restaurants.json
  sources.json
  image-sources.json
  evidence-report.json
  run-log.json
```

After review, a publish step can create:

```text
카드데이터/<topic-folder>/
  메인.png
  1. <식당명>.png
  ...
  topic.json
  restaurants.json
  sources.json
  image-sources.json
  evidence-report.json
```

## Matpick Draft Schema

### Topic

Required fields:

- `id`
- `slug`
- `title`
- `type`: `planned_topic` or `episode`
- `region`
- `targetRestaurantCount`
- `status`
- `seo`
- `searchPlan`
- `restaurantIds`

### Restaurant Candidate

Required fields:

- `id`
- `name`
- `aliases`
- `region`
- `address`
- `category`
- `representativeMenu`
- `lat`
- `lng`
- `menus`
- `imageCandidates`
- `evidence`
- `confidence`
- `reviewStatus`

Use `null` for unknown `lat` and `lng` in drafts. Only publish when address confidence is high enough.

### Menu Candidate

Required fields:

- `name`
- `price`
- `isSignature`
- `sourceId`
- `observedAt`
- `confidence`

Prices change. Always store the source and observed date.

### Image Candidate

Required fields:

- `url`
- `localPath`
- `sourceUrl`
- `platform`
- `author`
- `usageStatus`: `needs-review`, `official`, `licensed`, `own`, or `blocked`
- `caption`
- `capturedAt`

Real images are required for cards, but images should not be auto-published unless usage is cleared or explicitly approved.

## Scoring

### Topic Score

Use this to decide whether a planned topic is worth producing:

- Search demand
- Restaurant candidate count
- Evidence diversity
- Region specificity
- Card-news clarity
- SEO usefulness
- Duplicate-topic risk

### Restaurant Score

Use this to rank candidates:

- Appears in multiple independent sources
- Address evidence matches across sources
- Menu and price evidence exists
- Real image candidate exists
- Fits the topic intent
- Recent evidence exists
- Low advertising or sponsored ambiguity

Recommended thresholds:

- `95+`: can be auto-approved later
- `80-94`: draft and require review
- `<80`: hold

## Cloud Automation Direction

The local script creates drafts. A cloud worker should later run the heavy jobs:

- Browser automation: Playwright worker on Cloud Run, Railway, Fly.io, or a dedicated VM.
- Queue/storage: Postgres/Supabase for jobs and evidence.
- Image storage: Cloudflare R2, S3, or Vercel Blob.
- Scheduled execution: GitHub Actions for short jobs, cloud cron for long browser jobs.

Vercel should continue to host the site. Long-running content research should run outside Vercel serverless functions.

## Initial Command

Create a draft workspace:

```bash
pnpm matpick:research-topic -- --topic "동탄 맛집 BEST 7" --region "경기 화성시 동탄" --count 7
```

Create the draft directly under `카드데이터/_automation-drafts` when the runtime can write there:

```bash
pnpm matpick:research-topic -- --topic "동탄 맛집 BEST 7" --region "경기 화성시 동탄" --count 7 --out-root "../카드데이터/_automation-drafts"
```

The command intentionally does not publish to the live site.
