import fs from "node:fs/promises";
import path from "node:path";

const [, , datasetId, encodedResults] = process.argv;

if (!datasetId || !encodedResults) {
  throw new Error("Usage: node scripts/merge-naver-menu-results.mjs <dataset> <base64-json>");
}

const root = path.resolve(import.meta.dirname, "..");
const sourcePath = path.join(root, "source-data", datasetId, "menu-prices.json");
const payload = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const results = JSON.parse(Buffer.from(encodedResults, "base64url").toString("utf8"));
const verifiedAt = new Date().toISOString();
const updatedDate = verifiedAt.slice(0, 10);

let menuRestaurantCount = 0;
let menuCount = 0;
let unavailableCount = 0;

for (const result of results) {
  const restaurant = payload.restaurants?.[result.id];
  if (!restaurant) continue;

  const targetAddress = String(restaurant.address ?? "");
  const targetRoadToken = targetAddress
    .replace(/\([^)]*\)/g, "")
    .split(/\s+/)
    .find((token) => /(?:로|길)\d*(?:번길)?$/.test(token));
  const targetJibunToken = targetAddress.match(/\(([^\s)]+)/)?.[1];
  const observedAddress = `${result.pageAddress ?? ""} ${result.jibun ?? ""}`;
  const normalizedTargetAddress = targetAddress.replace(/[()]/g, "").replace(/\s+/g, " ").trim();
  const normalizedObservedAddress = observedAddress.replace(/[()]/g, "").replace(/\s+/g, " ").trim();
  const addressMatches =
    result.forceMatch ||
    normalizedObservedAddress.includes(normalizedTargetAddress) ||
    (targetRoadToken && observedAddress.includes(targetRoadToken)) ||
    (targetJibunToken && observedAddress.includes(targetJibunToken));

  if (result.placeId && !addressMatches) {
    restaurant.verifiedAt = verifiedAt;
    restaurant.note = "네이버 지도 검색 결과의 도로명·지번 주소가 저장된 식당과 달라 메뉴를 연결하지 않음.";
    unavailableCount += 1;
    continue;
  }

  const pageAddress = [result.pageAddress, result.jibun ? `(${result.jibun})` : ""]
    .filter(Boolean)
    .join(" ");

  restaurant.verifiedAt = verifiedAt;

  if (result.placeId) {
    restaurant.naverPlaceId = String(result.placeId);
    restaurant.placeUrl = `https://map.naver.com/p/entry/place/${result.placeId}`;
    if (result.pageAddress) restaurant.pageAddress = pageAddress;
  }

  if (result.updateAddress && result.pageAddress) {
    restaurant.address = pageAddress;
  }

  if (result.outcome !== "menus" || !Array.isArray(result.menus) || result.menus.length === 0) {
    const reason =
      result.outcome === "no_menu_tab"
        ? "네이버 지도에서 장소와 주소를 확인했으나 메뉴 탭이 없음."
        : result.outcome === "menu_tab_empty"
          ? "네이버 지도에 메뉴 탭은 있으나 공개된 메뉴명·가격이 없음."
          : "네이버 지도에서 저장된 식당명과 주소에 해당하는 장소를 확인하지 못함.";
    restaurant.note = reason;
    unavailableCount += 1;
    continue;
  }

  restaurant.status = "matched_with_priced_menu";
  restaurant.representativeMenu = result.menus
    .slice(0, 3)
    .map((menu) => menu.name)
    .join(" / ");
  restaurant.note = "네이버 지도에서 도로명·지번 주소를 대조하고 메뉴 탭의 전체 메뉴와 가격을 확인함.";
  restaurant.sourceUrl = `https://pcmap.place.naver.com/restaurant/${result.placeId}/menu/list`;
  restaurant.menuUpdatedAt = updatedDate;
  restaurant.menus = result.menus.map((menu, index) => ({
    id: `${result.id}_menu_${String(index + 1).padStart(3, "0")}`,
    name: String(menu.name).trim(),
    price: String(menu.price).trim(),
    ...(menu.description ? { description: String(menu.description).trim() } : {}),
    isSignature: index < 3,
    sourceUpdatedAt: updatedDate,
    sourceOrdinal: index + 1,
  }));

  menuRestaurantCount += 1;
  menuCount += restaurant.menus.length;
}

payload.collectedAt = verifiedAt;
payload.pricedRestaurantCount = Object.values(payload.restaurants ?? {}).filter(
  (restaurant) => Array.isArray(restaurant.menus) && restaurant.menus.length > 0
).length;
payload.pricedMenuCount = Object.values(payload.restaurants ?? {}).reduce(
  (total, restaurant) => total + (Array.isArray(restaurant.menus) ? restaurant.menus.length : 0),
  0
);

await fs.writeFile(sourcePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(
  `${datasetId}: added menus for ${menuRestaurantCount} restaurants (${menuCount} menus); recorded ${unavailableCount} unavailable results.`
);
