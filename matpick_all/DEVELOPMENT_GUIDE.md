# 맛픽 (Matpick) 개발 가이드

> 이 문서는 ChatGPT Codex 또는 다른 AI 코딩 에이전트가 맛픽 프로젝트의 남은 개발을 원활하게 진행할 수 있도록 작성된 가이드입니다.

---

## 1. 프로젝트 개요

**맛픽(Matpick)**은 유튜브/인스타 크리에이터들이 방문한 맛집을 한곳에서 검색하고 지도에서 확인할 수 있는 웹 서비스입니다. 현재 프론트엔드 전용(Static SPA)으로 구현되어 있으며, 원본 데이터는 `client/src/data/matpick-data.json`에서 읽고, 앱용 셀렉터/검색 데이터는 `client/src/data/index.ts`에서 파생 생성합니다.

### 핵심 기능

| 기능 | 설명 | 상태 |
|------|------|:----:|
| 메인 검색 | 크리에이터/식당/지역/음식 통합 검색 (인스타그램 스타일 드롭다운) | 완료 |
| 네이버 지도 | 식당 위치 마커 표시, fitBounds 자동 줌 | 완료 |
| 식당 상세 페이지 | 카테고리, 대표메뉴, 주소, 크리에이터 영상, 리뷰 탭 | 완료 |
| 크리에이터 상세 페이지 | 프로필, 추천 식당 목록, 영상 목록 | 완료 |
| 탐색(Explore) 페이지 | 전체 크리에이터/식당 탐색 | 완료 |
| 찜하기(하트) | 로그인 사용자 전용, localStorage 기반, 하트 애니메이션 | 완료 |
| 찜 목록 페이지 | /my/favorites에서 찜한 식당 확인 | 완료 |
| 해외 맛집 처리 | 해외 식당은 "지도에서 제공하지 않습니다" 안내 표시 | 완료 |
| 로그인 | 시뮬레이션 로그인 (클릭 시 즉시 로그인) | 임시 구현 |

---

## 2. 기술 스택

| 항목 | 기술 |
|------|------|
| 프레임워크 | React 19 + TypeScript |
| 빌드 도구 | Vite 7 |
| 스타일링 | Tailwind CSS 4 + shadcn/ui |
| 라우팅 | Wouter |
| 지도 | 네이버 지도 API v3 (ncpClientId: `8f5ylcex7n`) |
| 상태 관리 | React Context (Auth, Favorites, Theme) |
| 애니메이션 | Framer Motion |
| 토스트 | Sonner |
| 패키지 관리 | pnpm |
| 배포 | Vercel (Static SPA) |

---

## 3. 프로젝트 구조

```
matpick-web/
├── client/
│   ├── index.html                    # 진입점 HTML (네이버 지도 SDK 로드)
│   ├── public/                       # 정적 파일 (favicon 등)
│   └── src/
│       ├── App.tsx                   # 라우팅 + Provider 래핑
│       ├── main.tsx                  # React 엔트리포인트
│       ├── index.css                 # 글로벌 스타일 + Tailwind 테마 변수
│       ├── components/
│       │   ├── NaverMap.tsx          # ★ 네이버 지도 컴포넌트 (SDK 로딩 대기, 마커, fitBounds)
│       │   ├── HeartButton.tsx       # ★ 찜하기 하트 버튼 (애니메이션)
│       │   ├── RestaurantCard.tsx    # 식당 카드 컴포넌트
│       │   ├── Header.tsx            # 공통 헤더
│       │   ├── ErrorBoundary.tsx     # 에러 바운더리
│       │   # Map.tsx, ManusDialog.tsx는 제거됨 (Manus 전용)
│       │   └── ui/                   # shadcn/ui 컴포넌트들
│       ├── contexts/
│       │   ├── AuthContext.tsx        # ★ 로그인 상태 관리 (현재 시뮬레이션)
│       │   ├── FavoritesContext.tsx   # ★ 찜하기 데이터 관리 (localStorage)
│       │   └── ThemeContext.tsx       # 다크/라이트 테마
│       ├── data/
│       │   └── sampleData.ts         # ★★★ 핵심 데이터 파일 (10,439줄)
│       ├── pages/
│       │   ├── Home.tsx              # 메인 페이지 (검색)
│       │   ├── SearchMap.tsx         # 지도 검색 결과 페이지
│       │   ├── RestaurantDetail.tsx  # 식당 상세 페이지
│       │   ├── CreatorDetail.tsx     # 크리에이터 상세 페이지
│       │   ├── Explore.tsx           # 탐색 페이지
│       │   ├── MyFavorites.tsx       # 찜 목록 페이지
│       │   └── NotFound.tsx          # 404 페이지
│       ├── hooks/                    # 커스텀 훅
│       ├── lib/                      # 유틸리티
│       └── types/
│           └── naver-maps.d.ts       # 네이버 지도 타입 정의
├── vercel.json                       # Vercel 배포 설정
├── package.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts                    # Vite 설정 (Vercel용으로 정리됨)
```

