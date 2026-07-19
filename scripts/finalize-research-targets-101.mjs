import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const verifiedAt = "2026-07-19T23:30:00+09:00";
const rawPath = path.join(
  root,
  "source-data",
  "menu-enrichment",
  "naver-research-targets-101-2026-07-19.raw.json",
);
const finalPath = path.join(
  root,
  "source-data",
  "menu-enrichment",
  "final-research-targets-101-2026-07-19.json",
);
const reportPath = path.join(
  root,
  "docs",
  "menu-price-research-results-101-2026-07-19.md",
);

const readJson = (filePath) =>
  JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
const writeJson = (filePath, value) =>
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
const menu = (name, price, description = "") => ({
  name,
  price,
  ...(description ? { description } : {}),
});
const source = (url, label = "공개 웹 자료") => ({ url, label });

const raw = readJson(rawPath);
const overrides = new Map();
const set = (index, patch) =>
  overrides.set(index, { ...(overrides.get(index) ?? {}), ...patch });

const naverVerifiedMenus = new Set([13, 21, 22, 26, 55, 61, 63, 64, 70, 74, 92, 98, 101]);
const naverVerifiedNoMenu = new Set([
  1, 6, 7, 10, 11, 23, 27, 35, 40, 43, 44, 45, 50, 53, 54, 57, 58, 65, 85,
  93, 94,
]);

