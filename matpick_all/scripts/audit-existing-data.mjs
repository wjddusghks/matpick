import fs from "node:fs/promises";
import path from "node:path";
import { loadPublicData } from "./load-public-data.mjs";
const root = path.resolve(import.meta.dirname, "../..");
const dir = path.join(root, "source-data/existing-data-quality-2026-09-21");
const data = await loadPublicData();
const day = new Date().toISOString().slice(0, 10);
const count = {};
const labels = {
  noStructuredMenus: "개별 메뉴 미등록",
  noDisplayMenus: "대표 메뉴도 없음",
  noFixedPrices: "고정 금액 없음",
  partialPrices: "일부 금액 누락",
  noPhone: "전화번호 없음",
  invalidLocation: "좌표 확인 필요",
  noAddress: "주소 없음",
  noLocationSource: "위치 출처·확인일 없음",
  noMenuSource: "메뉴 출처 없음",
  noMenuDate: "메뉴 확인일 없음",
  oldMenuDate: "메뉴 확인 180일 경과",
  held: "영업·지점 확인 필요",
  categoryReview: "음식 종류 재분류 필요",
};
const hasPrice = m =>
  (/\d/.test(m.price || "") && !/미공개|미확인|문의/.test(m.price)) ||
  /^무료$/.test(m.price || "");
const issues = [];
for (const r of data.restaurants) {
  const menus = data.getRestaurantMenuItems(r);
  const priced = menus.filter(hasPrice).length;
  const fields = [];
  const add = k => {
    fields.push(k);
    count[k] = (count[k] || 0) + 1;
  };
  if (!r.menus?.length) add("noStructuredMenus");
  if (!menus.length) add("noDisplayMenus");
  if (!priced) add("noFixedPrices");
  else if (priced < menus.length) add("partialPrices");
  if (!r.phone?.trim()) add("noPhone");
  if (!r.address?.trim()) add("noAddress");
  if (
    !Number.isFinite(r.lat) ||
    !Number.isFinite(r.lng) ||
    !r.lat ||
    !r.lng ||
    (!r.isOverseas && (r.lat < 33 || r.lat > 39 || r.lng < 124 || r.lng > 132))
  )
    add("invalidLocation");
  if (!r.locationVerifiedAt || !r.locationSourceUrls?.length)
    add("noLocationSource");
  if (menus.length && !r.menuPriceSources?.length) add("noMenuSource");
  if (menus.length && !r.menuPriceVerifiedAt) add("noMenuDate");
  if (
    r.menuPriceVerifiedAt &&
    Date.now() - Date.parse(r.menuPriceVerifiedAt) > 180 * 86400000
  )
    add("oldMenuDate");
  if (
    r.recommendationHold ||
    ["closed", "moved", "temporarily_closed"].includes(r.operationState)
  )
    add("held");
  if (!r.category || /기업|미용|광고|마케팅|학원|공공기관/.test(r.category))
    add("categoryReview");
  if (!fields.length) continue;
  const priority =
    (fields.includes("invalidLocation") ? 100 : 0) +
    (fields.includes("held") ? 80 : 0) +
    (fields.includes("noDisplayMenus") ? 40 : 0) +
    (fields.includes("noFixedPrices") ? 30 : 0) +
    (/^(부산|제주)/.test(r.address) ? 15 : 0);
  issues.push({
    id: r.id,
    name: r.name,
    address: r.address,
    region: r.region,
    priority,
    fields,
    menus: menus.length,
    priced,
    phone: r.phone || "",
    lat: r.lat,
    lng: r.lng,
    menuVerifiedAt: r.menuPriceVerifiedAt || "",
    menuSources: r.menuPriceSources || [],
    adminUrl: `https://matpick.co.kr/admin/restaurants?restaurantId=${encodeURIComponent(r.id)}`,
    searchUrl: `https://map.naver.com/p/search/${encodeURIComponent(`${r.name} ${r.address}`)}`,
  });
}
issues.sort(
  (a, b) => b.priority - a.priority || a.name.localeCompare(b.name, "ko")
);
const summary = {
  date: day,
  total: data.restaurants.length,
  withIssues: issues.length,
  counts: count,
};
await fs.writeFile(
  path.join(dir, "audit.json"),
  JSON.stringify({ summary, labels, restaurants: issues }, null, 2) + "\n"
);
const enrichment = JSON.parse(
  await fs.readFile(path.join(dir, "enrichment-report.json"), "utf8")
);
const escape = s => String(s).replaceAll("|", "\\|").replaceAll("\n", " ");
let md = `# 기존 식당 데이터 점검 및 보완\n\n확인일: ${day}. 식당 ID를 유지하며 기존 3,528곳을 점검했습니다. 수치는 배포용 기본 데이터 기준이며 이후 관리자 수정은 별도로 적용됩니다.\n\n## 이번 반영\n\n`;
md += `- 부산·제주 기존 식당 ${enrichment.summary.checked}곳 대조, 동일 지점 ${enrichment.summary.matched}곳 확인\n- 전화번호 ${enrichment.summary.phonesAdded}곳 보완, 좌표 ${enrichment.summary.coordinatesRefined}곳 조정\n- 위치 출처·확인일 ${enrichment.summary.locationsVerified}곳 반영\n- 공개 메뉴 스냅샷 ${enrichment.summary.menuSnapshots}곳 갱신 (${enrichment.summary.menuItems}개 항목, 새 메뉴명 ${enrichment.summary.addedMenuItems}개, 기존 금액 변경 ${enrichment.summary.changedPrices}개)\n- 이번 조회로 가격이 없던 식당에 새로운 금액을 확보하지는 못했습니다. 60곳의 기존 가격을 재확인했습니다.\n- 지점·영업 상태 보류 ${enrichment.summary.holds}곳은 자동 변경하지 않았습니다.\n\n가격은 조회 당시 공개된 정보이며 현장 가격 확인을 의미하지 않습니다. 변동가격·미공개 금액은 추정하지 않았습니다. 주소가 같은 지점의 좌표 오차가 15~100m인 경우만 좌표를 조정했습니다. 100m 초과 차이는 검토 대상으로 남깁니다.\n\n## 별도로 발견해 수정한 위치 오류\n\n서울 스시 카네사카에 도쿄 좌표가 들어 있었습니다. 호텔 공식 안내와 서울 카카오지도 지점을 대조하여 주소·지역·좌표·전화번호를 수정했습니다. 메뉴 가격 4개도 호텔 공식 페이지로 재확인했습니다. 증거는 kanesaka-evidence.json, 공식 안내는 https://seoul.intercontinental.com/ko/dining/restaurants/sushi-kanesaka 입니다.\n\n## 전체 데이터에서 남은 항목\n\n| 항목 | 식당 수 |\n|---|---:|\n`;
md += Object.entries(count)
  .map(([k, v]) => `| ${labels[k]} | ${v.toLocaleString()} |`)
  .join("\n");
