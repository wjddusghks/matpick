const EDITS_KEY = "matpick:restaurant-edits:v1";
const HISTORY_KEY = "matpick:restaurant-edits:history:v1";

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

function getConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function redis(command) {
  const config = getConfig();
  if (!config)
    fail(
      "식당 저장소에 연결되지 않았습니다. 변경 내용은 저장되지 않았습니다.",
      503,
    );
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    fail("식당 저장소 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.", 503);
  const payload = await response.json();
  if (payload.error) fail("식당 저장소에서 요청을 처리하지 못했습니다.", 503);
  return payload.result;
}

function text(value, label, max, required = false) {
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

function url(value) {
  const result = text(value, "출처 URL", 2000);
  try {
    const parsed = new URL(result);
    if (
      !["https:", "http:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    )
      throw new Error();
  } catch {
    fail("출처는 http 또는 https 주소로 입력해 주세요.");
  }
  return result;
}

function validateChanges(input, restaurantId) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("수정할 식당 정보를 확인해 주세요.");
  const fields = [
    "name",
    "region",
    "address",
    "category",
    "phone",
    "lat",
    "lng",
    "operationState",
    "menus",
    "menuPriceVerifiedAt",
    "menuPriceSources",
    "menuPriceNote",
  ];
  if (Object.keys(input).some((key) => !fields.includes(key)))
    fail("수정할 수 없는 항목이 포함되어 있습니다.");
  const result = {};
  for (const [key, max, required] of [
    ["name", 200, true],
    ["region", 100, true],
    ["address", 500, true],
    ["category", 100, true],
    ["phone", 80, false],
    ["menuPriceNote", 1000, false],
  ]) {
    if (key in input) result[key] = text(input[key], key, max, required);
  }
  for (const [key, limit] of [
    ["lat", 90],
    ["lng", 180],
  ]) {
    if (key in input) {
      if (
        typeof input[key] !== "number" ||
        !Number.isFinite(input[key]) ||
        input[key] === 0 ||
        Math.abs(input[key]) > limit
      )
        fail("위도·경도를 확인해 주세요.");
      result[key] = input[key];
    }
  }
  if ("operationState" in input) {
    if (
      ![
        "unknown",
        "operating",
        "closed",
        "moved",
        "temporarily_closed",
      ].includes(input.operationState)
    )
      fail("영업 상태를 확인해 주세요.");
    result.operationState = input.operationState;
  }
  if ("menus" in input) {
    if (!Array.isArray(input.menus) || input.menus.length > 100)
      fail("메뉴는 최대 100개까지 등록할 수 있습니다.");
    result.menus = input.menus.map((menu, index) => {
      if (!menu || typeof menu !== "object") fail("메뉴 정보를 확인해 주세요.");
      const name = text(menu.name, "메뉴명", 200, true);
      const price = text(menu.price ?? "", "가격", 120);
      if (/^[-−]\s*\d/.test(price)) fail("가격은 음수로 입력할 수 없습니다.");
      return {
        id: `${restaurantId}_admin_menu_${index + 1}`,
        name,
        price,
        description: text(menu.description ?? "", "메뉴 설명", 500),
        isSignature: menu.isSignature === true,
      };
    });
    result.representativeMenu = [
      ...result.menus.filter((menu) => menu.isSignature),
      ...result.menus.filter((menu) => !menu.isSignature),
    ]
      .slice(0, 3)
      .map((menu) => menu.name)
      .join(" / ");
    result.menuPriceStatus = result.menus.some((menu) => menu.price)
      ? "admin_updated"
      : "menu_only";
    // A cleared confirmation date must not fall back to an old collection date.
    result.detailCollectedAt = "";
    result.menuPriceVerifiedAt = "";
    result.menuPriceSources = [];
  }
  if ("menuPriceVerifiedAt" in input && input.menuPriceVerifiedAt !== "") {
    const date = text(input.menuPriceVerifiedAt, "확인일", 10);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date ||
      date > new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })
    )
      fail("확인일은 오늘 이전의 유효한 날짜로 입력해 주세요.");
    result.menuPriceVerifiedAt = date;
  } else if ("menuPriceVerifiedAt" in input) result.menuPriceVerifiedAt = "";
  if ("menuPriceSources" in input) {
    if (
      !Array.isArray(input.menuPriceSources) ||
      input.menuPriceSources.length > 10
    )
      fail("가격 출처는 최대 10개까지 등록할 수 있습니다.");
    result.menuPriceSources = input.menuPriceSources.map((source) => ({
      url: url(source?.url),
      label: text(source?.label ?? "", "출처 이름", 100),
    }));
  }
  return result;
}

async function readEdits() {
  if (!getConfig()) return { configured: false, edits: [] };
  const records = await redis(["HVALS", EDITS_KEY]);
  return {
    configured: true,
    edits: (records || []).map((record) =>
      typeof record === "string" ? JSON.parse(record) : record,
    ),
  };
}

async function saveEdit({
  restaurantId,
  expectedRevision,
  changes,
  actor,
  action = "save",
}) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    fail("수정 버전이 올바르지 않습니다. 새로고침해 주세요.");
  const previousRaw = await redis(["HGET", EDITS_KEY, restaurantId]);
  const previous =
    typeof previousRaw === "string" ? JSON.parse(previousRaw) : previousRaw;
  if ((previous?.revision || 0) !== expectedRevision)
    fail(
      "다른 창에서 이 식당을 먼저 수정했습니다. 새로고침 후 다시 확인해 주세요.",
      409,
    );
  const edit = {
    restaurantId,
    revision: expectedRevision + 1,
    updatedAt: new Date().toISOString(),
    changes: action === "reset" ? {} : { ...previous?.changes, ...changes },
  };
  // Compare and write atomically; concurrent edits must never silently overwrite each other.
  const script = `
    local previous = redis.call('HGET', KEYS[1], ARGV[1])
    local revision = 0
    if previous then revision = cjson.decode(previous).revision end
    if revision ~= tonumber(ARGV[2]) then return 0 end
    redis.call('HSET', KEYS[1], ARGV[1], ARGV[3])
    redis.call('LPUSH', KEYS[2], cjson.encode({previous=previous or false, next=ARGV[3], actor=ARGV[4], action=ARGV[5]}))
    redis.call('LTRIM', KEYS[2], 0, 499)
    return 1
  `;
  const result = await redis([
    "EVAL",
    script,
    2,
    EDITS_KEY,
    HISTORY_KEY,
    restaurantId,
    expectedRevision,
    JSON.stringify(edit),
    actor,
    action,
  ]);
  if (result !== 1)
    fail(
      "다른 창에서 이 식당을 먼저 수정했습니다. 새로고침 후 다시 확인해 주세요.",
      409,
    );
  return edit;
}

module.exports = { readEdits, saveEdit, validateChanges };
