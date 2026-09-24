const { createHash, randomUUID } = require("node:crypto");

const PREFIX = "matpick:restaurant-suggestion:v1:";
const INDEX = "matpick:restaurant-suggestions:v1";
const RETENTION_SECONDS = 180 * 24 * 60 * 60;
const TAGS = ["데이트", "혼밥", "가족 식사", "친구 모임", "여행", "가성비"];

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
  await redis([
    "ZREMRANGEBYSCORE",
    INDEX,
    "-inf",
    Date.now() - RETENTION_SECONDS * 1000,
  ]);
  const keys = await redis(["ZREVRANGE", INDEX, page * 50, page * 50 + 49]);
  if (!Array.isArray(keys)) fail("제보 목록을 확인하지 못했습니다.", 503);
  const values = keys.length ? await redis(["MGET", ...keys]) : [];
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

async function updateSuggestion(requestId, status) {
  if (
    typeof requestId !== "string" ||
    !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(requestId) ||
    !["pending", "reviewed", "archived"].includes(status)
  )
    fail("처리 상태를 확인해 주세요.");
  const result = await redis([
    "EVAL",
    `
    local raw = redis.call('GET', KEYS[1])
    if not raw then return 0 end
    local item = cjson.decode(raw)
    item.status = ARGV[1]
    item.reviewedAt = tonumber(ARGV[2])
    redis.call('SET', KEYS[1], cjson.encode(item), 'KEEPTTL')
    return 1
  `,
    1,
    `${PREFIX}${requestId.toLowerCase()}`,
    status,
    Date.now(),
  ]);
  if (result !== 1)
    fail("제보를 찾을 수 없습니다. 목록을 새로고침해 주세요.", 404);
}

module.exports = {
  validateSuggestion,
  saveSuggestion,
  listSuggestions,
  updateSuggestion,
};
