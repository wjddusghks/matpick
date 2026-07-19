import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "source-data", "baekjong-wok", "menu-prices.json");
const reportPath = path.join(root, "docs", "baekjong-wok-menu-closure-research-2026-07-19.md");
const verifiedAt = "2026-07-19T12:00:00+09:00";

function menuRows(rows) {
  return rows.map((row, index) => {
    const [name, price, description = ""] = row;
    return {
      name,
      price,
      ...(description ? { description } : {}),
      isSignature: index === 0,
      sourceOrdinal: index + 1,
    };
  });
}

function priced(fields) {
  return {
    status: "matched_with_priced_menu",
    verifiedAt,
    operationStatus: fields.operationStatus ?? "영업",
    representativeMenu: fields.menus[0][0],
    note: fields.note,
    sourceLabel: fields.sourceLabel,
    sourceUrl: fields.sourceUrl,
    placeUrl: fields.placeUrl ?? fields.sourceUrl,
    ...(fields.kakaoPlaceId ? { kakaoPlaceId: fields.kakaoPlaceId } : {}),
    ...(fields.pageName ? { pageName: fields.pageName } : {}),
    ...(fields.pageAddress ? { pageAddress: fields.pageAddress } : {}),
    ...(fields.currentName ? { currentName: fields.currentName } : {}),
    ...(fields.currentAddress ? { currentAddress: fields.currentAddress } : {}),
    ...(Number.isFinite(fields.currentLat) ? { currentLat: fields.currentLat } : {}),
    ...(Number.isFinite(fields.currentLng) ? { currentLng: fields.currentLng } : {}),
    ...(fields.phone ? { phone: fields.phone } : {}),
    ...(fields.operationSummary ? { operationSummary: fields.operationSummary } : {}),
    sources: fields.sources ?? [{ url: fields.sourceUrl, label: fields.sourceLabel }],
    menus: menuRows(fields.menus),
  };
}

function closed(status, note, sourceUrl, evidenceLabel = "폐업·교체 근거") {
  return {
    status,
    verifiedAt,
    operationStatus: status === "closed_confirmed" ? "폐업 확인" : "폐업 추정",
    operationSummary: note,
    note,
    sourceUrl,
    placeUrl: sourceUrl,
    sources: sourceUrl ? [{ url: sourceUrl, label: evidenceLabel }] : [],
    menus: [],
  };
}

function unverified(note, sourceUrl = "") {
  return {
    status: "operation_unverified",
    verifiedAt,
    operationStatus: "영업 여부 미확인",
    operationSummary: note,
    note,
    sourceUrl,
    placeUrl: sourceUrl,
    sources: sourceUrl ? [{ url: sourceUrl, label: "공개 매장 정보" }] : [],
    menus: [],
  };
}

