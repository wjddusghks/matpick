const { createHash, randomUUID } = require("node:crypto");

const PREFIX = "matpick:restaurant-suggestion:v1:";
const INDEX = "matpick:restaurant-suggestions:v1";
const PUBLISHED = "matpick:community-restaurants:v1";
const PUBLISHED_DEDUPE = "matpick:community-restaurants:dedupe:v1";
const RETENTION_SECONDS = 180 * 24 * 60 * 60;
const TAGS = ["데이트", "혼밥", "가족 식사", "친구 모임", "여행", "가성비"];
const dataset = require("../../matpick_all/client/src/data/generated/public-dataset.json");

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

function text(value, label, max, required = false) {
  if (value == null) value = "";
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    fail(`${label} 형식을 확인해 주세요.`);
  const result = value.trim();
  if (required && !result) fail(`${label}을 입력해 주세요.`);
  return result;
}

function validateSuggestion(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("제보 내용을 확인해 주세요.");
  if (input.website) fail("요청을 처리할 수 없습니다.");
  if (
    typeof input.requestId !== "string" ||
    !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(input.requestId)
  )
    fail("제보 화면을 새로 열어 주세요.");
  if (input.consent !== true) fail("제보 정보 활용에 동의해 주세요.");
  const name = text(input.name, "식당 이름", 100, true);
  const location = text(input.location, "식당 위치", 300, true);
  const locationDetail = text(input.locationDetail, "상세주소", 100);
  const lat = input.lat == null || input.lat === "" ? null : Number(input.lat);
  const lng = input.lng == null || input.lng === "" ? null : Number(input.lng);
  if (
    (lat == null) !== (lng == null) ||
    (lat != null &&
      (!Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat === 0 ||
        lng === 0 ||
        Math.abs(lat) > 90 ||
        Math.abs(lng) > 180))
  )
    fail("식당 위치 좌표를 확인해 주세요.");
  const mapUrl = text(input.mapUrl, "지도 또는 식당 링크", 1500);
  if (mapUrl) {
    try {
      const url = new URL(mapUrl);
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error();
    } catch {
      fail("링크는 https:// 또는 http://로 시작하는 주소를 입력해 주세요.");
    }
  }
  if (!Array.isArray(input.menus) || input.menus.length > 8)
    fail("메뉴는 최대 8개까지 알려주실 수 있어요.");
  const menus = input.menus
    .map((menu) => {
      if (!menu || typeof menu !== "object" || Array.isArray(menu))
        fail("메뉴를 확인해 주세요.");
      const name = text(menu.name, "메뉴 이름", 80);
      const unit = text(menu.unit, "메뉴 수량 기준", 40);
      const rawPrice = text(menu.price, "메뉴 가격", 12).replace(/,/g, "");
      if (rawPrice && (!/^\d+$/.test(rawPrice) || Number(rawPrice) > 10000000))
        fail("가격은 0~10,000,000원 사이의 숫자로 입력해 주세요.");
      if (!name && (rawPrice || unit))
        fail("가격이나 수량을 적은 메뉴의 이름도 알려주세요.");
      return { name, price: rawPrice ? Number(rawPrice) : null, unit };
    })
    .filter((menu) => menu.name);
  const tags = input.tags ?? [];
  if (
    !Array.isArray(tags) ||
    tags.length > TAGS.length ||
    tags.some((tag) => !TAGS.includes(tag))
  )
    fail("추천 상황을 확인해 주세요.");
  const relationship = input.relationship || "discovered";
  if (!["visitor", "owner", "discovered"].includes(relationship))
    fail("식당과의 관계를 확인해 주세요.");
  const checkedAt = text(input.checkedAt, "정보 확인일", 10);
  if (
    checkedAt &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(checkedAt) ||
      Number.isNaN(Date.parse(checkedAt)) ||
      new Date(checkedAt).toISOString().slice(0, 10) !== checkedAt ||
      checkedAt >
        new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }))
  )
    fail("정보 확인일은 오늘 또는 이전 날짜로 입력해 주세요.");
  return {
    requestId: input.requestId.toLowerCase(),
    name,
    location,
    ...(locationDetail ? { locationDetail } : {}),
    ...(lat != null ? { lat, lng } : {}),
    mapUrl,
    menus,
    tags: [...new Set(tags)],
    relationship,
    checkedAt,
    reason: text(input.reason, "추천 이유", 1000),
    sourceNote: text(input.sourceNote, "정보 출처", 300),
    consentVersion: "restaurant-suggestion-v1",
  };
}