md +=
  "\n\n한 식당이 여러 항목에 중복 집계됩니다. 위치 출처 누락은 좌표 오류를 뜻하지 않습니다. 고정 금액 없음에는 변동가격·현장 문의도 포함합니다.\n\n## 다음 확인 순서\n\n1. 영업 상태·잘못된 좌표·동명 지점 후보를 먼저 확인합니다.\n2. 부산·제주 가격 누락 38곳은 공식 메뉴판·매장 웹사이트에서 확인하고, 공개 금액이 없으면 관리자나 사장님 확인으로 보완합니다.\n3. 전국 메뉴 미등록과 일부 가격 누락을 주제별로 묶어 진행합니다.\n4. 각 항목에 원문 URL, 확인일, 지점 식별 근거를 남깁니다. 메뉴·위치·영업 상태의 확인 날짜를 구분합니다.\n5. 정기 재확인 시 변경 후보만 검토한 뒤 반영합니다. 전체 데이터 자동 덮어쓰기는 하지 않습니다.\n\n## 우선 확인 목록 100곳\n\n| 식당 | 주소 | 필요한 확인 | 작업 |\n|---|---|---|---|\n";
md += issues
  .slice(0, 100)
  .map(
    r =>
      `| ${escape(r.name)} | ${escape(r.address)} | ${r.fields.map(k => labels[k]).join(", ")} | [관리자](${r.adminUrl}) · [지도 검색](${r.searchUrl}) |`
  )
  .join("\n");
md +=
  "\n\n전체 식당별 상세 목록은 audit.json, 이번 수정 전후 비교는 enrichment-report.json, 지점 대조 결과와 원문 URL은 results.json에 있습니다.\n";
await fs.writeFile(path.join(dir, "README.md"), md);
console.log(summary);