---

## 4. 데이터 구조 (sampleData.ts)

### 4.1 인터페이스 정의

```typescript
// 검색 아이템 (메인 검색 드롭다운용)
interface SearchItem {
  id: string;
  type: "creator" | "region" | "food" | "restaurant";
  name: string;
  subtitle: string;
  icon: string;
}

// 크리에이터 (유튜브 채널)
interface Creator {
  id: string;          // 유튜브 채널 ID (예: "UCrDMtdCSMTGVmUKvuhcahRw")
  name: string;        // 크리에이터 이름 (예: "풍자")
  channelName: string; // 채널명 (예: "스튜디오수제")
  profileImage: string;
  subscribers: string;
  description: string;
  youtubeUrl: string;
  series: string;      // 시리즈명 (예: "또간집")
}

// 식당
interface Restaurant {
  id: string;              // "r_" + 해시 (예: "r_7a84be46")
  name: string;            // 식당명
  region: string;          // 지역 (예: "서울 마포구 연남동")
  address: string;         // 도로명 주소
  category: string;        // 카테고리 (예: "양식", "한식", "일식")
  representativeMenu: string; // 대표 메뉴 (예: "쿼터 피자 / 페퍼로니")
  lat: number;             // 위도 (0이면 미확인)
  lng: number;             // 경도 (0이면 미확인)
  imageUrl: string;        // 식당 이미지 URL
  isOverseas?: boolean;    // 해외 식당 여부
}

// 방문 기록 (크리에이터 ↔ 식당 매핑)
interface Visit {
  id: string;              // "v_" + 해시
  restaurantId: string;    // Restaurant.id 참조
  creatorId: string;       // Creator.id 참조
  videoId: string;         // 유튜브 영상 ID
  videoUrl: string;        // 유튜브 영상 URL
  videoTitle: string;      // 영상 제목 (한글)
  visitDate: string;       // 방문/업로드 날짜
  episode: string;         // 에피소드 번호 (예: "EP.1")
  rating: string;          // 평점 (미사용)
  comment: string;         // 코멘트 (미사용)
  thumbnailUrl: string;    // 유튜브 썸네일 URL
  series: string;          // 시리즈명
}
```

### 4.2 현재 데이터 현황

| 시리즈 | 크리에이터 | Visit 수 | 비고 |
|--------|-----------|:--------:|------|
| 또간집 | 풍자 (UCrDMtdCSMTGVmUKvuhcahRw) | 97 | EP.0~EP.95, 나무위키 기반 검증 완료 |
| 먹을텐데 | 성시경 (UCfpaSruWW3S4dibonKXENjA) | 164 | 데이터 미검증, 영상 제목 영어 |
| 맛있는 녀석들 | (UCT-eNSaIVbeFnMhOLPDBGhg) | 65 | 데이터 미검증, 영상 제목 영어 |
| 쯔양 | (UCnkCnLLKUhHyN0ssCENfWw) | 59 | 데이터 미검증, 영상 제목 영어 |
| **합계** | **4개 크리에이터** | **381 visits** | **362개 고유 식당** |

### 4.3 또간집 데이터 상세 (검증 완료)

- **전체 96개 에피소드** (EP.0 ~ EP.95)
- **보류/선정취소**: EP.7, 9, 17, 20, 25, 26, 50, 55, 62, 63, 66, 69, 70, 75, 80, 92, 94 (17개)
- **해외**: EP.29(홍콩), EP.41-42(방콕), EP.77(오사카), EP.78(교토) — 5개 식당
- **좌표/카테고리/메뉴**: 국내 73개 식당 전부 네이버 지도에서 수집 완료
- **영상 제목**: 전부 한글로 교체 완료