// 네이버 검색이 같은 이름의 다른 식당을 반환한 경우에는 원시 메뉴를 채택하지 않는다.
// 아래 수동 보정은 주소 이전/상호 변경/폐업 또는 동일 주소가 별도 자료로 확인된 경우만 담는다.
set(2, {
  status: "operating",
  confidence: "medium",
  menus: [
    menu("굴밥", "12,000원"),
    menu("굴전", "10,000원"),
    menu("물회", "20,000원"),
    menu("활어회덮밥", "15,000원"),
    menu("모듬회", "120,000원"),
    menu("게장백반", "25,000원"),
  ],
  sources: [source("https://mforu.tistory.com/644", "식당명·지역 일치 메뉴 자료")],
  note: "네이버의 홍북읍 동명 식당 메뉴는 제외하고 남당항 주소 자료만 반영했다.",
});
set(3, {
  status: "closed_likely",
  confidence: "medium",
  sources: [source("https://www.placeview.co.kr/id/NDgzODU0OTEx", "기존 주소의 현재 입점 업소")],
  note: "기존 석촌동 주소가 다른 업종으로 확인되고 동일 식당의 현재 영업 근거를 찾지 못했다.",
});
set(4, {
  status: "relocated",
  confidence: "high",
  currentAddress: "경남 창원시 진해구 자은로96번길 10",
  menus: [menu("콩과자 1봉", "1,000원")],
  sources: [
    source("https://www.siksinhot.com/P/1563856", "이전 주소 확인"),
    source(
      "https://www.factory-platform.com/member/login?category_code=&nature_url=manufacturer%2Fai-recommended-manufacturers&orderBy=rand&page=95&return_url=%2Fmain%2Fmember%2Flogin%3Freturn_url%3D%2Fmanufacturer%2Fai-recommended-manufacturers%3Ftpf%3Dproduct%2Flist_ai&tpf=&url=manufacturer%2Fai-recommended-manufacturers",
      "현행 제품 가격 자료",
    ),
  ],
});
set(5, {
  status: "operating",
  confidence: "high",
  menus: [menu("만두 6개", "5,000원"), menu("찐빵 6개", "5,000원"), menu("온소바", "5,000원")],
  sources: [
    source("https://pglog.tistory.com/m/502", "2025년 동일 주소 방문 자료"),
    source("https://www.placeview.co.kr/id/ODY0Njg5MSAg", "동일 주소 업소 자료"),
  ],
  note: "네이버가 반환한 서동로32길 동명 식당 메뉴는 제외했다.",
});
set(8, {
  status: "closed_confirmed",
  confidence: "high",
  sources: [source("https://polle.com/place/2aUaz1/%EA%B5%AC%EC%9D%B4%EB%A7%88%EB%8B%B9", "폐점 표기")],
});
set(9, {
  status: "closed_confirmed",
  confidence: "high",
  sources: [source("https://polle.com/place/5m4nPp/%EA%B8%88%EB%AC%B8%EC%9E%A5", "폐점 표기")],
});
set(10, {
  status: "operating",
  confidence: "high",
  menus: [
    menu("장어구이", "40,000원"), menu("곰장어", "50,000원"),
    menu("모듬회", "40,000~80,000원"), menu("가리비", "35,000원"),
    menu("매운탕", "10,000원"), menu("장어탕", "20,000원"),
    menu("생선구이", "10,000~20,000원"),
  ],
  sources: [source("https://busan7.com/entry/%EC%8B%9D%EA%B0%9D-%ED%97%88%EC%98%81%EB%A7%8C%EC%9D%98-%EB%B0%B1%EB%B0%98%EA%B8%B0%ED%96%89-%EB%82%B4%ED%98%B8%EB%83%89%EB%A9%B4-%ED%95%A9%EC%B2%9C%EA%B5%AD%EB%B0%A5%EC%A7%91-%EA%B8%88%EC%84%B1%ED%98%B8-%EA%B3%B0%EC%9E%A5%EC%96%B4-%EB%B6%80%EC%82%B0%EB%82%A8%EA%B5%AC%EB%A7%9B%EC%A7%91", "동일 주소 메뉴 자료")],
});
set(11, {
  status: "operating",
  confidence: "high",
  menus: [menu("누룩 빚기 체험", "10,000원"), menu("막걸리 빚기 체험", "20,000원")],
  sources: [source("https://korean.visitkorea.or.kr/detail/rem_detail.do?cotid=ababe38d-29af-4214-9c55-ead23bbc011d", "한국관광공사 현행 안내")],
});
set(12, {
  status: "renamed_same_address",
  confidence: "high",
  currentName: "길모퉁이",
  menus: [
    menu("생두부", "4,000원"), menu("두부조림", "14,000원"), menu("계란말이", "12,000원"),
    menu("두루치기", "20,000원"), menu("꽁치구이", "12,000원"), menu("고등어", "12,000원"),
    menu("김치전", "10,000원"), menu("오징어", "15,000원"), menu("돼지껍데기", "14,000원"),
    menu("닭발", "14,000원"), menu("도루묵구이", "15,000원"), menu("두부김치", "24,000원"),
    menu("도루묵조림", "20,000원"), menu("가자미조림", "25,000원"),
  ],
  sources: [source("https://polle.com/place/4klVzr/%EA%B8%B8%EB%AA%A8%ED%89%81%EC%9D%B4", "현행 상호·메뉴")],
});
set(13, {
  status: "relocated",
  confidence: "high",
  currentAddress: "강원 태백시 시장북2길 5-2",
  note: "네이버 현행 장소와 메뉴가 확인되어 현행 도로명 주소를 사용했다.",
});
set(14, {
  status: "closed_confirmed", confidence: "high",
  sources: [source("https://polle.com/place/3nAg2Q/%EB%82%98%EB%93%9C%EB%A6%AC%EC%8B%9D%ED%92%88", "폐점 표기")],
});
set(15, {
  status: "closed_confirmed", confidence: "high",
  sources: [source("https://polle.com/place/1UqABw/%EB%82%98%EB%AD%87%EC%9E%8E%20%EC%8A%A4%EC%8B%9C", "폐점 표기")],
});
set(16, {
  status: "operating", confidence: "high",
  menus: [menu("문어곱창전골 소", "45,000원"), menu("섭국", "12,000원"), menu("청어알비빔밥", "12,000원"), menu("감자만두", "10,000원")],
  sources: [source("https://impresident.tistory.com/797", "동일 주소 현행 메뉴 자료"), source("https://todaytrip.tistory.com/106", "주소·메뉴 교차 확인")],
  note: "네이버의 미시령옛길 동명 식당은 제외했다.",
});
set(17, {
  status: "operation_unverified", confidence: "low",
  sources: [source("https://www.siksinhot.com/P/881259", "과거 메뉴 자료")],
  note: "보리밥·만두국 각 5,000원 자료는 있으나 현재 영업을 확인할 근거가 부족해 사이트에는 가격을 반영하지 않았다.",
});
set(18, {
  status: "operating", confidence: "medium",
  menus: [menu("치마살", "45,000원"), menu("토시살", "45,000원"), menu("안창살 2인", "120,000원")],
  sources: [source("https://www.siksinhot.com/P/273741", "현행 업소·메뉴 자료")],
});
set(19, {
  status: "closed_confirmed", confidence: "high",
  sources: [source("https://polle.com/place/1qwiM8/%EB%82%A8%ED%95%B4%EC%86%8C%EB%B0%98", "폐점 표기")],
});
set(20, {
  status: "operating", confidence: "medium",
  menus: [
    menu("모듬구이 소세지 500g", "13,000원"), menu("스모크소세지 500g", "15,000원"),
    menu("숯불소세지핫도그", "5,000원"), menu("허브훈제삼겹살 500g", "15,000원"),
    menu("베이컨 500g", "15,000원"), menu("바베큐포크립 500g", "20,000원"),
    menu("바베큐 모듬구이 세트 1kg", "35,000원"),
  ],
  sources: [source("https://manyfactory.tistory.com/395", "동일 주소 메뉴 자료")],
});
set(21, { status: "relocated", confidence: "high", currentAddress: "서울 성북구 종암로 19 102호" });
set(24, {
  status: "relocated", confidence: "high", currentAddress: "경기 광주시 남한산성면 엄미길 93-4",
  sources: [source("https://www.siksinhot.com/theme/magazine/5535", "현행 주소 자료")],
});
set(25, {
  status: "operating", confidence: "medium", menus: [menu("백반", "8,000원")],
  sources: [source("https://www.emmaru.com/matzip/matzip.do?code=M190606181143986510V", "동일 주소 메뉴 자료")],
  note: "네이버의 광주 동명 식당 메뉴는 제외했다.",
});
set(26, { status: "relocated", confidence: "high", currentAddress: "제주 서귀포시 중앙로 111 1층" });
set(28, {
  status: "operating", confidence: "high",
  menus: [
    menu("처림상", "32,000원"), menu("풍천장어구이", "48,000원"), menu("낙지쭈꾸미전골", "10,000원"),
    menu("산채비빔밥", "14,000원"), menu("제육볶음", "10,000원"), menu("우렁된장찌개", "10,000원"),
    menu("김치찌개", "11,000원"), menu("돌솥비빔밥", "10,000원"), menu("우거지해장국", "9,000원"),
    menu("콩나물해장국", "9,000원"), menu("순두부해장국", "9,000원"), menu("닭도리탕", "60,000원"),
    menu("촌닭백숙", "60,000원"), menu("더덕무침", "25,000원"), menu("두부김치", "25,000원"),
  ],
  sources: [source("https://new.emmaru.com/matzip/matzip.do?code=M230129154946268275Q&f=1&s=1&t=1", "현행 주소·메뉴 자료")],
});
set(29, {
  status: "operating", confidence: "medium",
  menus: [menu("다슬기들깨수제비", "10,000원"), menu("우렁죽순비빔국수", "9,000원"), menu("국수", "6,000원"), menu("비빔국수", "7,000원")],
  sources: [source("https://hilring.tistory.com/96", "동일 주소 메뉴 자료")],
});
set(30, {
  status: "closed_confirmed", confidence: "high",
  sources: [source("https://polle.com/place/26rXk7/%EB%AF%B8%EC%9D%B8%EA%B3%BC%20%EC%9E%90%EC%97%B0", "폐점 표기")],
});
set(31, {
  status: "operating", confidence: "medium",
  sources: [source("https://www.tabling.co.kr/place/677ccc1566de5f06987e68ef", "동일 주소 현행 업소 자료")],
  note: "가맥집 특성상 고정 공개 가격표를 확인하지 못했다.",
});
set(32, {
  status: "operating", confidence: "high",
  sources: [source("https://www.tripinfo.co.kr/info.html?content_id=2950522&content_type_id=39&device=pc&navi=food_rank-jeonbuk", "동일 주소 현행 업소 자료")],
  note: "네이버의 고창읍 동명 식당 메뉴는 제외했다. 바지락돌솥밥·정식·초무침·칼국수·죽의 공개 가격은 확인되지 않았다.",
});
set(33, {
  status: "operating", confidence: "medium", menus: [menu("비빔칼국수", "6,000원")],
  sources: [source("https://hanis.tistory.com/76", "방송 식당 목록·가격")],
});
set(34, {
  status: "operating", confidence: "high",
  sources: [source("https://www.diningcode.com/profile.php?rid=X3tfYxnpq7TT", "현행 주소·메뉴 자료")],
  note: "현행 공개 메뉴 9개를 확인했으나 원문 가격 구조의 자동 추출 신뢰도가 낮아 보고서 상태만 갱신했다.",
});
set(36, {
  status: "renamed_relocated", confidence: "high", currentName: "옥당",
  currentAddress: "충남 태안군 남면 안면대로 605-8",
  menus: [menu("연잎밥 정식", "15,000원")],
  sources: [source("https://triple.guide/restaurants/9c19813a-3f3f-4fdd-8e50-138f41cea67c", "이전·상호변경·현행 가격")],
});
set(37, {
  status: "operation_unverified", confidence: "low",
  sources: [
    source("https://www.diningcode.com/profile.php?rid=wu6gGR4mQqyM", "동일 주소 수산물직매장 현행 자료"),
    source("https://place.udanax.org/place.php?id=1257359&placeName=%EB%8C%80%EC%82%B0%ED%95%AD%EC%88%98%EC%82%B0.%EC%82%BC%EA%B8%B8%ED%8F%AC%EC%88%98%EC%82%B0%EB%AC%BC%EC%A7%81%EB%A7%A4%EC%9E%A5", "동일 주소 직매장 교차 확인"),
  ],
  note: "삼길포수산물직매장 건물의 현행 영업은 확인했지만, 개별 점포 ‘지은이네’의 현행 영업과 고정 가격표는 확인하지 못했다.",
});
set(38, {
  status: "closed_confirmed", confidence: "high",
  sources: [source("https://polle.com/place/5B4grR/%EC%83%98%EB%AC%BC%EC%8B%9D%EB%8B%B9", "폐점 표기")],
});
set(39, {
  status: "closed_confirmed", confidence: "high",
  sources: [source("https://polle.com/place/3jbO21/%EC%84%9C%EC%B4%8C%ED%86%B5%EC%98%81", "폐점 표기")],
});
set(41, {
  status: "operating", confidence: "high", currentAddress: "경북 영덕군 영덕읍 남석길 23-48",
  menus: [menu("모둠해산물", "변동"), menu("문어", "변동")],
  sources: [source("https://www.diningcode.com/profile.php?rid=E9MoTaFQzQcf", "2026년 영업시간·메뉴")],
});
set(42, {
  status: "operating", confidence: "high",
  menus: [
    menu("꼬막비빔밥", "8,000~10,000원"), menu("생연어덮밥", "8,000~10,000원"),
    menu("멍게비빔밥", "8,000~10,000원"), menu("간장게장백반", "10,000원"), menu("꽁치구이", "5,000원"),
    menu("알탕", "6,000원"), menu("동태찌개 2인", "16,000원"), menu("오징어볶음 2인", "16,000원"),
    menu("아귀찜", "28,000~38,000원"), menu("곤이알찜", "14,000~26,000원"),
  ],
  sources: [source("https://new.emmaru.com/matzip/matzip.do?code=M181129201606614648L&f=1&s=0&t=0", "동일 주소 메뉴 자료")],
});
set(43, {
  status: "operating", confidence: "high",
  sources: [source("https://www.gochang.go.kr/board/view.gochang?boardId=BBS_TOUR_FOOD&dataSid=7307&menuCd=DOM_000000404001000000", "고창군 공식 음식점 안내")],
  note: "회·수산물은 시세형으로 고정 가격을 확인하지 못했다.",
});
set(44, {
  status: "closed_confirmed", confidence: "high",
  sources: [source("https://www.diningcode.com/profile.php?rid=qxq6SWodqzmI", "동일 주소 대체 업소 확인")],
  note: "동일 주소는 안성식당으로 대체 영업 중이며 수정식당으로의 동일성은 확인되지 않아 폐업 처리했다.",
});
set(46, {
  status: "operating", confidence: "high",
  sources: [source("https://app.passorder.co.kr/advance/f74f104f-8cec-4543-91c3-d5199fe41337", "현행 주문 페이지·동일 주소")],
  note: "메뉴판 이미지는 있으나 정확한 텍스트 가격표는 공개되지 않았다.",
});
set(47, {
  status: "closed_confirmed", confidence: "high",
  sources: [source("https://polle.com/place/3OzmX5/%EC%98%81%EB%8D%95%EC%8B%9D%EB%8B%B9", "폐점 표기")],
});
set(48, {
  status: "operating_no_public_price", confidence: "medium",
  sources: [
    source("https://www.hongcheon.go.kr/tour/selectTourCntntsWebList.do?key=1856&pageIndex=201&pageUnit=6&searchCnd=all&searchShowAt=Y&sortTy=NM", "홍천군 문화관광포털 현행 업소 목록"),
    source("https://manyfactory.tistory.com/393", "과거 방송 메뉴 자료"),
  ],
  note: "홍천군 문화관광포털에서 동일 주소 업소를 확인했다. 갈추어탕 8,000원·통추어탕 9,000원·수제비 1,000원은 과거 가격이라 사이트에는 반영하지 않았다.",
});
set(49, {
  status: "operating", confidence: "high",
  menus: [
    menu("팥빙수", "16,000원"), menu("팥죽", "12,000원"), menu("인절미", "4,000원"),
    menu("대추차", "8,000원"), menu("보이차", "8,000원"), menu("쌍화차", "8,000원"),
    menu("생강차", "8,000원"), menu("레몬차", "7,000원"), menu("유자차", "7,000원"),
    menu("커피", "3,500원"), menu("녹차", "변동"), menu("시루떡", "변동"),
  ],
  sources: [source("https://www.diningcode.com/profile.php?rid=7B4qemXzni4b", "2025년 현행 메뉴")],
});
set(50, {
  status: "seasonal_operation", confidence: "high",
  sources: [source("https://www.siksinhot.com/P/1269569", "동일 주소 계절 식당 자료")],
  note: "민박·슈퍼를 겸한 계절 식당으로 고정 공개 가격표가 없다.",
});
set(51, {
  status: "relocated", confidence: "high", currentName: "신신식당",
  currentAddress: "서울 성북구 보문로30라길 3",
  menus: [
    menu("우렁쌈밥", "10,000원"), menu("제육쌈밥", "10,000원"), menu("우렁무침", "10,000원"),
    menu("우렁초장회", "10,000원"), menu("청국장", "5,000원"), menu("고등어김치", "2,000원"),
  ],
  sources: [source("https://jin2fly.tistory.com/17", "이전 주소·현행 메뉴")],
});
set(52, {
  status: "closed_confirmed", confidence: "high",
  sources: [source("https://polle.com/place/24ktN5/%EC%9A%B0%ED%99%94%EC%8B%9D%EB%8B%B9", "폐점 표기")],
});
set(53, {
  status: "operating", confidence: "medium",
  menus: [menu("민박 1인", "40,000원"), menu("숙박객 식사 1인", "7,000원")],
  sources: [source("https://enjoyholic.tistory.com/5952", "동일 주소 이용 가격")],
});
set(55, { status: "relocated", confidence: "high", currentAddress: "전남 여수시 교동시장7길 2-4" });
set(56, {
  status: "renamed_relocated", confidence: "high",
  currentName: "소소반",
  currentAddress: "강원 횡성군 서원면 옥계9길 119",
  menus: [menu("서울불고기정식 1인", "27,000원"), menu("서울불고기 정식 1인", "34,000원")],
  sources: [
    source("https://www.tabling.co.kr/place/677ccf8f66de5f06988471d2", "현행 상호·이전 주소·메뉴 가격"),
    source("https://www.saramin.co.kr/zf_user/company-info/view/csn/VzVxckNqajlYbkVUOWhPUWFscFduUT09/company_nm/%EC%86%8C%EC%86%8C%EB%B0%98", "기존 주소 사업자 정보 교차 확인"),
  ],
  note: "기존 옥계사일길 27에서 옥계9길 119로 이전한 현행 업소와 공개 메뉴를 확인했다.",
});
set(57, {
  status: "operating", confidence: "medium", menus: [menu("백반", "8,000원")],
  sources: [source("https://korea-hotplace.tistory.com/4702", "동일 주소 방송 메뉴 가격")],
});
set(59, {
  status: "closed_confirmed", confidence: "high",
  sources: [source("https://polle.com/place/3uving/%EC%9E%A5%EC%88%98%EC%8B%9D%EB%8B%B9", "폐점 표기")],
});
set(60, {
  status: "operating", confidence: "high",
  sources: [source("https://kor.clubrichtour.co.kr/bbs/board.php?bo_table=datagokr_Kor&wr_id=29808", "동일 주소 현행 업소 자료")],
  note: "네이버의 돌산 동명 식당 메뉴는 제외했다.",
});
set(61, { status: "relocated", confidence: "high", currentAddress: "충남 서산시 시장2로 6" });
set(62, {
  status: "operating", confidence: "medium", currentAddress: "전북 정읍시 태평7길 24",
  menus: [menu("팥칼국수", "5,000원"), menu("새알팥죽", "6,000원")],
  sources: [source("https://todaytrip.tistory.com/113", "동일 상호 메뉴 자료")],
});
set(66, {
  status: "operating", confidence: "high",
  menus: [menu("늙은 호박 시루떡 1팩", "5,000원")],
  sources: [source("https://www.diningcode.com/profile.php?rid=R9ytBffwY9Ju", "2026년 동일 주소 방문·가격")],
});
set(67, {
  status: "closed_confirmed", confidence: "high", currentName: "복춘정",
  sources: [source("https://polle.com/place/5rJPLH/%EB%B3%B5%EC%B6%98%EC%A0%95", "폐점·영업종료 공지")],
  note: "진가식탁/복춘정의 동일 주소 영업 종료가 확인됐다.",
});
set(68, {
  status: "closed_confirmed", confidence: "high",
  sources: [source("https://polle.com/place/30LBjM/%EC%A7%84%EC%A3%BC%EC%8B%9D%EB%8B%B9", "폐점 표기")],
  note: "네이버의 노량진 동명 식당 메뉴는 제외했다.",
});
set(69, {
  status: "restricted_operation", confidence: "high",
  sources: [source("https://cookmos.tistory.com/entry/%EB%B0%B1%EB%B0%98%EA%B8%B0%ED%96%89-27%ED%9A%8C-%EA%B5%AC%EB%A1%80-%EC%8B%9D%EB%8B%B9-%EC%A0%95%EB%B3%B4", "주민 전용 안내")],
  note: "일반 방문객 대상 식당이 아닌 주민 전용 공간으로 안내되어 고정 메뉴·가격을 반영하지 않았다.",
});
set(71, {
  status: "operating", confidence: "medium",
  menus: [menu("정식 2인", "35,000원"), menu("정식 4인", "70,000원")],
  sources: [source("https://enjoyholic.tistory.com/4918", "동일 주소 메뉴 자료")],
  note: "예약 중심 운영으로 방문 전 확인이 필요하다.",
});
set(72, {
  status: "operating", confidence: "medium",
  sources: [source("https://triple.guide/restaurants/1bac7f22-9de6-462e-b4a0-12ff368f5a7a", "동일 주소 현행 업소 자료")],
});
set(73, {
  status: "temporarily_closed", confidence: "high",
  menus: [menu("열무비빔국수", "5,000원"), menu("통마늘노가리 소", "20,000원"), menu("통마늘노가리 중", "25,000원"), menu("통마늘노가리 대", "30,000원")],
  sources: [source("https://triple.guide/restaurants/0e857e0d-90e9-44a8-a4ba-9b1289fd257e", "임시휴업·메뉴 가격")],
});
set(74, { status: "relocated", confidence: "high", currentAddress: "전남 순천시 팔마1길 2 1층" });
set(75, {
  status: "temporarily_closed", confidence: "medium",
  menus: [
    menu("정식", "10,000원"), menu("정식 특", "15,000원"), menu("재첩국", "10,000원"),
    menu("김치찌개", "10,000원"), menu("된장찌개", "10,000원"), menu("동태탕", "10,000원"),
    menu("조기매운탕", "10,000원"), menu("갈치조림", "15,000원"), menu("아구찜 중", "40,000원"),
    menu("아구찜 대", "50,000원"), menu("돼지두루치기 중", "30,000원"), menu("돼지두루치기 대", "40,000원"),
  ],
  sources: [
    source("https://restaurantguru.com/%EB%A7%88%EB%A3%A8%EC%86%94%ED%95%9C%EC%A0%95%EC%8B%9D%EC%8B%9D%EB%8B%B9-Hadong-gun", "임시휴업 표기"),
    source("https://new.emmaru.com/matzip/matzip.do?code=M230201135100938610F&f=1&s=1&t=1", "메뉴 가격 자료"),
  ],
});
set(76, {
  status: "market_stall", confidence: "high",
  menus: [menu("문어 소포장", "10,000원"), menu("문어 대포장", "20,000원")],
  sources: [source("https://kr.trip.com/moments/theme/poi-seongdong-market-61792228-restaurant-993134/", "2026년 성동시장 방문 가격")],
});
set(77, {
  status: "operation_unverified", confidence: "low",
  sources: [source("https://hanis.tistory.com/60", "과거 방송 메뉴 자료")],
  note: "육개장 7,000원 과거 자료는 있으나 현재 영업 근거가 부족해 사이트에 반영하지 않았다.",
});
set(78, {
  status: "operation_unverified", confidence: "low",
  sources: [source("https://www.koobig.com/3733", "동일 주소 업소 자료")],
  note: "동일 주소 업소 기록은 확인했으나 현행 영업과 가격표를 확인하지 못했다.",
});
set(79, {
  status: "closed_confirmed", confidence: "high",
  sources: [source("https://polle.com/place/3rpsPn/%ED%95%AD%EA%B5%AC%EB%A7%88%EC%B0%A8", "폐점 표기")],
});
set(80, {
  status: "seasonal_operation", confidence: "medium",
  sources: [source("https://www.siksinhot.com/P/1276201", "동일 주소 해산물 판매점 자료")],
  note: "해산물 시세형 판매로 고정 공개 가격표를 확인하지 못했다.",
});
set(81, {
  status: "operating_no_public_price", confidence: "medium",
  sources: [
    source("https://korean.visitkorea.or.kr/detail/rem_detail.do?cotid=6e9b26aa-0764-4cc3-a9cd-ceeed31991e1", "한국관광공사 동일 주소 업소 안내"),
    source("https://findby.co.kr/details/03043-111103100012-st-652c0c2df27008be2c5567b8", "동일 주소 계속사업자 정보"),
  ],
  note: "동일 주소의 계속사업자 정보와 한국관광공사 업소 안내를 확인했지만 최신 공개 가격표는 찾지 못했다.",
});
set(82, {
  status: "closed_confirmed", confidence: "high",
  sources: [source("https://polle.com/place/2zDOti/%ED%96%A5%EA%B0%80", "폐점 표기")],
});
set(83, {
  status: "renamed_same_address", confidence: "high", currentName: "호계식당",
  menus: [menu("백반", "8,000원"), menu("된장찌개", "9,000원"), menu("김치찌개", "9,000원"), menu("조기찌개", "9,000원"), menu("동태찌개", "9,000원")],
  sources: [source("https://hsj8404.tistory.com/2732", "상호 변경·동일 주소 메뉴")],
});
set(84, {
  status: "relocated", confidence: "high", currentAddress: "대전 중구 대종로 258",
  sources: [source("https://www.diningcode.com/profile.php?rid=w6THXSDWun9B", "현행 주소·메뉴")],
});
set(86, {
  status: "seasonal_operation", confidence: "high",
  sources: [source("https://theqoo.net/findmeinyourmemory/3615467087", "2025년 현장 방문·계절 영업 안내")],
  note: "겨울철 중심 계절 영업이며 개별 붕어빵 단가는 공개 텍스트에서 확인하지 못했다.",
});
set(87, {
  status: "operating_no_public_price", confidence: "medium",
  sources: [
    source("https://www.114.co.kr/biznumber/detail/960d7c49299c", "2026년 동일 주소 사업자 정보"),
    source("https://www.siksinhot.com/P/320286", "동일 주소 업소·과거 메뉴 자료"),
  ],
  note: "2026년 동일 주소 사업자 정보를 확인했다. 꽈배기 2개 1,000원·찹쌀도넛 3개 1,000원은 과거 가격이라 사이트에는 반영하지 않았다.",
});
set(88, {
  status: "operating", confidence: "high",
  menus: [
    menu("트러플 파스타", "35,000원"), menu("보타르가", "37,000원"), menu("부라따", "35,000원"),
    menu("폴포", "27,000원"), menu("스콜리오", "33,000원"), menu("라구", "29,000원"),
    menu("카치오 에 페페", "27,000원"), menu("비스큐", "30,000원"), menu("사르데", "28,000원"),
    menu("오소부코 리조토", "35,000원"),
  ],
  sources: [source("https://polle.com/place/1toy45/%EB%9D%BC%EB%94%94%EC%B9%98", "현행 주소·메뉴")],
});
set(89, {
  status: "closed_confirmed", confidence: "high",
  sources: [source("https://polle.com/place/4xR3Cx/%EB%AA%A8%EC%9D%B4", "한남동 본점 폐점 표기")],
  note: "네이버가 반환한 강남 동명 식당은 제외했다.",
});
set(90, {
  status: "closed_confirmed", confidence: "high",
  sources: [source("https://polle.com/place/1a4b0w/%EC%88%98%EC%A0%95%EC%8B%9D%EB%8B%B9", "폐점 표기"), source("https://www.siksinhot.com/P/1646329", "동일 주소 대체 업소")],
  note: "통영 기존 주소는 해장국 업소로 대체되었으며 네이버의 거제 동명 식당 메뉴는 제외했다.",
});
set(91, {
  status: "operating", confidence: "medium",
  sources: [source("https://www.siksinhot.com/P/368273", "동일 주소 현행 업소 자료")],
  note: "고정 공개 가격표를 확인하지 못했다.",
});
set(92, { status: "relocated", confidence: "high", currentAddress: "서울 송파구 양재대로 932 지하1층 103-1호" });
set(93, {
  status: "operating", confidence: "high",
  menus: [
    menu("흑임자두텁", "4,000원"), menu("수제두텁", "3,000원"), menu("오색송편 1kg", "15,000원"),
    menu("바랑떡 1kg", "15,000원"), menu("송편 1kg", "13,000원"), menu("쑥인절미·현미인절미", "2,500원"),
    menu("영양찰떡", "2,500원"), menu("백설기", "2,000원"), menu("편 1kg", "18,000원"),
    menu("영양찰떡·마구설기 1kg", "18,000원"), menu("약식 1kg", "18,000원"),
    menu("콩고물인절미 1kg", "15,000원"), menu("절편 1kg", "9,000원"),
  ],
  sources: [source("https://www.diningcode.com/profile.php?rid=BpbgWgRIMSV4", "현행 영업시간·메뉴 가격")],
  note: "공식 홈페이지 주소(삼일대로 438)와 네이버 공장 주소(444-1)가 달라 상호·전화·메뉴만 반영하고 주소는 기존 값을 유지했다.",
});
set(94, {
  status: "operating", confidence: "high",
  menus: [menu("국수 600g", "4,000원"), menu("국수 10개 상자", "40,000원"), menu("국수 20개 상자", "80,000원")],
  sources: [source("https://polle.com/place/2apgn3/%EC%A0%9C%EC%9D%BC%EA%B5%AD%EC%88%98%EA%B3%B5%EC%9E%A5", "현행 제품 가격"), source("https://english.visitkorea.or.kr/svc/whereToGo/locIntrdn/rgnContentsView.do?vcontsId=189183", "한국관광공사 영업 자료")],
});
set(95, {
  status: "operating", confidence: "medium", currentName: "집밥진수성찬",
  sources: [source("https://fms.purpleo.co.kr/view/27265", "2024년 군산사랑상품권 가맹점 자료")],
  note: "현행 메뉴 가격표는 공개 자료에서 확인하지 못했다.",
});
set(96, {
  status: "operating", confidence: "medium",
  menus: [menu("양념닭갈비 3인", "37,000원")],
  sources: [source("https://m.menupan.com/restaurant/onepage.asp?acode=h120969", "동일 주소 메뉴 자료")],
});
set(97, {
  status: "renamed_same_address", confidence: "high", currentName: "서대문양꼬치 연남점",
  menus: [
    menu("매운돼지쪽갈비", "16,000원"), menu("양갈비살꼬치", "12,000원"), menu("찹쌀탕수육", "16,000원"),
    menu("사천매운전골", "25,000원"), menu("돼지고기가지요리", "16,000원"), menu("양고기전골", "25,000원"),
  ],
  sources: [source("https://polle.com/place/4Fr8XL/%EC%84%9C%EB%8C%80%EB%AC%B8%EC%96%91%EA%BC%AC%EC%B9%98%20%EC%97%B0%EB%82%A8%EC%A0%90", "현행 상호·메뉴")],
  note: "같은 주소의 과거 2층 서대문양꼬치는 폐점했지만 현재 연남점 등록이 영업 중이어서 현행 매장으로 교체했다.",
});
set(98, { status: "relocated", confidence: "high", currentAddress: "서울 마포구 성미산로32길 20-5" });
set(99, {
  status: "closed_confirmed", confidence: "high",
  sources: [source("https://polle.com/place/1gkrku/%EC%BD%94%EC%8A%A4%EB%AA%A8%20%EC%8A%A4%EC%8B%9C", "폐점 표기")],
});
set(100, {
  status: "operating", confidence: "high",
  menus: [
    menu("뿌님팟퐁커리", "31,000원"), menu("사왓디만두", "13,000원"), menu("그린커리", "17,000원"),
    menu("랭쎕", "30,000원"), menu("텃만꿍 4개", "16,000원"), menu("쏨땀", "13,000원"),
    menu("얌운센", "13,000원"), menu("카오팟", "13,000원"), menu("갈비국수", "13,500원"),
    menu("팟크라파오", "14,000원"), menu("팟타이", "14,000원"), menu("똠셉", "17,000원"),
    menu("음료", "3,000원"),
  ],
  sources: [source("https://autoreserve.com/ko/restaurants/a9tXCgims5yHVNAfv34m", "2026년 현행 메뉴 가격")],
});