function validateAdminDraft(input, existing) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("편집 내용을 확인해 주세요.");
  const candidate = {
    ...existing,
    ...input,
    requestId: existing.requestId,
    consent: true,
    menus: (Array.isArray(input.menus) ? input.menus : existing.menus || [])
      .map((menu) => ({
          ...menu,
          price: menu?.price == null ? "" : String(menu.price),
        })),
  };
  const clean = validateSuggestion(candidate);
  const imageUrl = text(input.imageUrl ?? existing.imageUrl, "대표 이미지 URL", 1500);
  if (imageUrl) {
    try {
      const url = new URL(imageUrl);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
        throw new Error();
    } catch {
      fail("대표 이미지 URL은 http:// 또는 https:// 주소로 입력해 주세요.");
    }
  }
  return {
    ...existing,
    ...clean,
    locationDetail: clean.locationDetail || "",
    lat: clean.lat ?? null,
    lng: clean.lng ?? null,
    imageUrl,
    locationVerified:
      input.locationVerified === true &&
      Number.isFinite(clean.lat) && Number.isFinite(clean.lng),
    editedAt: Date.now(),
  };
}

function normalizeIdentity(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/\s+/g, "")
    .replace(/[-._,/#!$%^&*;:{}=`~()'"?<>+\[\]\\|·ㆍ]/g, "");
}

function broadRegion(address) {
  const aliases = {
    서울특별시: "서울", 부산광역시: "부산", 대구광역시: "대구",
    인천광역시: "인천", 광주광역시: "광주", 대전광역시: "대전",
    울산광역시: "울산", 세종특별자치시: "세종", 경기도: "경기",
    강원특별자치도: "강원", 충청북도: "충북", 충청남도: "충남",
    전북특별자치도: "전북", 전라북도: "전북", 전라남도: "전남",
    경상북도: "경북", 경상남도: "경남", 제주특별자치도: "제주",
  };
  const value = String(address || "").trim();
  const prefix = Object.keys(aliases).find((candidate) => value.startsWith(candidate));
  return prefix ? aliases[prefix] : value.split(/\s+/)[0] || "기타";
}

function distanceKm(left, right) {
  const radians = (value) => (value * Math.PI) / 180;
  const deltaLat = radians(right.lat - left.lat);
  const deltaLng = radians(right.lng - left.lng);
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(left.lat)) * Math.cos(radians(right.lat)) *
    Math.sin(deltaLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildPublication(item, actor = "") {
  if (
    item.locationVerified !== true ||
    !Number.isFinite(item.lat) ||
    !Number.isFinite(item.lng) ||
    item.lat === 0 ||
    item.lng === 0
  )
    fail("주소와 좌표를 확인 완료한 제보만 승인할 수 있습니다.", 409);
  const normalizedName = normalizeIdentity(item.name);
  const normalizedAddress = normalizeIdentity(item.location);
  const duplicate = dataset.restaurants.find((restaurant) =>
    normalizedName === normalizeIdentity(restaurant.name) &&
    (normalizedAddress === normalizeIdentity(restaurant.address) ||
      (Number.isFinite(restaurant.lat) && Number.isFinite(restaurant.lng) &&
        distanceKm(item, restaurant) <= 0.1)),
  );
  if (duplicate)
    fail(`이미 등록된 식당입니다: ${duplicate.name}`, 409);
  const id = `community-${item.requestId}`;
  const address = [item.location, item.locationDetail].filter(Boolean).join(" ");
  const menus = (Array.isArray(item.menus) ? item.menus : []).map((menu, index) => ({
    id: `${id}-menu-${index + 1}`,
    name: menu.name,
    ...(menu.price == null ? {} : { price: String(menu.price) }),
    ...(menu.unit ? { description: menu.unit } : {}),
    isSignature: index === 0,
  }));
  const publishedAt = Date.now();
  return {
    requestId: item.requestId,
    dedupeKey: `${normalizedName}:${normalizedAddress}`,
    publishedAt,
    moderatedBy: actor,
    restaurant: {
      id,
      name: item.name,
      region: broadRegion(item.location),
      address,
      category: "추천식당",
      representativeMenu: menus[0]?.name || "",
      lat: item.lat,
      lng: item.lng,
      imageUrl: item.imageUrl || "",
      menus,
      operationState: "unknown",
      operationStatus: "사용자 제보 · 운영자 위치 확인",
      locationVerifiedAt: new Date(publishedAt).toISOString().slice(0, 10),
      ...(item.mapUrl ? { placeUrl: item.mapUrl } : {}),
    },
    sourceLink: {
      id: `community-link-${item.requestId}`,
      restaurantId: id,
      sourceId: "community-picks",
      label: "사용자 추천",
    },
  };
}

async function redis(command) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token)
    fail(
      "제보 저장소에 연결하지 못했어요. 작성 내용은 유지되니 잠시 후 다시 시도해 주세요.",
      503,
    );
  const response = await fetch(url.replace(/\/$/, ""), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    fail("제보를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.", 503);
  const body = await response.json();
  if (body.error)
    fail("제보 저장소에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.", 503);
  return body.result;
}

async function saveSuggestion(input) {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  const entry = {
    ...input,
    id: randomUUID(),
    status: "pending",
    createdAt: Date.now(),
    fingerprint,
  };
  // Atomically store each submission and its inbox index. Retries reuse the receipt.
  const raw = await redis([
    "EVAL",
    `
    local old = redis.call('GET', KEYS[1])
    if old then return old end
    redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3])
    redis.call('ZADD', KEYS[2], ARGV[2], KEYS[1])
    return ARGV[1]
  `,
    2,
    `${PREFIX}${input.requestId}`,
    INDEX,
    JSON.stringify(entry),
    entry.createdAt,
    RETENTION_SECONDS,
  ]);
  if (typeof raw !== "string")
    fail("제보 접수를 확인하지 못했어요. 다시 시도해 주세요.", 503);
  const saved = JSON.parse(raw);
  if (saved.fingerprint !== fingerprint)
    fail("이미 접수된 제보입니다. 다른 식당은 새 제보로 작성해 주세요.", 409);
  return { id: saved.id, status: saved.status, createdAt: saved.createdAt };
}

async function listSuggestions(page = 0) {
  // Approved submissions remain reviewable for revocation; only expired records
  // may be removed from the inbox index.
  const keys = await redis(["ZREVRANGE", INDEX, page * 50, page * 50 + 49]);
  if (!Array.isArray(keys)) fail("제보 목록을 확인하지 못했습니다.", 503);
  const values = keys.length ? await redis(["MGET", ...keys]) : [];
  if (Array.isArray(values)) {
    const expired = keys.filter((key, index) => !values[index]);
    if (expired.length) await redis(["ZREM", INDEX, ...expired]);
  }
  const total = Number(await redis(["ZCARD", INDEX]));
  if (!Array.isArray(values) || !Number.isFinite(total))
    fail("제보 목록을 확인하지 못했습니다.", 503);
  return {
    items: values.filter(Boolean).map((value) => {
      const { fingerprint, ...item } = JSON.parse(value);
      // Redis Lua cjson can encode empty arrays as objects during a status update.
      return {
        ...item,
        menus: Array.isArray(item.menus) ? item.menus : [],
        tags: Array.isArray(item.tags) ? item.tags : [],
      };
    }),
    total,
    page,
    pageSize: 50,
  };
}

async function updateSuggestion(requestId, status, actor = "", draft = null, publish = true) {
  if (
    typeof requestId !== "string" ||
    !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(requestId) ||
    !["pending", "approved", "rejected", "reviewed", "archived"].includes(status)
  )
    fail("처리 상태를 확인해 주세요.");
  const key = `${PREFIX}${requestId.toLowerCase()}`;
  const existingRaw = await redis(["GET", key]);
  if (typeof existingRaw !== "string")
    fail("제보를 찾을 수 없습니다. 목록을 새로고침해 주세요.", 404);
  const existing = JSON.parse(existingRaw);
  const edited = draft ? validateAdminDraft(draft, existing) : existing;
  const publication = status === "approved" && publish ? buildPublication(edited, actor) : null;
  const result = await redis([
    "EVAL",
    `
    local raw = redis.call('GET', KEYS[1])
    if not raw then return 0 end
    local item = cjson.decode(raw)
    local publishedId = 'community-' .. item.requestId
    if ARGV[1] == 'approved' and ARGV[7] == 'publish' then
      local duplicateId = redis.call('HGET', KEYS[3], ARGV[4])
      if duplicateId and duplicateId ~= publishedId then return -1 end
      local oldPublicationRaw = redis.call('HGET', KEYS[2], publishedId)
      if oldPublicationRaw then
        local oldPublication = cjson.decode(oldPublicationRaw)
        if oldPublication.dedupeKey ~= ARGV[4] and redis.call('HGET', KEYS[3], oldPublication.dedupeKey) == publishedId then
          redis.call('HDEL', KEYS[3], oldPublication.dedupeKey)
        end
      end
      redis.call('HSET', KEYS[2], publishedId, ARGV[3])
      redis.call('HSET', KEYS[3], ARGV[4], publishedId)
      redis.call('PERSIST', KEYS[1])
      redis.call('ZADD', KEYS[4], ARGV[2], KEYS[1])
    elseif ARGV[1] ~= 'approved' then
      local publicationRaw = redis.call('HGET', KEYS[2], publishedId)
      if publicationRaw then
        local publication = cjson.decode(publicationRaw)
        if redis.call('HGET', KEYS[3], publication.dedupeKey) == publishedId then
          redis.call('HDEL', KEYS[3], publication.dedupeKey)
        end
        redis.call('HDEL', KEYS[2], publishedId)
      end
    end
    item = cjson.decode(ARGV[6])
    item.status = ARGV[1]
    item.reviewedAt = tonumber(ARGV[2])
    redis.call('SET', KEYS[1], cjson.encode(item), 'KEEPTTL')
    if ARGV[1] ~= 'approved' and redis.call('TTL', KEYS[1]) < 0 then
      redis.call('EXPIRE', KEYS[1], ARGV[5])
    end
    return 1
  `,
    4,
    key,
    PUBLISHED,
    PUBLISHED_DEDUPE,
    INDEX,
    status,
    Date.now(),
    publication ? JSON.stringify(publication) : "",
    publication?.dedupeKey || "",
    RETENTION_SECONDS,
    JSON.stringify(edited),
    publish ? "publish" : "save",
  ]);
  if (result === -1)
    fail("이미 승인된 같은 이름과 주소의 추천식당이 있습니다.", 409);
  if (result !== 1)
    fail("제보를 찾을 수 없습니다. 목록을 새로고침해 주세요.", 404);
  return publication;
}

async function listPublishedSuggestions() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return [];
  const values = await redis(["HVALS", PUBLISHED]);
  if (!Array.isArray(values)) fail("추천식당 목록을 확인하지 못했습니다.", 503);
  return values.flatMap((value) => {
    try {
      const publication = JSON.parse(value);
      return publication?.restaurant && publication?.sourceLink ? [publication] : [];
    } catch {
      return [];
    }
  });
}

module.exports = {
  validateSuggestion,
  saveSuggestion,
  listSuggestions,
  updateSuggestion,
  listPublishedSuggestions,
  buildPublication,
  validateAdminDraft,
};
