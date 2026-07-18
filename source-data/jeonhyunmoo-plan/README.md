# 전현무계획 맛픽 원천 데이터

전현무계획 시즌 1~4의 공식 방송정보를 시즌별로 수집한 작업 폴더입니다.

## 폴더 구조

```text
jeonhyunmoo-plan/
  season-1/
    source.json
    restaurants.json
    sources.json
    evidence-report.md
  season-2/
  season-3/
  season-4/
```

## `restaurants.json` 계약

각 항목은 방송 출연 1건을 뜻합니다. 같은 식당이 여러 회차에 출연하면 출연 건은 모두 보존합니다.

- `id`: `jeonhyunmoo-plan-s{season}-no{restaurantRecordNo}`
- `season`, `episode`: 시즌·회차
- `restaurantRecordNo`: MBN 공식 맛집기록 번호
- `name`, `aliases`: 상호 및 별칭
- `region`, `address`, `phone`: 공식 방송정보 기준 위치·연락처
- `category`, `representativeMenu`, `menus`: 방송에서 확인된 음식 정보
- `broadcastDate`: 방송일
- `sourceUrl`, `evidenceText`: 사실 확인 근거
- `lat`, `lng`: 지오코딩 전에는 `null`
- `confidence`: 0~1
- `reviewStatus`: 검토 상태
- `notes`: 이전·폐업·한정판매처럼 확인된 주의사항

## 게시 전 규칙

1. 동일 상호는 주소까지 비교해 지점 또는 동명이점을 구분합니다.
2. 가격은 최신 메뉴판 근거와 확인일이 있을 때만 게시합니다.
3. 좌표는 주소 검증 후 별도 지오코딩합니다.
4. 방송사 이미지와 긴 본문은 사용권 검토 없이 재게시하지 않습니다.
5. 공식 출처가 불완전한 항목은 `needs-review`로 유지합니다.