---

## 5. 라우팅 구조

| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| `/` | Home | 메인 검색 페이지 |
| `/explore` | Explore | 크리에이터/식당 탐색 |
| `/map?type=creator&value={id}` | SearchMap | 크리에이터별 지도 검색 |
| `/map?type=region&value={region}` | SearchMap | 지역별 지도 검색 |
| `/map?type=food&value={food}` | SearchMap | 음식별 지도 검색 |
| `/restaurant/:id` | RestaurantDetail | 식당 상세 |
| `/creator/:id` | CreatorDetail | 크리에이터 상세 |
| `/my/favorites` | MyFavorites | 찜 목록 (로그인 필요) |

---

## 6. 핵심 컴포넌트 설명

### 6.1 NaverMap.tsx

네이버 지도 SDK 로딩을 polling 방식으로 대기하고, 마커를 표시합니다.

**주요 로직:**
- `waitForNaverMaps()`: 100ms 간격으로 `window.naver?.maps` 존재 여부 확인 (최대 30초)
- `createMarkerIcon()`: 번호가 표시된 원형 마커 SVG 생성
- `fitBounds()`: 모든 마커가 보이도록 자동 줌 조정
- 마커 클릭 시 `onMarkerClick` 콜백으로 식당 ID 전달

**Props:**
```typescript
interface NaverMapProps {
  restaurants: Restaurant[];
  selectedId?: string;
  onMarkerClick?: (id: string) => void;
  className?: string;
}
```

### 6.2 HeartButton.tsx

찜하기 하트 버튼 컴포넌트입니다.

**동작:**
- 비로그인 시: 클릭하면 "로그인이 필요합니다" 토스트
- 로그인 시: 클릭하면 하트 토글 (빈 하트 ↔ 빨간 하트) + 토스트
- `FavoritesContext`의 `toggleFavorite()`를 호출
- Framer Motion으로 scale 애니메이션

### 6.3 SearchMap.tsx

지도 검색 결과 페이지입니다. 좌측에 식당 목록, 우측에 네이버 지도를 표시합니다.

**주요 기능:**
- URL 쿼리 파라미터로 검색 타입/값 수신
- 식당 카드 클릭 시 영상 카드 펼침 (아코디언)
- 영상 카드 또는 "상세 정보 보기" 버튼 클릭 시 식당 상세 페이지로 이동
- 해외 식당은 "좌표 데이터 준비 중" 안내 메시지 표시
- 각 식당 카드에 하트 버튼 포함

### 6.4 AuthContext.tsx

현재는 **시뮬레이션 로그인**으로 구현되어 있습니다.

```typescript
// 현재 구현: 클릭 시 즉시 로그인
const login = () => {
  setUser({ id: "user-1", name: "맛픽 사용자", avatar: "맛" });
  localStorage.setItem("matpick_user", JSON.stringify(...));
};
```

### 6.5 FavoritesContext.tsx

localStorage 기반 찜하기 데이터 관리입니다.

```typescript
// 키: `matpick_favorites_${userId}`
// 값: Set<restaurantId> → JSON 직렬화
```

---

## 7. 네이버 지도 API 설정

현재 `client/index.html`에서 네이버 지도 SDK를 로드합니다:

```html
<script src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=8f5ylcex7n&submodules=geocoder"></script>
```

- **Client ID**: `8f5ylcex7n` (네이버 클라우드 플랫폼)
- **서브모듈**: geocoder (주소→좌표 변환)
- **타입 정의**: `client/src/types/naver-maps.d.ts`

> **주의**: 이 Client ID는 허용 도메인 설정이 필요할 수 있습니다. Vercel 배포 후 도메인을 네이버 클라우드 플랫폼 콘솔에서 등록해야 합니다.

---

## 8. Vercel 배포 방법

### 8.1 설정 파일

