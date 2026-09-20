import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  identityMatch,
  normalizeMenus,
  cleanRestaurantName,
  addressParts,
} from "./menu-research/matching.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directoryArg = process.argv.indexOf("--directory");
const directory = directoryArg < 0 ? path.join(root, "source-data/menu-research-2026-09") : path.resolve(root, process.argv[directoryArg + 1]);
if (!directory.startsWith(path.join(root, "source-data") + path.sep)) throw new Error("Research directory must be under source-data");
await fs.mkdir(directory, { recursive: true });
const queuePath = path.join(directory, "queue.json");
const resultPath = path.join(directory, "results.json");
let queue;
try {
  queue = JSON.parse(await fs.readFile(queuePath, "utf8"));
} catch {
  const dataset = JSON.parse(
    await fs.readFile(
      path.join(
        root,
        "matpick_all/client/src/data/generated/public-dataset.json",
      ),
      "utf8",
    ),
  );
  queue = dataset.restaurants
    .filter((r) => !r.menus?.length)
    .map(
      ({
        id,
        name,
        address,
        lat,
        lng,
        kakaoPlaceId,
        operationState,
        recommendationHold,
      }) => ({
        id,
        name,
        address,
        lat,
        lng,
        kakaoPlaceId,
        operationState,
        recommendationHold,
      }),
    );
  queue.sort(
    (a, b) =>
      Number(/^(부산|제주)/.test(b.address)) -
      Number(/^(부산|제주)/.test(a.address)),
  );
  await fs.writeFile(queuePath, JSON.stringify(queue, null, 2) + "\n");
}
let result;
try {
  result = JSON.parse(await fs.readFile(resultPath, "utf8"));
} catch {
  result = {
    startedAt: new Date().toISOString(),
    targetCount: queue.length,
    restaurants: {},
  };
}
const limitArg = process.argv.indexOf("--limit");
const limit = limitArg < 0 ? Infinity : Number(process.argv[limitArg + 1]);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const existing = JSON.parse(
  await fs.readFile(
    path.join(
      root,
      "matpick_all/client/src/data/generated/public-dataset.json",
    ),
    "utf8",
  ),
).restaurants;
let lastRequest = 0;
async function request(url, panel = false) {
  await delay(Math.max(0, 1000 - (Date.now() - lastRequest)));
  lastRequest = Date.now();
  const headers = panel
    ? {
        Accept: "application/json",
        Origin: "https://place.map.kakao.com",
        Referer: "https://place.map.kakao.com/",
        pf: "PC",
        appVersion: "6.6.0",
      }
    : { Accept: "application/json", Referer: "https://map.kakao.com/" };
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(20000),
  });
  if ([401, 403, 429].includes(response.status))
    throw Object.assign(new Error(`Source paused: HTTP ${response.status}`), {
      stop: true,
    });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
