# Matpick

크리에이터 맛집 큐레이션 웹사이트입니다. 유튜브, 인스타그램 등 먹방 크리에이터들이 추천한 맛집을 한곳에 모아서 검색하고 탐색할 수 있습니다.

Matpick is currently set up as a static Vite SPA for Vercel deployment.

## Repository Layout

- App source: `matpick_all/`
- Vercel root wrapper: `/vercel.json`
- Raw data source: `matpick_all/client/src/data/matpick-data.json`
- App data selectors: `matpick_all/client/src/data/index.ts`
- Compatibility shim: `matpick_all/client/src/data/sampleData.ts`

## Local Development

1. Change into `matpick_all/`
2. Copy `.env.example` to `.env`
3. Set `VITE_NAVER_MAP_CLIENT_ID`
4. Run `pnpm install`
5. Run `pnpm dev`

## Data Pipeline

- Raw dataset lives in `matpick_all/client/src/data/matpick-data.json`
- UI-friendly search data is derived in `matpick_all/client/src/data/index.ts`
- `convert_excel_to_json.py` outputs the same JSON shape the app reads
- Recommended output path for imports: `matpick_all/client/src/data/matpick-data.json`
- `corepack pnpm sync:old-korean-100` imports the Excel file, auto-geocodes missing addresses when Naver geocode credentials are present, and rebuilds the generated dataset with persisted coordinates
- `corepack pnpm geocode:old-korean-100` fills and persists missing `lat/lng` into `source-data/old-korean-100/coordinates.json`

## Vercel Deployment

This repository now supports importing the repo root directly in Vercel.

- Build/install commands are delegated to `matpick_all/` through `/vercel.json`
- Output directory is `matpick_all/dist`
- SPA rewrites are already configured

Required manual steps after deploy:

1. Add `VITE_NAVER_MAP_CLIENT_ID` in Vercel Project Settings
2. Register the deployed Vercel domain in Naver Cloud Platform allowed domains

### Production Checklist

Before pushing changes to the production branch:

1. Set the production env vars in Vercel:
   - `VITE_PUBLIC_APP_URL=https://matpick.co.kr`
   - `VITE_NAVER_MAP_CLIENT_ID`
   - `VITE_ADSENSE_CLIENT=ca-pub-...`
   - `VITE_ADSENSE_SLOT_INLINE=...`
2. If you want Excel imports to auto-fill and persist map coordinates:
   - Set `NAVER_MAP_CLIENT_SECRET`
   - Set `NAVER_MAP_CLIENT_ID` or `VITE_NAVER_MAP_CLIENT_ID`
   - Run `corepack pnpm sync:old-korean-100`
   - Commit the updated `source-data/old-korean-100/coordinates.json`
3. Run `corepack pnpm build` inside `matpick_all/`
4. Confirm that `matpick_all/client/public/ads.txt` contains your real AdSense publisher line
5. Confirm that `matpick_all/client/public/sitemap.xml` and prerendered `dist/restaurant/*` pages were regenerated

## Current Demo Scope

- Restaurant and creator data are sample/demo data
- Login is demo-only and stored in the browser
- Favorites are stored in `localStorage`
- Reviews in the restaurant detail page are sample content