const updates = {
  "topic_enrichment_baekjong-wok_a77a994d11bc": priced({
    operationStatus: "영업(이전)",
    operationSummary: "부산 서구 부용로38번길 3으로 이전해 거인통닭 본점으로 영업 중.",
    pageName: "거인통닭 본점",
    pageAddress: "부산 서구 부용로38번길 3 1층",
    currentName: "거인통닭 본점",
    currentAddress: "부산 서구 부용로38번길 3 1층",
    currentLat: 35.10752399593097,
    currentLng: 129.01904394244934,
    kakaoPlaceId: "8688860",
    sourceUrl: "https://m.place.naver.com/restaurant/16425005/menu/list",
    sourceLabel: "네이버 플레이스 현재 공개 메뉴",
    note: "저장 주소에서는 영업하지 않으며 부산 서구 부용로38번길 3의 이전 매장 메뉴를 반영함.",
    menus: [["치킨", "26,000원", "후라이드치킨"], ["음료수", "2,000원"]],
  }),
  "topic_enrichment_baekjong-wok_b52a0e6ece80": priced({
    operationStatus: "영업(이전)",
    operationSummary: "대전 중구 충무로92번길 50으로 이전해 영업 중.",
    pageAddress: "대전 중구 충무로92번길 50",
    currentAddress: "대전 중구 충무로92번길 50 1층",
    currentLat: 36.315579702511556,
    currentLng: 127.42849183483388,
    kakaoPlaceId: "10159821",
    sourceUrl: "https://m.place.naver.com/restaurant/16049935/menu/list",
    sourceLabel: "네이버 플레이스 현재 공개 메뉴",
    note: "저장 주소가 아닌 대전 중구 충무로92번길 50의 이전 매장 메뉴를 반영함.",
    menus: [["검은콩국수", "12,000원"], ["노란콩국수", "11,000원"], ["사리 1인분", "4,000원"], ["검정콩물 1.5L(3인)", "20,000원"], ["노랑콩물 1.5L(3인)", "17,000원"]],
  }),
  "topic_enrichment_baekjong-wok_b7b4d097d081": closed("closed_confirmed", "뽈레가 저장 주소의 공주분식을 폐점으로 표시함.", "https://polle.com/place/1xXdkk/%EA%B3%B5%EC%A3%BC%EB%B6%84%EC%8B%9D", "뽈레 폐점 표기"),
  "topic_enrichment_baekjong-wok_58613205c46d": closed("closed_likely", "연남동 식당은 지도에서 사라졌고 저장 주소에는 해브·무심·광계가 영업 중. 동명 법인은 남양주의 식품판매업으로 확인됨.", "https://place.map.kakao.com/1707839290", "저장 주소 현 입점업체"),
  "topic_enrichment_baekjong-wok_88ee18fc3f75": priced({
    operationStatus: "영업(이전)",
    operationSummary: "서울 동작구 성대로1길 8 1층으로 이전해 영업 중.",
    pageAddress: "서울 동작구 성대로1길 8 1층",
    currentAddress: "서울 동작구 성대로1길 8 1층",
    currentLat: 37.50047722789794,
    currentLng: 126.93297362061516,
    sourceUrl: "https://m.place.naver.com/restaurant/2006095781/menu/list",
    sourceLabel: "네이버 플레이스 현재 공개 메뉴",
    note: "저장 주소가 아닌 상도동 이전 매장의 공개 메뉴를 반영함.",
    menus: [["오리지널수제비", "10,000원"], ["들깨수제비", "10,000원"], ["얼큰수제비", "10,000원"]],
  }),
  "topic_enrichment_baekjong-wok_f2fc96d3b48f": closed("closed_confirmed", "사업자 상태 조회에서 2021-07-29 폐업으로 확인됨.", "https://www.bizno.net/", "사업자 상태 조회"),
  "topic_enrichment_baekjong-wok_6806254363fb": closed("closed_likely", "저장 주소의 현 음식점은 역전할머니맥주 서울낙성대역점이며 돈파스팔레의 현재 지도 등록이 없음.", "https://place.map.kakao.com/1033840304", "저장 주소 현 입점업체"),
  "topic_enrichment_baekjong-wok_7d54f4dd5491": closed("closed_likely", "저장 주소 1층은 우리할매떡볶이 홍대점 등으로 교체됐고 마녀커리크림치킨의 현재 지도 등록이 없음.", "https://place.map.kakao.com/841974108", "저장 주소 현 입점업체"),
  "topic_enrichment_baekjong-wok_e20430d65c36": priced({
    phone: "02-795-9441",
    pageAddress: "서울 용산구 이태원로 164-1 1층",
    sourceUrl: "https://m.place.naver.com/restaurant/11893060/menu/list",
    sourceLabel: "네이버 플레이스 현재 공개 메뉴",
    note: "공개 메뉴 32개를 반영함. 비프 코프타 타진과 스파게티 위드 미트볼의 2,000원 표기는 여러 공개 서비스에 동일하게 노출되지만 오기 가능성이 있어 확인 필요.",
    sources: [{ url: "https://m.place.naver.com/restaurant/11893060/menu/list", label: "네이버 플레이스 공개 메뉴" }, { url: "https://www.diningcode.com/profile.php?rid=60KA3TpMspJ1", label: "다이닝코드 공개 메뉴 교차 확인" }],
    menus: [
      ["레몬치킨", "20,000원"], ["소고기코프타", "20,000원"], ["포테이토 타진", "20,000원"], ["쉬림프 타진", "25,000원"],
      ["그린피 타진", "20,000원"], ["트파야 타진", "20,000원"], ["비프 코프타 타진", "2,000원", "공개 표기값. 오기 가능성이 있어 주문 전 확인 필요"],
      ["그릴드 비프 스테이크 위드 브라운 소스", "30,000원"], ["그릴드 살몬 위드 타르타르 소스", "25,000원"], ["로얄 쿠스쿠스", "30,000원"],
      ["쉬림프 샐러드", "15,000원"], ["올리브 샐러드", "5,000원"], ["타블리 샐러드", "7,000원"], ["가든 튜나 샐러드", "15,000원"],
      ["잘룩 샐러드", "7,000원"], ["호무스", "7,000원"], ["호무스 위드 비프 코프타", "12,000원"], ["하리라 스프", "7,000원"],
      ["모로칸 샌드위치", "8,000원"], ["샤크쉬우커 샐러드", "15,000원"], ["팔라펠 세트", "20,000원"],
      ["스파게티 위드 미트볼", "2,000원", "공개 표기값. 오기 가능성이 있어 주문 전 확인 필요"], ["쿠스쿠스 위드 비프·램·치킨 중 선택", "20,000원"],
      ["비프 꼬치 요리", "25,000원"], ["램 꼬치 요리", "25,000원"], ["치킨 꼬치 요리", "20,000원"], ["믹스 그릴", "30,000원"],
      ["램 챱", "35,000원"], ["바스티야", "30,000원"], ["모로칸 쿠키", "10,000원"], ["민트티", "10,000원"], ["모로칸 커피", "10,000원"],
    ],
  }),
  "topic_enrichment_baekjong-wok_8ee8283cae53": priced({
    pageName: "미성복어불고기 들안길 본점",
    pageAddress: "대구 수성구 들안로 87",
    sourceUrl: "https://m.place.naver.com/restaurant/11724371/menu/list",
    sourceLabel: "네이버 플레이스 현재 공개 메뉴",
    note: "네이버 플레이스의 현재 공개 메뉴를 반영함.",
    menus: [["까치콩나물불고기", "21,000원"], ["까치모듬불고기", "24,000원"], ["참복어탕 또는 맑은탕", "21,000원", "국내산"], ["복어튀김", "27,000~35,000원"], ["콩나물불고기", "18,000원"], ["밀복어탕 또는 맑은탕", "16,000원", "국내산"], ["얼큰복어탕", "17,000원"], ["껍질무침회", "20,000원"], ["어린이 메뉴 복까스", "10,000원"]],
  }),
  "topic_enrichment_baekjong-wok_295d210602ba": closed("closed_likely", "저장 주소에는 서울미트볼 선유도역점이 영업 중이며 해당 식당의 현재 지도 등록이 없음.", "https://place.map.kakao.com/3421919", "저장 주소 현 입점업체"),
  "topic_enrichment_baekjong-wok_edf94f28e740": closed("closed_likely", "저장 주소에는 카페토브가 영업 중이며 발리비스트로의 현재 지도 등록이 없음.", "https://place.map.kakao.com/1920277019", "저장 주소 현 입점업체"),
  "topic_enrichment_baekjong-wok_2c7e4e9fcf73": priced({
    operationStatus: "영업 여부 주의",
    operationSummary: "파주시 공개 가맹점·식품영업 자료에는 남아 있으나 포털 지도 등록은 확인되지 않음.",
    phone: "031-941-3660",
    sourceUrl: "https://stay-gyo.tistory.com/entry/%ED%8C%8C%EC%A3%BC-%EB%85%B8%ED%8F%AC-%EB%B3%B4%EB%B0%B0%EC%A7%91-%EA%B5%AD%EA%B0%80%EA%B0%80-%ED%97%88%EB%9D%BD%ED%95%9C-%EC%9C%A1%EA%B0%9C%EC%9E%A5-%EB%85%B8%ED%8F%AC",
    sourceLabel: "2022년 방문 메뉴판",
    note: "2026년 공개 가맹점 자료에는 사업장이 남아 있으나 지도 등록을 확인하지 못함. 가격은 2022년 1월 방문 메뉴판 기준이므로 방문 전 전화 확인 필요.",
    sources: [{ url: "https://www.paju.go.kr/", label: "파주시 공개 가맹점 자료" }, { url: "https://stay-gyo.tistory.com/entry/%ED%8C%8C%EC%A3%BC-%EB%85%B8%ED%8F%AC-%EB%B3%B4%EB%B0%B0%EC%A7%91-%EA%B5%AD%EA%B0%80%EA%B0%80-%ED%97%88%EB%9D%BD%ED%95%9C-%EC%9C%A1%EA%B0%9C%EC%9E%A5-%EB%85%B8%ED%8F%AC", label: "2022년 방문 메뉴판" }],
    menus: [["육개장", "8,000원"], ["뚝배기불고기", "8,000원"], ["선지해장국", "7,000원"], ["전통삼계탕", "14,000원"]],
  }),
  "topic_enrichment_baekjong-wok_89266777bbf7": closed("closed_likely", "저장 주소에는 찜닭세상·동울산대학약국 등이 등록돼 있고 북경통닭의 현재 지도 등록이 없음.", "https://place.map.kakao.com/1829630936", "저장 주소 현 입점업체"),
  "topic_enrichment_baekjong-wok_135d7666fa1b": closed("closed_likely", "저장 주소와 일치하는 현재 식당 등록을 찾지 못했고 동명의 다른 성북구 식당만 확인됨.", "https://place.map.kakao.com/212725476", "동명 타 주소 매장"),
  "topic_enrichment_baekjong-wok_5a1237af7f4b": unverified("송탄시장 노점으로 보이며 현재 지도 등록·최근 가격표를 확인하지 못함. 폐업으로 단정하지 않음."),
  "topic_enrichment_baekjong-wok_de1345dcdc05": priced({
    operationStatus: "영업 여부 주의",
    operationSummary: "공공 음식점 인허가 자료와 관광 정보에는 남아 있으나 포털 지도 등록은 확인되지 않음.",
    phone: "02-739-2122",
    sourceUrl: "https://www.siksinhot.com/P/33320",
    sourceLabel: "식신 공개 메뉴",
    note: "식신은 운영 여부 미확인 안내를 표시하고 있어 방문 전 전화 확인 필요. 공개 메뉴 가격을 반영함.",
    sources: [{ url: "https://www.siksinhot.com/P/33320", label: "식신 공개 메뉴·운영 여부 주의" }, { url: "https://opengo.kr/5601fb4e0e887edf2ce6c1f1", label: "공개 음식점 인허가 자료" }],
    menus: [["2인 스테이크 SET B", "50,000원"], ["마르게리따 피자", "16,000원"], ["깔조네 피자", "18,000원"], ["페스카토레", "16,000원"], ["치킨아라비아따", "16,000원"], ["페페론 알리오 올리오", "15,000원"], ["빠네스파게티", "16,000원"], ["오징어먹물리조또", "16,000원"], ["안심스테이크", "39,000원"], ["등심스테이크", "39,000원"], ["라자냐", "17,000원"]],
  }),
  "topic_enrichment_baekjong-wok_a1c6c2c6bac4": unverified("수유재래시장 노점형 매장으로 보이며 현재 지도 등록·최근 가격표를 확인하지 못함. 폐업으로 단정하지 않음."),
  "topic_enrichment_baekjong-wok_bcc3d4b990f7": closed("closed_likely", "저장 주소 일대에는 구리냉삼집·숙이네곱창&막창 등이 영업 중이며 해당 어우동의 현재 등록이 없음.", "https://place.map.kakao.com/162320001", "저장 주소 현 입점업체"),
  "topic_enrichment_baekjong-wok_29f7bffd4126": priced({
    operationStatus: "영업 여부 주의",
    operationSummary: "이천종합터미널 내 점포로 포털 지도 등록은 없으나 공개 식당 정보에 영업시간·전화·메뉴가 남아 있음.",
    phone: "031-635-5089",
    sourceUrl: "https://www.siksinhot.com/P/479906",
    sourceLabel: "식신 공개 메뉴",
    note: "터미널 입점 점포라 독립 지도 등록이 확인되지 않음. 공개 메뉴 가격을 반영했으며 방문 전 전화 확인 권장.",
    menus: [["떡볶이", "4,000원"], ["만두", "3,000원"], ["순대", "4,000원"], ["오징어튀김", "4,000원"], ["오탕만", "13,000원"], ["오탕순떡볶이", "13,000원"], ["주순스페셜", "16,000원"], ["주오탕만", "16,000원"], ["주탕순만떡볶이", "16,000원"], ["주탕순오떡볶이", "16,000원"], ["주탕스페셜", "16,000원"], ["참치주먹밥", "2,500원"], ["탕수육", "4,000원"], ["탕순만떡볶이", "13,000원"]],
  }),
  "topic_enrichment_baekjong-wok_4556e0c0aebd": priced({
    operationStatus: "영업 여부 주의",
    operationSummary: "영천시장 노점형 점포로 현재 운영 여부가 독립 지도에서 확인되지 않음.",
    sourceUrl: "https://www.siksinhot.com/P/1341229",
    sourceLabel: "식신 공개 메뉴",
    note: "식신이 운영 여부 미확인 안내를 표시함. 공개 메뉴 가격을 반영했으며 방문 전 확인 필요.",
    menus: [["김밥", "3,000원"], ["떡볶이", "3,000원"], ["순대", "3,000원"], ["어묵", "3,000원"], ["튀김", "3,000원"]],
  }),
  "topic_enrichment_baekjong-wok_28f264d7f33b": priced({
    pageName: "온천할머니보리밥",
    pageAddress: "광주 동구 지호로127번길 29",
    currentName: "온천할머니보리밥",
    currentAddress: "광주 동구 지호로127번길 29",
    sourceUrl: "https://m.place.naver.com/restaurant/1135838529/menu/list",
    sourceLabel: "네이버 플레이스 현재 공개 메뉴",
    note: "현재 상호 온천할머니보리밥의 공개 메뉴를 반영함.",
    menus: [["보리밥", "12,000원"], ["제육볶음", "15,000원"], ["도토리묵", "10,000원"]],
  }),
  "topic_enrichment_baekjong-wok_fa72469d5025": closed("closed_confirmed", "뽈레가 저장 주소의 왕타이를 폐점으로 표시함.", "https://polle.com/place/2mIrJD/%EC%99%95%20%ED%83%80%EC%9D%B4", "뽈레 폐점 표기"),
  "topic_enrichment_baekjong-wok_c2fb2621bd82": priced({
    operationSummary: "미나리 제철(통상 2~5월)에 운영하는 농원형 매장.",
    sourceUrl: "https://www.siksinhot.com/P/382834",
    sourceLabel: "식신 공개 메뉴",
    note: "카카오맵 영업 상태와 식신 공개 가격을 교차 확인함. 계절 운영 가능성이 있어 방문 전 확인 필요.",
    sources: [{ url: "https://place.map.kakao.com/1989443210", label: "카카오맵 영업 상태" }, { url: "https://www.siksinhot.com/P/382834", label: "식신 공개 메뉴" }],
    menus: [["미나리 1kg", "10,000원"], ["불판대여", "5,000원"]],
  }),
  "topic_enrichment_baekjong-wok_212c028dc6f7": closed("closed_likely", "저장 주소에는 코스트노쉬·꽃님다락방 등 다른 업체가 등록돼 있고 원조40번의 현재 등록이 없음.", "https://place.map.kakao.com/421250025", "저장 주소 현 입점업체"),
  "topic_enrichment_baekjong-wok_43e5c84f86d6": priced({
    pageName: "범일동매떡",
    pageAddress: "부산 부산진구 골드테마길 52-2",
    kakaoPlaceId: "8033712",
    sourceUrl: "https://place.map.kakao.com/8033712",
    sourceLabel: "카카오맵 현재 공개 메뉴",
    note: "카카오맵에서 2025-12-04 갱신된 메뉴를 반영함.",
    menus: [["매떡(7)", "7,000원"], ["어묵(5)", "5,000원"], ["순떡(7)", "7,000원"], ["팥빙수", "5,000원"], ["오찡어(6)", "6,000원"], ["애기김밥(8)", "4,000원"], ["튀만두(6)", "4,000원"], ["튀김밥(6)", "4,000원"], ["모듬튀김 set(9)", "7,000원"]],
  }),
  "topic_enrichment_baekjong-wok_291c9dfd8ca9": closed("closed_likely", "저장 주소와 일치하는 현재 음식점 등록을 찾지 못했고 동명의 타 업종·타 주소 업체만 확인됨.", "https://place.map.kakao.com/1698456633", "동명 타 업종 업체"),
  "topic_enrichment_baekjong-wok_5c52f09e0973": priced({
    operationStatus: "영업(이전·상호변경)",
    operationSummary: "리틀윌리엄스버거카페로 상호를 바꾸고 경기 용인시 수지구 고기로 497에서 영업 중.",
    pageName: "리틀윌리엄스버거카페",
    pageAddress: "경기 용인시 수지구 고기로 497",
    currentName: "리틀윌리엄스버거카페",
    currentAddress: "경기 용인시 수지구 고기로 497 1층",
    currentLat: 37.35985661168228,
    currentLng: 127.05445282637879,
    kakaoPlaceId: "578610807",
    sourceUrl: "https://m.place.naver.com/restaurant/2029751438/menu/list",
    sourceLabel: "네이버 플레이스 현재 공개 메뉴",
    note: "판교 저장 주소가 아닌 용인 고기리 이전·상호변경 매장의 현재 공개 메뉴를 반영함.",
    menus: [["베이컨 클램차우더수프", "9,000원"], ["베이컨에그인헬", "11,000원"], ["베이컨 치킨시저샐러드", "19,000원"], ["비프타코샐러드", "19,000원"], ["B.L.T 샌드위치", "14,000원"], ["루꼴라 살루미화덕피자샌드위치", "17,000원"], ["살루미화덕피자", "15,000원"], ["브룩클린버거", "18,000원"], ["하와이안버거", "19,500원"], ["미트러버스버거", "19,500원"], ["타코버거", "16,000원"], ["LWC 프렌치토스트", "18,000원"], ["라구볼로네제파스타", "22,000원"], ["토마토비프함박스테이크", "23,000원"], ["베이컨 칠리콘카르네 갈릭라이스", "18,000원"]],
  }),
  "topic_enrichment_baekjong-wok_45be58e3ebae": closed("closed_confirmed", "뽈레가 저장 주소의 윤씨밀방을 폐점으로 표시함.", "https://polle.com/place/51N1GC/%EC%9C%A4%EC%94%A8%EB%B0%80%EB%B0%A9", "뽈레 폐점 표기"),
  "topic_enrichment_baekjong-wok_23d8db79a450": priced({
    operationStatus: "영업(이전)",
    operationSummary: "대구 서구 고성로 105-1로 이전해 영업 중.",
    pageAddress: "대구 서구 고성로 105-1",
    currentAddress: "대구 서구 고성로 105-1 1층",
    currentLat: 35.88259410077485,
    currentLng: 128.57756839608422,
    kakaoPlaceId: "21226094",
    sourceUrl: "https://m.place.naver.com/restaurant/37842383/menu/list",
    sourceLabel: "네이버 플레이스 현재 배달 메뉴",
    note: "저장 주소가 아닌 대구 서구 고성로 105-1 이전 매장의 공개 배달 메뉴를 반영함.",
    menus: [["대창불고기전골 500g(2인분)", "30,000원"], ["대창불고기전골(3인분)", "45,000원"], ["대창불고기전골(4인분)", "60,000원"], ["불고기전골 500g(2인분)", "30,000원"], ["대창추가(1인분)", "18,000원"], ["불고기추가(1인분)", "15,000원"], ["라면사리", "2,000원"], ["공기밥", "1,000원"], ["생면사리(우동·1인분)", "2,000원"], ["콜라 500ml", "2,000원"], ["사이다 500ml", "2,000원"]],
  }),
  "topic_enrichment_baekjong-wok_8223004f0ea2": closed("closed_likely", "저장 주소에는 세종문고·중고폰마트가 영업 중이며 해당 토스트킹의 현재 등록이 없음.", "https://place.map.kakao.com/378726973", "저장 주소 현 입점업체"),
  "topic_enrichment_baekjong-wok_f47ee86282d2": priced({
    operationStatus: "영업 여부 주의",
    operationSummary: "식신·관광 정보에는 영업 정보가 남아 있으나 현재 지도에는 다른 상호가 등록돼 있어 방문 전 확인 필요.",
    phone: "055-644-0663",
    sourceUrl: "https://www.siksinhot.com/P/258178",
    sourceLabel: "식신 공개 메뉴",
    note: "식신 공개 메뉴를 반영했으나 저장 주소의 현 지도 상호가 달라 영업 승계·상호변경 여부를 전화로 확인해야 함.",
    menus: [["굴해초비빔밥", "15,000원"], ["꼬막비빔밥", "13,000원"], ["꼬막전", "15,000원"], ["멍게해초비빔밥", "15,000원"], ["생멸치회덮밥", "13,000원"], ["성게 해초 비빔밥(돌솥)", "17,000원"], ["왕꼬막 무침", "20,000원"], ["해물뚝배기(소)", "28,000원"]],
  }),
  "topic_enrichment_baekjong-wok_14555fade8e1": {
    status: "not_single_restaurant",
    verifiedAt,
    operationStatus: "장소 운영",
    operationSummary: "국제시장 단팥죽거리 전체를 가리키는 장소로 단일 식당·단일 가격표가 아님.",
    note: "국제시장 단팥죽거리는 여러 노점의 집합이라 식당별 전체 메뉴·통합 가격표가 존재하지 않음. 2025년 방문 정보로 거리 운영은 확인되지만 가격은 점포별 현장가.",
    sourceUrl: "https://m.place.naver.com/place/19497305/home",
    placeUrl: "https://m.place.naver.com/place/19497305/home",
    sources: [{ url: "https://m.place.naver.com/place/19497305/home", label: "네이버 플레이스 장소 정보" }, { url: "https://www.reddit.com/r/busan/comments/1lctqfb", label: "2025년 국제시장 단팥죽거리 방문 언급" }],
    menus: [],
  },
  "topic_enrichment_baekjong-wok_0b24555abc6a": priced({
    operationStatus: "영업(이전)",
    operationSummary: "하하 공덕점으로 이전해 서울 마포구 새창로 28 1층에서 영업 중.",
    pageName: "하하 공덕점",
    pageAddress: "서울 마포구 새창로 28 1층",
    currentName: "하하 공덕점",
    currentAddress: "서울 마포구 새창로 28 1층",
    currentLat: 37.54165548566211,
    currentLng: 126.95292855775158,
    kakaoPlaceId: "244669873",
    sourceUrl: "https://m.place.naver.com/restaurant/147393801/menu/list",
    sourceLabel: "네이버 플레이스 현재 공개 메뉴",
    note: "연남동 저장 주소가 아닌 공덕 이전 매장의 현재 공개 메뉴를 반영함.",
    menus: [["가지튀김", "18,000원"], ["군만두", "8,000원"], ["찐만두", "8,000원"], ["새우볶음밥", "8,000원"], ["피단두부", "7,000원"], ["돼지귀무침", "7,000원"], ["해파리무침", "7,000원"], ["산라탕", "8,000원"], ["짬뽕탕", "8,000원"], ["완자탕", "8,000원"], ["물만두", "8,000원"], ["칠리새우", "22,000원"], ["고추잡채", "20,000원"], ["동파육", "20,000원"], ["새우튀김", "18,000원"], ["탕수육", "19,000원"], ["깐풍기", "19,000원"], ["유림기", "18,000원"], ["라조기", "19,000원"], ["오향장육", "19,000원"], ["멘보샤 8개", "20,000원"], ["멘보샤 4개", "10,000원"]],
  }),
  "topic_enrichment_baekjong-wok_b014cf66b6ba": closed("closed_likely", "저장 주소에는 효창동짜장우동·비가 등이 등록돼 있고 한성옥해장국의 현재 지도 등록이 없음.", "https://place.map.kakao.com/1555674629", "저장 주소 현 입점업체"),
  "topic_enrichment_baekjong-wok_a966fb1dc9aa": closed("closed_confirmed", "인천투데이가 화순반점 폐점 후 장강이 이전해 영업 중이라고 현장 취재로 확인함.", "https://www.incheontoday.com/news/articleView.html?idxno=261238", "인천투데이 현장 기사"),
};