`vercel.json`:
```json
{
  "buildCommand": "pnpm install && pnpm build",
  "outputDirectory": "dist",
  "installCommand": "npm install -g pnpm && pnpm install",
  "framework": null,
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### 8.2 배포 절차

1. GitHub 리포지토리에 코드 push
2. Vercel에서 해당 리포지토리 import
3. 설정은 `vercel.json`이 자동 적용됨
4. 배포 후 네이버 지도 API 도메인 등록 필요

### 8.3 빌드 명령어

```bash
pnpm install
pnpm build    # dist/ 폴더에 정적 파일 생성
pnpm preview  # 로컬에서 빌드 결과 미리보기
```

---

## 9. 향후 구현 로드맵

### 9.1 [우선순위 높음] 나머지 시리즈 데이터 검증 및 보강

현재 또간집만 데이터가 검증되었습니다. 나머지 3개 시리즈의 데이터를 검증해야 합니다.

**작업 내용:**
1. **먹을텐데 (성시경)**: 164개 visit의 영상 제목을 한글로 교체, 식당 카테고리/대표메뉴/좌표 수집
2. **맛있는 녀석들**: 65개 visit의 영상 제목 한글화, 식당 정보 수집
3. **쯔양**: 59개 visit의 영상 제목 한글화, 식당 정보 수집

**데이터 수집 방법:**
- 네이버 지도에서 식당명으로 검색하여 카테고리/메뉴/주소/좌표 수집
- 유튜브 영상 페이지에서 한글 제목 확인
- 나무위키 또는 먹방맵(mukbangmap.com) 참조

**참고:** 프로젝트 루트에 `matpick_template.xlsx` (Excel 템플릿)과 `convert_excel_to_json.py` (변환 스크립트)가 포함되어 있습니다. Excel에 데이터를 채운 후 스크립트로 JSON 변환이 가능합니다.

### 9.2 [우선순위 높음] 추가 크리에이터 시리즈 데이터 추가

아래 25개 시리즈를 추가해야 합니다:

| # | 시리즈 | 예상 식당 수 |
|---|--------|:----------:|
| 1 | 할명수 | ~60 |
| 2 | 윤남노포 | ~30 |
| 3 | 떡볶퀸 | ~30 |
| 4 | 데프콘 TV | ~100 |
| 5 | 더들리 | ~60 |
| 6 | 맛상무 | ~120 |
| 7 | 재슐랭가이드 | ~60 |
| 8 | 맛있겠다 Yummy | ~90 |
| 9 | 회사랑rawfisheater | ~70 |
| 10 | 애주가TV참PD | ~90 |
| 11 | 야식이 | ~120 |
| 12 | 생생정보 | ~600 |
| 13 | SBS 생방송 투데이 | ~600 |
| 14 | SBS 생활의 달인 | ~400 |
| 15 | MBC 오늘 N | ~250 |
| 16 | 백종원의 3대 천왕 | ~200 |
| 17 | 수요미식회 | ~180 |
| 18 | 식신로드 | ~120 |
| 19 | 여기 Go | ~60 |
| 20 | 영자로드 | ~60 |
| 21 | 오래된 한식당 100선 | ~100 |
| 22 | 조선일보 맛집 | ~200 |
| 23 | 테이스티 로드 | ~100 |

**추가 방법:**
1. `sampleData.ts`의 `creators` 배열에 새 크리에이터 추가
2. `restaurants` 배열에 새 식당 추가
3. `visits` 배열에 크리에이터-식당 매핑 추가
4. `searchItems` 배열에 검색 아이템 추가

### 9.3 [우선순위 높음] 실제 로그인 구현

현재 시뮬레이션 로그인을 실제 OAuth로 교체해야 합니다.

**옵션 A: 카카오/네이버 소셜 로그인**
- 백엔드 서버 필요 (Next.js API Routes 또는 별도 Express 서버)
- 카카오 개발자 콘솔에서 앱 등록 필요
- `AuthContext.tsx`의 `login()` 함수를 OAuth 플로우로 교체

**옵션 B: Supabase Auth**
- Supabase 프로젝트 생성
- `@supabase/supabase-js` 설치
- 소셜 로그인 + 이메일 로그인 모두 지원
- 찜하기 데이터도 Supabase DB에 저장 가능

**옵션 C: Firebase Auth**
- Firebase 프로젝트 생성
- `firebase` 패키지 설치
- Google/카카오/네이버 로그인 지원

**교체 시 수정 파일:**
- `client/src/contexts/AuthContext.tsx` — 로그인/로그아웃 로직
- `client/src/contexts/FavoritesContext.tsx` — localStorage → DB 저장으로 변경
- `client/src/pages/Home.tsx` — 로그인 버튼 동작

### 9.4 [우선순위 중간] 마커 클러스터링

데이터가 늘어나면 줌 아웃 시 마커가 겹칩니다.

**구현 방법:**
```javascript
// 네이버 지도 MarkerClustering 라이브러리 사용
// https://navermaps.github.io/maps.js.ncp/docs/tutorial-marker-cluster.example.html
```

- `NaverMap.tsx`에 클러스터링 로직 추가
- 줌 레벨에 따라 마커를 그룹핑

### 9.5 [우선순위 중간] 식당 이미지 개선

현재 대부분의 식당이 동일한 placeholder 이미지를 사용합니다.

**개선 방법:**
1. 유튜브 썸네일 활용: `https://img.youtube.com/vi/{videoId}/maxresdefault.jpg`
2. 네이버 플레이스 사진 크롤링
3. 사용자 업로드 사진 (백엔드 필요)