function cleanName(value) {
  return String(value ?? "")
    .replace(/\s*\([^)]*(?:시장|거리|식당|점)[^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAddress(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .trim();
}

function findByIdentity(restaurants, target, datasetId) {
  const direct = restaurants.find((restaurant) => restaurant.id === target.id);
  if (direct) return direct;
  const identities = [
    {
      name: cleanName(target.currentName || target.name).replace(/\s/g, ""),
      address: normalizeAddress(target.currentAddress || target.address),
    },
    {
      name: cleanName(target.originalName || target.name).replace(/\s/g, ""),
      address: normalizeAddress(target.originalAddress || target.address),
    },
  ].filter(
    (identity, index, values) =>
      identity.name &&
      values.findIndex(
        (candidate) => candidate.name === identity.name && candidate.address === identity.address,
      ) === index,
  );
  return restaurants.find((restaurant) => {
    const candidateName = cleanName(restaurant.name).replace(/\s/g, "");
    const candidateAddress = normalizeAddress(restaurant.address);
    return identities.some(({ name, address }) => {
      const nameMatch = candidateName.includes(name) || name.includes(candidateName);
      const addressMatch =
        address && candidateAddress &&
        (address.includes(candidateAddress) ||
          candidateAddress.includes(address) ||
          address.slice(-10) === candidateAddress.slice(-10));
      return nameMatch && (addressMatch || datasetId === "old-korean-100");
    });
  });
}

const restaurants = raw.restaurants.map((item, offset) => {
  const index = offset + 1;
  let status = "operation_unverified";
  let confidence = "low";
  let menus = [];
  let sources = [];
  let note = "네이버 지도에서 식당명·주소가 일치하는 현행 장소를 찾지 못했고, 추가 웹 검색에서도 현재 영업을 단정할 근거가 부족했다.";

  if (naverVerifiedMenus.has(index)) {
    status = "operating";
    confidence = "high";
    menus = item.menus ?? [];
    sources = item.url ? [source(item.url, "네이버 지도 현행 메뉴")] : [];
    note = "식당명과 주소를 대조한 네이버 지도 현행 메뉴를 반영했다.";
  } else if (naverVerifiedNoMenu.has(index)) {
    status = "operating_no_public_price";
    confidence = "high";
    sources = item.url ? [source(item.url, "네이버 지도 현행 장소")] : [];
    note = "식당명과 주소가 일치하는 현행 장소는 확인했지만 공개 메뉴 탭 또는 가격표가 없다.";
  }

  const patch = overrides.get(index) ?? {};
  const patchedMenus = Object.hasOwn(patch, "menus") ? patch.menus : menus;
  const patchedSources = Object.hasOwn(patch, "sources") ? patch.sources : sources;
  return {
    index,
    id: item.id,
    sources: item.sources,
    originalName: item.name,
    currentName: patch.currentName ?? cleanName(item.name),
    originalAddress: item.address,
    currentAddress: patch.currentAddress ?? item.address,
    status: patch.status ?? status,
    confidence: patch.confidence ?? confidence,
    menus: patchedMenus,
    evidence: patchedSources,
    note: patch.note ?? note,
    naverFirstPass: {
      outcome: item.outcome,
      ...(item.placeId ? { placeId: item.placeId } : {}),
      ...(item.pageAddress ? { pageAddress: item.pageAddress } : {}),
      ...(item.jibun ? { jibun: item.jibun } : {}),
      rejectedAsDifferentPlace:
        item.outcome !== "not_found" &&
        !naverVerifiedMenus.has(index) &&
        !naverVerifiedNoMenu.has(index) &&
        ![4, 21, 24, 74, 84].includes(index),
    },
  };
});

const datasetFiles = {
  "sikgaek-baekban-trip": {
    source: path.join(root, "source-data", "sikgaek-baekban-trip", "menu-prices.json"),
    generated: [
      path.join(root, "matpick_all", "client", "src", "data", "generated", "sikgaek-baekban-trip.generated.json"),
      path.join(root, "matpick_all", "client", "src", "data", "generated", "topic-enrichments", "baekban-trip.enriched.json"),
    ],
  },
  "wednesday-gourmet": {
    source: path.join(root, "source-data", "wednesday-gourmet", "menu-prices.json"),
    generated: [
      path.join(root, "matpick_all", "client", "src", "data", "generated", "wednesday-gourmet.generated.json"),
      path.join(root, "matpick_all", "client", "src", "data", "generated", "topic-enrichments", "wednesday-gourmet.enriched.json"),
    ],
  },
  "baekjong-wok": {
    source: path.join(root, "source-data", "baekjong-wok", "menu-prices.json"),
    generated: [path.join(root, "matpick_all", "client", "src", "data", "generated", "topic-enrichments", "baekjong-wok.enriched.json")],
  },
  "old-korean-100": {
    source: path.join(root, "source-data", "old-korean-100", "menu-prices.json"),
    generated: [
      path.join(root, "matpick_all", "client", "src", "data", "generated", "old-korean-100.generated.json"),
      path.join(root, "matpick_all", "client", "src", "data", "generated", "topic-enrichments", "old-korean-100.enriched.json"),
    ],
  },
};

function operationFields(result) {
  if (result.status === "closed_confirmed") return { operationStatus: "폐업 확인", menuPriceStatus: "closed_confirmed" };
  if (result.status === "closed_likely") return { operationStatus: "폐업 추정", menuPriceStatus: "closed_likely" };
  if (result.status === "operating_no_public_price") {
    return {
      operationStatus: "영업 확인 · 공개 가격 없음",
      menuPriceStatus: "excluded_no_public_price",
    };
  }
  if (result.status === "temporarily_closed") return { operationStatus: "임시 휴업", menuPriceStatus: "temporarily_closed" };
  if (result.status === "operation_unverified") return { operationStatus: "영업 여부 미확인", menuPriceStatus: "operation_unverified" };
  if (result.status === "restricted_operation") return { operationStatus: "일반 방문 제한", menuPriceStatus: "not_single_restaurant" };
  const hasMenus = result.menus.length > 0;
  return {
    operationStatus: "영업 확인",
    menuPriceStatus: hasMenus ? "matched_with_priced_menu_secondary_source" : "public_menu_unavailable",
  };
}

function normalizedMenus(restaurantId, menus) {
  return menus.map((item, index) => ({
    id: `${restaurantId}_menu_${String(index + 1).padStart(3, "0")}`,
    name: item.name,
    price: item.price,
    ...(item.description ? { description: item.description } : {}),
    isSignature: index === 0,
    sourceOrdinal: index + 1,
  }));
}

function patchRecord(record, result, datasetId) {
  const fields = operationFields(result);
  const closed = ["closed_confirmed", "closed_likely"].includes(result.status);
  const canPublishMenus = !["operation_unverified", "relocated_address_unresolved", "restricted_operation"].includes(result.status);
  const nextMenus = closed ? [] : canPublishMenus && result.menus.length ? normalizedMenus(record.id, result.menus) : record.menus ?? [];
  const currentName = result.currentName || record.name;
  const currentAddress = result.currentAddress || record.address;
  return {
    ...record,
    name: currentName,
    address: currentAddress,
    region: currentAddress.split(/\s+/).slice(0, 2).join(" "),
    representativeMenu: nextMenus.map((item) => item.name).slice(0, 3).join(" / ") || record.representativeMenu || "",
    menus: nextMenus,
    ...fields,
    menuPriceVerifiedAt: verifiedAt,
    menuPriceNote: result.note,
    menuPriceSources: result.evidence,
    researchDatasetId: datasetId,
  };
}

const updateCounts = { sourceRecords: 0, generatedRecords: 0 };
function restoreLegacyPowerShellFormatting(filePath) {
  if (!filePath.endsWith("wednesday-gourmet.generated.json")) return;
  const escapedPath = filePath.replace(/'/g, "''");
  const command = `$p='${escapedPath}'; $json=Get-Content -LiteralPath $p -Raw -Encoding utf8 | ConvertFrom-Json | ConvertTo-Json -Depth 100; Set-Content -LiteralPath $p -Value $json -Encoding utf8`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", command], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || "Failed to restore legacy JSON formatting");
  }
}

for (const [datasetId, files] of Object.entries(datasetFiles)) {
  const targets = restaurants.filter((result) => result.sources.some((item) => item.id === datasetId));
  if (!targets.length) continue;

  const sourcePayload = readJson(files.source);
  sourcePayload.restaurants ??= {};
  for (const result of targets) {
    let key = Object.hasOwn(sourcePayload.restaurants, result.id) ? result.id : null;
    if (!key) {
      key = Object.keys(sourcePayload.restaurants).find((candidateKey) => {
        const candidate = sourcePayload.restaurants[candidateKey];
        return findByIdentity([{ id: candidateKey, ...candidate }], result, datasetId);
      });
    }
    if (!key) continue;
    sourcePayload.restaurants[key] = patchRecord({ id: key, ...sourcePayload.restaurants[key] }, result, datasetId);
    delete sourcePayload.restaurants[key].id;
    updateCounts.sourceRecords += 1;
  }
  sourcePayload.collectedAt = verifiedAt;
  writeJson(files.source, sourcePayload);

  for (const generatedPath of files.generated) {
    if (!fs.existsSync(generatedPath)) continue;
    const payload = readJson(generatedPath);
    let changed = false;
    for (const result of targets) {
      const record = findByIdentity(payload.restaurants ?? [], result, datasetId);
      if (!record) continue;
      const index = payload.restaurants.indexOf(record);
      payload.restaurants[index] = patchRecord(record, result, datasetId);
      changed = true;
      updateCounts.generatedRecords += 1;
    }
    if (changed) {
      payload.generatedAt = verifiedAt;
      writeJson(generatedPath, payload);
      restoreLegacyPowerShellFormatting(generatedPath);
    }
  }
}

const summary = restaurants.reduce(
  (accumulator, result) => {
    accumulator[result.status] = (accumulator[result.status] ?? 0) + 1;
    accumulator.menuRestaurantCount += result.menus.length > 0 ? 1 : 0;
    accumulator.menuCount += result.menus.length;
    return accumulator;
  },
  { menuRestaurantCount: 0, menuCount: 0 },
);

writeJson(finalPath, {
  title: "맛픽 재조사 대상 101곳 최종 인터넷 조사",
  researchedAt: verifiedAt,
  methodology: [
    "네이버 지도에서 식당명과 도로명·지번 주소를 함께 검색하고 메뉴 탭 전체 항목을 확인",
    "동명이인의 다른 식당으로 판정된 메뉴는 폐기",
    "폐업·이전·상호 변경은 별도 공개 자료로 교차 확인",
    "현재 영업이 확인되지 않은 곳은 폐업으로 단정하지 않고 영업 여부 미확인으로 분리",
  ],
  summary,
  updateCounts,
  restaurants,
});

const statusLabel = {
  operating: "영업 확인",
  operating_no_public_price: "영업 확인·공개 가격 없음",
  relocated: "주소 이전",
  renamed_relocated: "상호 변경·주소 이전",
  renamed_same_address: "상호 변경",
  relocated_address_unresolved: "이전 확인·새 주소 미확인",
  closed_confirmed: "폐업 확인",
  closed_likely: "폐업 추정",
  temporarily_closed: "임시 휴업",
  seasonal_operation: "계절·시세형 영업",
  market_stall: "시장 점포 영업",
  restricted_operation: "일반 방문 제한",
  operation_unverified: "영업 여부 미확인",
};

const lines = [
  "# 맛픽 재조사 대상 101곳 최종 인터넷 조사",
  "",
  `- 조사 기준일: 2026-07-19 (KST)`,
  `- 대상: ${restaurants.length}곳 (백반기행 86, 수요미식회 13, 백종원의 3대천왕 2, 미쉐린 0; 한국인 100선 중복 1)`,
  `- 가격이 하나 이상 확인된 식당: ${summary.menuRestaurantCount}곳 / 메뉴 ${summary.menuCount}개`,
  `- 폐업 확인: ${summary.closed_confirmed ?? 0}곳`,
  `- 폐업 추정: ${summary.closed_likely ?? 0}곳`,
  `- 임시 휴업: ${summary.temporarily_closed ?? 0}곳`,
  `- 영업 여부 미확인: ${summary.operation_unverified ?? 0}곳`,
  "",
  "동일 상호의 다른 식당 메뉴는 주소 대조 단계에서 폐기했다. 검색 결과가 없다는 이유만으로 폐업 처리하지 않았으며, 폐점 표기나 동일 주소 대체 업소 등 근거가 있는 경우에만 폐업/폐업 추정으로 분류했다.",
  "",
  "| # | 출처 | 식당 | 상태 | 현재 주소 | 확인 메뉴 | 근거/비고 |",
  "|---:|---|---|---|---|---:|---|",
];

for (const result of restaurants) {
  const sourceNames = result.sources.map((item) => item.name).join("·");
  const links = result.evidence.length
    ? result.evidence.map((item, index) => `[근거${index + 1}](${item.url})`).join(" ")
    : "근거 링크 없음";
  const note = `${links} ${result.note}`.replace(/\|/g, "\\|");
  lines.push(
    `| ${result.index} | ${sourceNames} | ${result.currentName} | ${statusLabel[result.status] ?? result.status} | ${result.currentAddress.replace(/\|/g, "\\|")} | ${result.menus.length} | ${note} |`,
  );
  if (result.menus.length) {
    lines.push("", ...result.menus.map((item) => `  - ${item.name}: ${item.price}${item.description ? ` — ${item.description}` : ""}`), "");
  }
}

fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
console.log(JSON.stringify({ summary, updateCounts, finalPath, reportPath }, null, 2));
