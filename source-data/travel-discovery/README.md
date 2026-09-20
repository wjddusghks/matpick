# 맛픽 여행 가이드 수집 준비

공개 이름은 **부산 한입 / 제주 한입 / 여행길 한입**입니다. 공급기관은 이름 대신 상세 출처에 표시합니다. 방송 출연·직접 방문·평점 인증을 암시하지 않습니다. 유튜브·인스타 신규 수집은 보류합니다.

| 내부 공급원 | 공개 주제 | 접근 방식 | 확인한 원본 |
|---|---|---|---|
| busan | 부산 한입 | 공공데이터포털 활용 승인 후 API | https://www.data.go.kr/data/15063472/openapi.do |
| visit-jeju | 제주 한입 | 로그인 없이 공개 CSV 다운로드 | https://www.data.go.kr/data/15041984/fileData.do |
| tourapi | 여행길 한입 | 공공데이터포털 활용 승인 후 API | https://www.data.go.kr/data/15101578/openapi.do |

제주 원본은 2026-03-03 기준 2,884행입니다. 2026-09-20 다운로드했고 원본 이용허락범위는 '제한 없음'으로 표시되어 있습니다. 원본은 EUC-KR CSV이며 `raw/visit-jeju-restaurants-20260303.csv`에 보관합니다. 1,140행에 대표메뉴 텍스트가 있으나 최신 가격 보장을 뜻하지 않습니다. 주소·좌표·영업 상태가 없으며 동명 지점, 중복, 테스트 입력도 있어 자동 공개하지 않습니다.

## 가져오기

저장소 루트에서 실행합니다.

```powershell
node scripts/import-tourism-data.mjs --source visit-jeju --file source-data/travel-discovery/raw/visit-jeju-restaurants-20260303.csv
node --env-file=matpick_all/.env.data.local scripts/import-tourism-data.mjs --source busan
node --env-file=matpick_all/.env.data.local scripts/import-tourism-data.mjs --source tourapi --region 26 --detail-limit 0
node --env-file=matpick_all/.env.data.local scripts/import-tourism-data.mjs --source tourapi --region 50 --detail-limit 0
```

API 키는 `BUSAN_DATA_SERVICE_KEY`, `TOUR_API_SERVICE_KEY` 또는 공통 `DATA_GO_KR_SERVICE_KEY` 환경변수로만 읽습니다. 소스·브라우저 번들·출력 로그에 넣지 않습니다. `.env.data.local`은 Git 제외 대상으로, 일반 웹 빌드에서도 읽지 않습니다. 방문자 검색 시 공공 API를 호출하지 않고 로컬 수집 → 검토 → 공개 데이터 생성 순서로 사용합니다.

2026-09-20 운영자가 회원가입을 마친 뒤 두 API의 라이선스 동의·활용 신청 제출을 승인했습니다. 개발계정 두 개 모두 승인(2028-09-20 만료)되었고 실제 호출에 성공했습니다. 부산 437건(대표메뉴 423건), TourAPI 부산 516건·제주 699건을 수집했습니다. TourAPI 소개정보도 한 건을 조회하여 메뉴 연결을 검증했습니다. 제주 CSV를 포함해 4,536건의 공급원별 후보이며 중복을 제거한 신규 식당 수가 아닙니다. 운영계정 승인은 아직 신청하지 않았습니다.

TourAPI `--detail-limit 0`은 목록만 수집합니다. 옵션 생략 시 소개정보를 최대 250건, 명시 시 최대 800건까지 조회합니다. 하루 상세기능별 개발 할당량(1,000회)을 고려하여 실행 횟수를 관리하세요. 지역별 목록은 별도 파일에 저장하며 실행 시 같은 지역 파일은 교체됩니다.

TourAPI는 공식 명세의 KorService2 `areaBasedList2`, `detailIntro2`, 음식점 타입 39, 법정동 시도코드 26(부산)·50(제주)를 사용합니다. 이미지가 있어야 나오는 정렬 조건은 쓰지 않습니다. 사진·후기·홍보 문장 원문은 수입하지 않습니다. 부산 API에서는 UC_SEQ, 상호, 주소, 좌표, 연락처, 대표메뉴만 사용합니다.

## 검토 후 공개

1. `staging/*.json`에서 상호·도로명 주소·지점이 같은지 확인합니다. 제주 이름만으로 다른 지점에 붙이지 않습니다.
2. 기존 맛픽 식당과 중복 여부를 대조합니다. 미확인 메뉴 가격을 추정하지 않습니다.
3. 확인된 항목을 `approved.json`에 옮기고 `reviewStatus: "approved"`, 확인 날짜·출처 URL을 기록합니다. 현재 영업 중이라는 근거가 있으면 `operationState: "operating"`을, 지점 동일성만 지도에서 확인되면 `operationState: "unknown"`과 `verification.basis: "map_listing"`을 사용합니다. 지도 등록만으로 영업 확인을 주장하지 않습니다.
4. `node scripts/build-travel-discovery.mjs` 후 앱 데이터 생성·검사·빌드를 실행합니다.

2026-09-20 부산 100건·제주 169건의 공급원 항목을 지점 대조 후 승인했습니다. 중복과 기존 식당을 통합한 공개 주제 수는 빌드 시 최종 식당 ID로 계산하여 홈페이지에 표시합니다. 대표 메뉴·현재 지도 메뉴를 담고 사진 없이 SVG 주제 아이콘·검색·가이드·출처 안내가 활성화됩니다. `여행길 한입`은 독립적인 승인 목록이 없어 아직 노출하지 않습니다. 공급기관 등록은 맛을 보장하는 평가가 아니므로 사용자에게 '맛픽이 직접 검증한 맛집'으로 표시하지 않습니다.

이번 공개 준비는 `scripts/prepare-discovery-release.mjs` → `scripts/collect-missing-menus.mjs --directory source-data/discovery-release-2026-09` → `scripts/build-discovery-release.mjs` → `scripts/build-travel-discovery.mjs` → 앱 빌드 순서입니다. 이미 검토한 항목은 체크포인트로 재사용합니다. 자세한 목록과 보류 이유는 `source-data/discovery-release-2026-09/report.md`에 기록합니다.

블루리본은 서면 이용허가를 확인하기 전까지 수집 대상에서 제외합니다. 이번 수집에는 포함하지 않았고, 기존 데이터·수집 코드에서 해당 출처 참조도 발견되지 않았습니다. 이 확인은 코드·데이터의 출처 표기 검사이며 개별 식당의 수상 여부를 판단한 것은 아닙니다.