### 9.6 [우선순위 중간] 리뷰 기능 구현

현재 리뷰 탭 UI는 있지만 실제 데이터가 없습니다.

**필요 사항:**
- 백엔드 DB (리뷰 저장)
- 로그인 사용자만 리뷰 작성 가능
- 별점 + 텍스트 리뷰
- 리뷰 목록 표시

### 9.7 [우선순위 낮음] 백엔드 서버 구축

현재 프론트엔드 전용이므로, 아래 기능을 위해 백엔드가 필요합니다:

- 실제 OAuth 로그인
- 찜하기 데이터 서버 저장
- 리뷰 CRUD
- 식당 데이터 API화 (현재 하드코딩 → DB)
- 검색 엔진 (Elasticsearch 또는 Algolia)

**추천 스택:**
- Next.js (App Router) + Supabase
- 또는 Express + PostgreSQL + Prisma

### 9.8 [우선순위 낮음] 성능 최적화

- **코드 스플리팅**: 현재 번들이 1MB 이상이므로, `React.lazy()`로 페이지별 분리
- **이미지 최적화**: WebP 포맷 사용, lazy loading
- **sampleData.ts 분리**: 10,000줄 이상이므로 JSON 파일로 분리하고 동적 import

---

## 10. 주요 주의사항

### 10.1 네이버 지도 SDK 로딩 타이밍

네이버 지도 SDK는 `index.html`에서 동기적으로 로드되지만, React 컴포넌트가 마운트될 때 아직 로드가 완료되지 않을 수 있습니다. `NaverMap.tsx`의 `waitForNaverMaps()` 함수가 이를 처리합니다. **절대로 컴포넌트 최상위에서 `naver.maps`에 직접 접근하지 마세요.**

### 10.2 해외 식당 처리

`isOverseas: true`인 식당은:
- 좌표가 `0, 0`
- 지도에 마커를 표시하지 않음
- 식당 카드에 "해외" 배지 표시
- 클릭 시 "좌표 데이터 준비 중 / 해외 위치로 제공하지 않습니다" 안내

### 10.3 Tailwind CSS 4 주의사항

- `@theme` 블록에서 OKLCH 색상 포맷 사용
- `index.css`의 CSS 변수가 테마를 제어
- shadcn/ui 컴포넌트는 `@/components/ui/`에서 import

### 10.4 wouter 라우팅

- `wouter`는 `react-router`와 다른 API를 사용합니다
- `<Link>` 안에 `<a>` 태그를 넣지 마세요 (중첩 앵커 에러)
- URL 쿼리 파라미터는 `window.location.search`로 직접 파싱합니다

### 10.5 이미지 호스팅

현재 이미지들은 외부 URL을 사용합니다:
- `images.unsplash.com` — 히어로 배경 이미지 (Unsplash 무료)
- `img.youtube.com` — 유튜브 썸네일
- `yt3.googleusercontent.com` — 유튜브 프로필 이미지
- 로고는 인라인 SVG로 렌더링 (외부 의존성 없음)

Manus CDN(manuscdn.com) 의존성은 완전히 제거되었습니다.

---

## 11. 로컬 개발 환경 설정

```bash
# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm dev

# 타입 체크
pnpm check

# 빌드
pnpm build

# 빌드 결과 미리보기
pnpm preview
```

---

## 12. 데이터 추가/수정 가이드

### 12.1 새 크리에이터 추가

`sampleData.ts`의 `creators` 배열에 추가:

```typescript
{
  id: "UC...",              // 유튜브 채널 ID
  name: "크리에이터명",
  channelName: "채널명",
  profileImage: "https://yt3.googleusercontent.com/...",
  subscribers: "100만",
  description: "시리즈 설명",
  youtubeUrl: "https://www.youtube.com/@channel",
  series: "시리즈명",
}
```

### 12.2 새 식당 추가

`restaurants` 배열에 추가:

```typescript
{
  id: "r_" + hashFunction(name),  // 고유 ID
  name: "식당명",
  region: "서울 강남구 역삼동",
  address: "서울 강남구 테헤란로 123",
  category: "한식",
  representativeMenu: "김치찌개 / 된장찌개",
  lat: 37.5000,
  lng: 127.0000,
  imageUrl: "https://...",
  isOverseas: false,  // 해외면 true
}
```

### 12.3 새 방문 기록 추가

`visits` 배열에 추가:

```typescript
{
  id: "v_" + hashFunction(restaurantId + creatorId + episode),
  restaurantId: "r_...",
  creatorId: "UC...",
  videoId: "youtube_video_id",
  videoUrl: "https://www.youtube.com/watch?v=...",
  videoTitle: "[시리즈명 EP.X] 영상 제목",
  visitDate: "2025-01-01",
  episode: "EP.1",
  rating: "",
  comment: "",
  thumbnailUrl: "https://img.youtube.com/vi/.../maxresdefault.jpg",
  series: "시리즈명",
}
```

### 12.4 검색 아이템 추가

`searchItems` 배열에 추가 (메인 검색 드롭다운에 표시):

```typescript
{
  id: "creator-id 또는 고유값",
  type: "creator",  // "creator" | "region" | "food" | "restaurant"
  name: "표시명",
  subtitle: "부제목",
  icon: "🍽️",
}
```

---

## 13. Excel → JSON 변환 도구

프로젝트에 포함된 `convert_excel_to_json.py`를 사용하면 Excel 데이터를 JSON으로 변환할 수 있습니다.

```bash
python3 convert_excel_to_json.py matpick_template.xlsx output.json
```

**Excel 컬럼 구조:**

| 컬럼 | 설명 | 예시 |
|------|------|------|
| 번호 | 에피소드 순서 | 1 |
| 에피소드 | 에피소드 번호 | EP.1 |
| 영상제목 | 한글 영상 제목 | [또간집 EP.1] 풍자 연남동 맛집 |
| videoId | 유튜브 영상 ID | abc123xyz |
| 업로드일 | 영상 업로드 날짜 | 2023-01-15 |
| 식당명 | 식당 이름 | 뉴오더클럽 |
| 카테고리 | 음식 카테고리 | 양식 |
| 대표메뉴 | 대표 메뉴 | 쿼터 피자 / 페퍼로니 |
| 주소 | 도로명 주소 | 서울 마포구 동교로34길 3 |
| 지역 | 간략 지역 | 서울 마포구 연남동 |
| 위도 | 위도 좌표 | 37.5665 |
| 경도 | 경도 좌표 | 126.9780 |
| 국내/해외 | 국내 또는 해외 | 국내 |
| 상태 | 선정/보류 | 선정 |

---

## 14. 알려진 이슈

1. **번들 크기**: 현재 JS 번들이 ~1MB로 큼. `sampleData.ts`가 10,000줄 이상이 주 원인. JSON 분리 + 코드 스플리팅 필요.
2. **먹을텐데/맛있는녀석들/쯔양 영상 제목**: 영어로 되어 있음. 한글로 교체 필요.
3. **먹을텐데/맛있는녀석들/쯔양 식당 데이터**: 카테고리, 대표메뉴, 좌표가 부정확하거나 누락된 것이 있음.
4. ~~manuscdn.com 이미지~~: 제거 완료. Unsplash + 인라인 SVG로 교체됨.
5. **네이버 지도 API 도메인**: Vercel 배포 도메인을 네이버 클라우드 플랫폼에 등록 필요.

---

## 15. GitHub 리포지토리

- **URL**: https://github.com/wjddusghks/matpick
- **브랜치**: main
- Manus 플랫폼 의존성이 완전히 제거된 독립 프로젝트입니다.

---

*이 문서는 2025년 3월 15일 기준으로 작성되었습니다.*
