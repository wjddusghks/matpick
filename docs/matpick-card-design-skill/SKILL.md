---
name: matpick-card-design
description: Use when collecting restaurant evidence and creating Matpick 4:5 card-news assets, card data, restaurant data, prompts, and publish plans for homepage marquee cards, topic pages, Instagram-style popups, and map collections.
---

# Matpick Card Design

Use this skill for Matpick content automation: Instagram/source URL research, restaurant extraction, menu/price verification, card image generation, and site-ready data packaging.

## Operating Principles

- Matpick is location-first: every topic must help users find nearby famous restaurants on the map.
- Cards are visual entry points. Structured restaurant data is the source of truth.
- A restaurant can belong to many topics. Do not duplicate the same restaurant as separate entities when name/address match.
- Topic data and restaurant data must be separable:
  - Topic: title, story, card sequence, restaurant order, SEO intent, source relationship.
  - Restaurant: canonical name, category, menu, price, address, coordinates, photos, evidence.
- Do not publish unverified menu prices, addresses, or coordinates as final data.
- Keep old/legacy datasets separate unless the user explicitly asks to merge them into the live site.
- Do not copy Instagram cards, creator designs, real logos, storefront signage, or watermarked images. Use provided/owned images or newly generated visuals.

## Current Matpick Targets

- Card image ratio: `4:5`, recommended `1080x1350`.
- Public card assets: `matpick_all/client/public/card-data/<collection-slug>/`.
- Topic enrichment data: `matpick_all/client/src/data/generated/topic-enrichments/<source-id>.enriched.json`.
- Map collection definitions: `matpick_all/client/src/data/mapCollections.ts`.
- Automation drafts: `matpick_all/data-exports/content-automation/<topic-slug>/`.
- Raw working card folders: `카드데이터/<topic-folder>/`.

## Homepage Placement Rules

- The circular shortcut row near the search box is for large topic/source entrances only.
- Keep this row curated and explicit, for example `또간집` and `인기맛집`.
- Do not use this row for every card collection.
- The homepage marquee below can mix both kinds of content:
  - source/topic-backed cards, such as an `인기맛집` collection
  - general standalone cards, such as a local `동탄 맛집 BEST7` collection
- A source/topic shortcut should open the topic overview page, not a raw restaurant filter list.
- A marquee card should open its own Instagram-style popup and then route to map only for that card's restaurant set.

## Content Types

### Source Topic

Use for repeatable branded/source collections such as `또간집` or `인기맛집`.

- Users first see episode/topic cards.
- Clicking a card opens an Instagram-style popup.
- `지도에서 보기` opens the map with only that topic's restaurants.
- The source may contain many episodes; each episode/card owns an ordered restaurant list.

### General Card Collection

Use for standalone local cards such as `동탄 맛집 BEST7`.

- It can appear in homepage marquee and map collection cards.
- It does not need to be shown as an episode under `인기맛집` unless explicitly grouped there.
- It still needs structured restaurant data and evidence.

### Restaurant Detail

Use when the user opens a restaurant from a map/list/detail page.

- Show canonical restaurant data, not topic copy.
- Show all linked topics/sources as references.
- Menus and prices must include evidence dates when possible.

## Required Restaurant Data

Each restaurant record should include:

```json
{
  "id": "popular_restaurants_dongtan_babwie_saengseon",
  "name": "밥위에생선 동탄호수본점",
  "aliases": ["밥위에생선"],
  "region": "경기 화성시",
  "areaLabel": "동탄",
  "address": "경기 화성시 동탄순환대로5길 5-15 1층 101호",
  "lat": 37.1658837,
  "lng": 127.0992869,
  "category": "일식",
  "representativeMenu": "모듬초밥",
  "menus": [
    {
      "id": "popular_restaurants_dongtan_babwie_saengseon_menu_1",
      "name": "모듬초밥",
      "price": "17,000원",
      "isSignature": true,
      "sourceId": "source_01",
      "observedAt": "2026-05-24",
      "confidence": 90
    }
  ],
  "imageUrl": "/card-data/popular-restaurants/dongtan-babwie-saengseon.webp",
  "seoTags": ["동탄 맛집", "동탄 일식", "화성시 맛집"],
  "evidence": ["source_01", "source_02"],
  "reviewStatus": "approved"
}
```

Use `reviewStatus: "needs-review"` until name, address, coordinates, menu, and price are checked.

## Required Topic Data

Each topic/card collection should include:

```json
{
  "slug": "popular-dongtan-best7",
  "title": "동탄 맛집 BEST7",
  "shortTitle": "동탄 BEST7",
  "sourceId": "popular-restaurants",
  "type": "general_card",
  "region": "경기 화성시 동탄",
  "areaLabel": "동탄",
  "description": "동탄호수공원과 동탄역 근처에서 바로 고르기 좋은 인기 맛집 7곳입니다.",
  "purposeTags": ["동탄", "데이트", "가족"],
  "targetCount": 7,
  "restaurantIds": ["..."],
  "cardImageUrls": ["..."],
  "seo": {
    "title": "동탄 맛집 BEST7 | 맛픽",
    "description": "동탄에서 가볼 만한 인기 맛집 7곳을 메뉴, 가격, 주소, 지도와 함께 정리했습니다.",
    "tags": ["동탄 맛집", "동탄역 맛집", "동탄호수공원 맛집"]
  }
}
```

## Evidence Rules

For every extracted fact, keep source evidence:

- `sourceId`
- `sourceUrl`
- `platform`: `instagram`, `blog`, `official`, `article`, `map-web`, `menu-image`, `other`
- `capturedAt`
- `publishedAt` when visible
- `rawText` or OCR snippet
- `facts`: `restaurant-name`, `address`, `coordinate`, `menu`, `price`, `image`, `source-topic`
- `confidence`: 0-100

Minimum publish thresholds:

- Restaurant name/address: one strong source or two weak sources.
- Coordinates: geocoded from verified address, then checked against visible map/search evidence when possible.
- Menu/price: current menu source preferred; otherwise mark `needs-review`.
- Image: only use provided, owned, official/licensed, or generated image assets.

## Deduplication Rules

- Canonical restaurant key: normalized `name + address`.
- If branch names differ but address is identical, keep one restaurant and add aliases.
- If the same restaurant appears in multiple topics, reuse the existing `restaurant.id`.
- If a menu price differs by source/date, keep the newest reliable price and record older evidence in notes.
- If a restaurant has moved or closed, do not publish until reviewed.

## Card Design Rules

- All production cards use `4:5` portrait.
- Use one card per file. Do not create contact sheets.
- Keep text readable at mobile size.
- Use small radius on card corners; avoid excessive rounded UI.
- No `CATCHABLE` label.
- No fake likes, fake awards, fake creator handles, QR codes, watermarks, or unrelated text.
- Topic cover card should explain the collection. Restaurant cards should focus on one restaurant.
- Address is secondary. Full address lives in structured data.
- Restaurant card visual should match the representative menu.
- If real food photos are not cleared, generate new food visuals based on verified menu information.

### Matpick Editorial 4:5

Default style for homepage and topic cards.

- Warm white or soft light background.
- Coral accent from Matpick branding.
- Strong black Korean headline.
- Food image occupies about 55-70% of the card.
- Bottom area contains restaurant name, menu/price, and small address.

### Dark Social 4:5

Use for Instagram-style popup cards or night/trending content.

- Charcoal background.
- Large white Korean title.
- Coral action chips.
- High-contrast food image.
- Keep the action UI in the app, not baked into the image.

### Local Guide 4:5

Use for region-first list cards.

- Area label and count must be visible.
- Use map-pin/location motif lightly.
- Do not make the card look like a map screenshot.

### Food Close-up 4:5

Use for restaurant-specific cards.

- Menu photo or generated menu visual is the hero.
- Restaurant name is prominent.
- Price and address remain smaller.

## Card Text Slots

Topic cover card:

```json
{
  "eyebrow": "동탄에서 뭐 먹을지 고를 때",
  "title": "동탄 맛집 BEST7",
  "subtitle": "동탄호수공원과 동탄역 근처 인기 맛집을 모았습니다.",
  "chips": ["동탄", "데이트", "가족"]
}
```

Restaurant card:

```json
{
  "rank": 1,
  "title": "밥위에생선",
  "subtitle": "모듬초밥 17,000원",
  "addressLine": "경기 화성시 동탄순환대로5길"
}
```

## Image Prompt Template

Use this shape when generating a card image:

```text
Create one 4:5 portrait Matpick Korean food card, 1080x1350.
Style: Matpick Editorial 4:5, warm white background, coral accents, bold readable Hangul.
Purpose: restaurant card for a local restaurant guide.
Exact text:
Title: "<restaurant name>"
Subtitle: "<representative menu> <price>"
Small address: "<short address>"
Visual: realistic generated food photography of <representative menu description>.
Rules: no logos, no watermarks, no QR codes, no creator handle, no fake awards, no copied storefront, no extra restaurant names, no extra prices, no unreadable Hangul.
```

If the user supplied original card images, edit/regenerate to the same `4:5` ratio while preserving the intended topic, not necessarily every pixel.

## Automation Workflow

1. Input
   - Accept Instagram/source URL, topic title, region, expected count, or an existing `카드데이터` folder.
2. Research
   - Extract candidate restaurant names, addresses, menus, prices, and image clues.
   - Store all raw evidence before normalizing.
3. Verify
   - Cross-check restaurant name/address/menu/price.
   - Geocode only after address confidence is high.
4. Normalize
   - Create canonical restaurant records.
   - Link restaurants to one or more topics.
5. Card Plan
   - Create cover card and one restaurant card per restaurant.
   - Select style and text slots.
6. Generate Assets
   - Generate or edit individual `4:5` card files.
   - Save final assets under `matpick_all/client/public/card-data/<collection-slug>/`.
7. Publish Draft
   - Update or prepare topic enrichment JSON.
   - Update or prepare `mapCollections.ts` entries.
   - Keep draft evidence reports for review.
8. QA
   - Check card ratio, text overflow, image usage status, restaurant count, map route, popup comments UI, and mobile layout.

## Local Preparation Command

From `matpick_all`, create a card automation draft:

```bash
pnpm matpick:prepare-card-topic -- --topic "동탄 맛집 BEST7" --slug popular-dongtan-best7 --region "경기 화성시 동탄" --count 7 --card-folder "../카드데이터/동탄맛집BEST7"
```

This command prepares:

- `topic.json`
- `restaurants.json`
- `sources.json`
- `card-spec.json`
- `card-prompts.json`
- `publish-plan.json`
- `run-log.json`

It does not publish to the live site by itself.

## Publish Checklist

Before committing:

- Every final image is `4:5`.
- Card text matches structured data.
- No banned labels such as `CATCHABLE`.
- Restaurant count equals the topic count.
- Restaurant IDs are stable and deduplicated.
- Menu and price have source evidence and observation date.
- Coordinates exist for map display.
- `cardImageUrls` resolve in the browser.
- The map collection shows only the intended restaurants.
- Comment popup and Instagram-style modal still work.
- TypeScript check passes.