const source = JSON.parse((await fs.readFile(sourcePath, "utf8")).replace(/^\uFEFF/, ""));
for (const [id, update] of Object.entries(updates)) {
  const existing = source.restaurants[id];
  if (!existing) throw new Error(`Missing baekjong-wok restaurant: ${id}`);
  source.restaurants[id] = {
    name: update.currentName ?? existing.name,
    address: update.currentAddress ?? existing.address,
    originalName: existing.originalName ?? existing.name,
    originalAddress: existing.originalAddress ?? existing.address,
    ...update,
  };
}

const records = Object.values(source.restaurants);
source.source = "Kakao Maps, Naver Place, public business data, and cited public menu sources";
source.collectedAt = verifiedAt;
source.runStatus = "complete";
source.matchingMethod = "name/address verification, current-place inspection, closure evidence, and public menu transcription";
source.totalRestaurantCount = records.length;
source.processedCount = records.length;
source.matchedCount = records.filter((record) => record.status === "matched_with_priced_menu").length;
source.pricedRestaurantCount = records.filter((record) => (record.menus ?? []).some((menu) => menu.price)).length;
source.pricedMenuCount = records.reduce((sum, record) => sum + (record.menus ?? []).filter((menu) => menu.price).length, 0);
source.closedCount = records.filter((record) => ["closed_confirmed", "closed_likely"].includes(record.status)).length;
source.closedConfirmedCount = records.filter((record) => record.status === "closed_confirmed").length;
source.closedLikelyCount = records.filter((record) => record.status === "closed_likely").length;
source.operationUnverifiedCount = records.filter((record) => record.status === "operation_unverified").length;
source.notSingleRestaurantCount = records.filter((record) => record.status === "not_single_restaurant").length;
source.unmatchedCount = records.filter((record) => ["unmatched", "matched_no_priced_menu"].includes(record.status)).length;
source.errorCount = 0;
await fs.writeFile(sourcePath, `${JSON.stringify(source, null, 2)}\n`, "utf8");

