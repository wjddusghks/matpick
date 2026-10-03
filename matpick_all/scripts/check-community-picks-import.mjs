import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const generatedDir = path.join(projectRoot, "client", "src", "data", "generated");
const SOURCE_ID = "community-picks";

const readJson = async (filename) =>
  JSON.parse(await readFile(filename, "utf8"));

const stableHash = (value) =>
  createHash("sha256").update(String(value)).digest("hex");

function protectedRestaurantDigest(restaurant) {
  const protectedValues = {
    address: restaurant.address,
    lat: restaurant.lat,
    lng: restaurant.lng,
    representativeMenu: restaurant.representativeMenu,
    menus: (restaurant.menus || []).map(
      ({ name, price, description, isSignature }) => ({
        name,
        ...(price ? { price } : {}),
        ...(description ? { description } : {}),
        ...(isSignature ? { isSignature: true } : {}),
      }),
    ),
    menuPriceStatus: restaurant.menuPriceStatus,
    menuPriceVerifiedAt: restaurant.menuPriceVerifiedAt,
    menuPriceNote: restaurant.menuPriceNote,
    menuPriceSources: restaurant.menuPriceSources,
  };
  return stableHash(JSON.stringify(protectedValues));
}

function comparableNewRestaurant(restaurant) {
  const roundedCoordinate = (value) =>
    Number.isFinite(value) ? Number(value.toFixed(6)) : value;
  return {
    name: restaurant.name,
    address: restaurant.address,
    region: restaurant.region,
    category: restaurant.category,
    representativeMenu: restaurant.representativeMenu,
    // The public serializer intentionally rounds map coordinates to six decimals.
    lat: roundedCoordinate(restaurant.lat),
    lng: roundedCoordinate(restaurant.lng),
    menus: (restaurant.menus || []).map(({ name, price }) => ({
      name,
      ...(price ? { price } : {}),
    })),
  };
}

const [community, published, report] = await Promise.all([
  readJson(path.join(generatedDir, "community-picks.generated.json")),
  readJson(path.join(generatedDir, "public-dataset.json")),
  readJson(path.join(projectRoot, "reports", "community-picks-import.json")),
]);

const errors = [];
const publishedById = new Map(
  published.restaurants.map((restaurant) => [restaurant.id, restaurant]),
);
const communityNewIds = new Set(
  community.restaurants.map((restaurant) => restaurant.id),
);
const source = published.sources.find((item) => item.id === SOURCE_ID);
if (!source) errors.push("공개 데이터에 community-picks source가 없습니다.");

const links = published.sourceLinks.filter((link) => link.sourceId === SOURCE_ID);
const linkedRestaurantIds = new Set(links.map((link) => link.restaurantId));
for (const [entryId, restaurantId] of Object.entries(
  community.importMeta?.entryRestaurantIds || {},
)) {
  if (!publishedById.has(restaurantId)) {
    errors.push(`${entryId}: 공개 식당 ${restaurantId}를 찾을 수 없습니다.`);
  }
  if (!linkedRestaurantIds.has(restaurantId)) {
    errors.push(`${entryId}: 추천식당 source 연결이 없습니다 (${restaurantId}).`);
  }
}

for (const match of report.matches || []) {
  if (communityNewIds.has(match.restaurantId)) {
    errors.push(
      `${match.sourceEntryId}: 기존 식당 ${match.restaurantId}가 신규 payload에 포함되었습니다.`,
    );
    continue;
  }
  const restaurant = publishedById.get(match.restaurantId);
  if (
    restaurant &&
    protectedRestaurantDigest(restaurant) !== match.protectedDigest
  ) {
    errors.push(
      `${match.sourceEntryId}: 기존 식당 ${match.restaurantId}의 좌표·메뉴·가격이 import 중 변경되었습니다.`,
    );
  }
  if (
    restaurant &&
    match.payloadDigest &&
    stableHash(JSON.stringify(restaurant)) !== match.payloadDigest
  ) {
    errors.push(
      `${match.sourceEntryId}: 기존 식당 ${match.restaurantId}의 본문 payload가 import 중 변경되었습니다.`,
    );
  }
}

for (const expected of community.restaurants) {
  const actual = publishedById.get(expected.id);
  if (!actual) {
    errors.push(`신규 추천식당이 공개 데이터에 없습니다: ${expected.id}`);
    continue;
  }
  if (
    JSON.stringify(comparableNewRestaurant(actual)) !==
    JSON.stringify(comparableNewRestaurant(expected))
  ) {
    errors.push(`신규 추천식당 필드가 제공값과 다릅니다: ${expected.id}`);
  }
}

if (links.length !== community.sourceLinks.length) {
  errors.push(
    `추천식당 source 연결 수가 다릅니다: 생성 ${community.sourceLinks.length}, 공개 ${links.length}`,
  );
}

console.log(
  `추천식당 검증: 입력 ${report.inputEntries}개, 기존 연결 ${report.matchedExisting}개, 신규 ${report.newRestaurants}개, 공개 연결 ${links.length}개`,
);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
}