function compact(place) {
  return {
    kakaoPlaceId: String(place.confirmid),
    name: place.name,
    address: place.new_address || place.address || "",
    parcelAddress: place.address || "",
    lat: Number(place.lat),
    lng: Number(place.lon),
  };
}
async function research(restaurant, previous) {
  const checkedAt = new Date().toISOString();
  if (
    ["closed", "moved", "temporarily_closed"].includes(
      restaurant.operationState,
    ) ||
    /폐업|영업종료/.test(restaurant.name)
  )
    return { status: "operation_review", checkedAt, menus: [] };
  const locality = addressParts(restaurant.address);
  const query =
    `${cleanRestaurantName(restaurant)} ${locality.province} ${locality.locality[0] || ""}`.trim();
  const url = new URL("https://search.map.kakao.com/mapsearch/map.daum");
  url.searchParams.set("q", query);
  url.searchParams.set("msFlag", "A");
  let candidates;
  if (restaurant.kakaoPlaceId) candidates = [{ ...restaurant, kakaoPlaceId: String(restaurant.kakaoPlaceId) }];
  else if (previous?.query === query && Array.isArray(previous.candidates))
    candidates = previous.candidates;
  else {
    const payload = await request(url);
    candidates = (payload.place || [])
      .filter((p) => p.cate_name_depth1 === "음식점")
      .slice(0, 8)
      .map(compact);
  }
  candidates = candidates.map((c) => ({
    ...c,
    match: identityMatch(restaurant, c),
  }));
  const fallbackQuery =
    `${cleanRestaurantName(restaurant)} ${locality.province}`.trim();
  if (
    !candidates.some((c) => c.match.accepted) &&
    fallbackQuery !== query &&
    previous?.fallbackQuery !== fallbackQuery
  ) {
    url.searchParams.set("q", fallbackQuery);
    const payload = await request(url);
    const additional = (payload.place || [])
      .filter((p) => p.cate_name_depth1 === "음식점")
      .slice(0, 8)
      .map(compact);
    candidates = [
      ...candidates,
      ...additional.filter(
        (c) => !candidates.some((old) => old.kakaoPlaceId === c.kakaoPlaceId),
      ),
    ].map((c) => ({ ...c, match: identityMatch(restaurant, c) }));
  }
  if (!candidates.some((c) => c.match.accepted)) {
    const related = existing.filter(
      (c) => identityMatch(restaurant, c).accepted,
    );
    const knownIds = [
      ...new Set(
        [
          restaurant.kakaoPlaceId,
          ...related.flatMap((c) => [
            c.kakaoPlaceId,
            ...(c.menuPriceSources || []).map(
              (s) =>
                /^https:\/\/place\.map\.kakao\.com\/(\d+)/.exec(s.url)?.[1],
            ),
          ]),
        ]
          .filter(Boolean)
          .map(String),
      ),
    ];
    if (
      knownIds.length === 1 &&
      !candidates.some((c) => c.kakaoPlaceId === knownIds[0])
    )
      candidates.push({
        ...restaurant,
        kakaoPlaceId: knownIds[0],
        match: { accepted: true },
        lookup: "existing_source_link",
      });
  }
  const accepted = candidates.filter((c) => c.match.accepted);
  if (accepted.length !== 1)
    return {
      status: accepted.length > 1 ? "ambiguous_branch" : "identity_review",
      checkedAt,
      query,
      fallbackQuery,
      candidates,
      menus: [],
    };
  const selected = accepted[0];
  const panel = await request(
    `https://place-api.map.kakao.com/places/panel3/${selected.kakaoPlaceId}`,
    true,
  );
  const s = panel.summary || {};
  const place = {
    kakaoPlaceId: selected.kakaoPlaceId,
    name: s.name || "",
    address: s.address?.road || s.address?.disp || "",
    parcelAddress: s.address?.jibun || "",
    lat: Number(s.point?.lat),
    lng: Number(s.point?.lon),
    placeUrl: `https://place.map.kakao.com/${selected.kakaoPlaceId}`,
  };
  const match = identityMatch(restaurant, place);
  if (!match.accepted)
    return {
      status: "identity_review",
      checkedAt,
      query,
      fallbackQuery,
      candidates,
      place,
      match,
      menus: [],
    };
  if (s.status && s.status !== "Y")
    return {
      status: "operation_review",
      checkedAt,
      place,
      sourceOperationStatus: s.status,
      menus: [],
    };
  const menus = normalizeMenus(panel.menu?.menus?.items || [], restaurant.id);
  return {
    status: menus.some((m) => m.price)
      ? "verified_priced"
      : menus.length
        ? "verified_menu_only"
        : "public_menu_unavailable",
    checkedAt,
    query,
    place,
    match,
    sourceOperationStatus: s.status || null,
    sourceUpdatedAt: panel.menu?.menus?.items_updated_at || null,
    menus,
  };
}
let processed = 0;
for (const restaurant of queue) {
  const previous = result.restaurants[restaurant.id];
  if (
    previous &&
    previous.status !== "request_error" &&
    !(
      process.argv.includes("--retry-identity") &&
      ["identity_review", "ambiguous_branch"].includes(previous.status)
    )
  )
    continue;
  if (processed >= limit) break;
  try {
    result.restaurants[restaurant.id] = await research(restaurant, previous);
  } catch (error) {
    result.restaurants[restaurant.id] = {
      status: "request_error",
      checkedAt: new Date().toISOString(),
      message: error.message,
      menus: [],
    };
    if (error.stop) {
      result.pausedReason = error.message;
      await fs.writeFile(resultPath, JSON.stringify(result, null, 2) + "\n");
      throw error;
    }
  }
  processed++;
  result.updatedAt = new Date().toISOString();
  await fs.writeFile(resultPath, JSON.stringify(result, null, 2) + "\n");
  if (processed % 25 === 0 || processed === limit)
    console.log(
      JSON.stringify({
        processed: Object.keys(result.restaurants).length,
        target: queue.length,
        statuses: Object.values(result.restaurants).reduce(
          (a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a),
          {},
        ),
      }),
    );
}
console.log(
  JSON.stringify({
    finishedAt: new Date().toISOString(),
    processed: Object.keys(result.restaurants).length,
    target: queue.length,
  }),
);