const statusText = { matched_with_priced_menu: "메뉴·가격 반영", closed_confirmed: "폐업 확인", closed_likely: "폐업 추정", operation_unverified: "영업 여부 미확인", not_single_restaurant: "단일 식당 아님" };
const orderedUpdates = Object.entries(updates).map(([id, update]) => ({
  id,
  name: source.restaurants[id].originalName ?? source.restaurants[id].name,
  address: source.restaurants[id].originalAddress ?? source.restaurants[id].address,
  ...update,
}));
const lines = [
  "# 백종원의 3대천왕 36곳 메뉴·폐업 조사", "", "- 확인일: 2026-07-19 (KST)",
  `- 메뉴·가격 반영: ${orderedUpdates.filter((record) => record.status === "matched_with_priced_menu").length}곳`,
  `- 폐업 확인: ${orderedUpdates.filter((record) => record.status === "closed_confirmed").length}곳`,
  `- 폐업 추정: ${orderedUpdates.filter((record) => record.status === "closed_likely").length}곳`,
  `- 영업 여부 미확인: ${orderedUpdates.filter((record) => record.status === "operation_unverified").length}곳`,
  `- 단일 식당이 아닌 장소: ${orderedUpdates.filter((record) => record.status === "not_single_restaurant").length}곳`, "",
  "> ‘폐업 확인’은 폐점 표기·폐업일·현장 기사처럼 직접 근거가 있는 경우입니다. ‘폐업 추정’은 저장 주소가 다른 현 업체로 교체되고 동일 상호의 현재 지도 등록을 찾지 못한 경우이며, 공식 폐업신고를 직접 확인한 것은 아닙니다. 메뉴 가격은 공개된 최신 페이지를 옮겼지만 현장 가격과 다를 수 있습니다.", "",
  "## 36곳 판정", "", "| # | 식당명 | 판정 | 현재·근거 요약 | 메뉴 수 |", "|---:|---|---|---|---:|",
  ...orderedUpdates.map((record, index) => `| ${index + 1} | ${record.name} | ${statusText[record.status] ?? record.status} | ${String(record.operationSummary ?? record.note ?? "").replaceAll("|", "\\|")} | ${(record.menus ?? []).length} |`),
  "", "## 메뉴와 가격", "",
];
for (const record of orderedUpdates.filter((item) => (item.menus ?? []).length > 0)) {
  lines.push(`### ${record.name}`, "", `- 상태: ${record.operationStatus}`);
  if (record.operationSummary) lines.push(`- 현재 정보: ${record.operationSummary}`);
  if (record.note) lines.push(`- 주의: ${record.note}`);
  for (const sourceItem of record.sources ?? []) lines.push(`- 출처: [${sourceItem.label}](${sourceItem.url})`);
  lines.push("", "| 메뉴 | 가격 | 비고 |", "|---|---:|---|");
  for (const menu of record.menus) lines.push(`| ${menu.name.replaceAll("|", "\\|")} | ${menu.price} | ${(menu.description ?? "").replaceAll("|", "\\|")} |`);
  lines.push("");
}
lines.push("## 메뉴를 비워 둔 곳", "", ...orderedUpdates.filter((record) => (record.menus ?? []).length === 0).map((record) => `- ${record.name} — ${statusText[record.status]}: ${record.note}`), "");
await fs.writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Updated ${Object.keys(updates).length} restaurants and wrote ${path.relative(root, reportPath)}.`);
