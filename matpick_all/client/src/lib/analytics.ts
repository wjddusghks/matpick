import { hasAnalyticsConsent } from "@/lib/privacyConsent";

const VISITOR_ID_KEY = "matpick_analytics_visitor_id";
const SESSION_ID_KEY = "matpick_analytics_session_id";
const SESSION_STARTED_KEY = "matpick_analytics_session_started";
const ATTRIBUTION_PATH_KEY = "matpick_analytics_attribution_path";
const QA_EXCLUSION_KEY = "matpick_analytics_qa_excluded";
const TRUSTED_CAMPAIGN_SOURCES = new Set([
  "instagram",
  "threads",
  "pinterest",
  "naver",
  "naver_blog",
  "kakao",
]);

export type AnalyticsEventType =
  | "session_start"
  | "page_view"
  | "duration"
  | "map_click"
  | "search"
  | "marketing_event"
  | "ad_impression"
  | "ad_click";

export type AnalyticsEventInput = {
  type: AnalyticsEventType;
  path?: string;
  name?: string;
  query?: string;
  provider?: "adsense" | "adfit" | "coupang" | "unknown";
  targetLabel?: string;
  href?: string;
  durationMs?: number;
  restaurantId?: string;
};

function createId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random}`;
}

function readStorage(storage: Storage | undefined, key: string) {
  try {
    return storage?.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeStorage(
  storage: Storage | undefined,
  key: string,
  value: string
) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
}

export function getAnalyticsVisitorId() {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = readStorage(window.localStorage, VISITOR_ID_KEY);
  if (existing) {
    return existing;
  }

  const next = createId("visitor");
  writeStorage(window.localStorage, VISITOR_ID_KEY, next);
  return next;
}

export function getAnalyticsSessionId() {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = readStorage(window.sessionStorage, SESSION_ID_KEY);
  if (existing) {
    return existing;
  }

  const next = createId("session");
  writeStorage(window.sessionStorage, SESSION_ID_KEY, next);
  return next;
}

export function markAnalyticsSessionStarted() {
  if (typeof window === "undefined" || !hasAnalyticsConsent()) {
    return false;
  }

  const existing = readStorage(window.sessionStorage, SESSION_STARTED_KEY);
  if (existing) {
    return false;
  }

  writeStorage(window.sessionStorage, SESSION_STARTED_KEY, "1");
  return true;
}

export function sanitizeClientAnalyticsPath(path: string) {
  const pathname = path.split(/[?#]/, 1)[0];
  return pathname.startsWith("/auth/callback/") ? pathname : path;
}

function isAnalyticsExcluded() {
  if (typeof window === "undefined") return true;
  if (["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)) return true;

  const params = new URLSearchParams(window.location.search);
  if (params.get("mp_qa") === "1") {
    writeStorage(window.sessionStorage, QA_EXCLUSION_KEY, "1");
    return true;
  }
  return readStorage(window.sessionStorage, QA_EXCLUSION_KEY) === "1";
}

function getCampaignAttributionPath() {
  const existing = readStorage(window.sessionStorage, ATTRIBUTION_PATH_KEY);
  if (existing) return existing;

  const params = new URLSearchParams(window.location.search);
  const source = (params.get("utm_source") || "").toLowerCase();
  const validSlug = (value: string) => /^[a-z0-9_-]{1,80}$/.test(value);

  if (TRUSTED_CAMPAIGN_SOURCES.has(source)) {
    const campaign = new URLSearchParams({ utm_source: source });
    for (const key of ["utm_medium", "utm_campaign", "utm_content"]) {
      const value = (params.get(key) || "").toLowerCase();
      if (validSlug(value)) campaign.set(key, value);
    }
    const path = `/?${campaign.toString()}`;
    writeStorage(window.sessionStorage, ATTRIBUTION_PATH_KEY, path);
    return path;
  }

  return "";
}

export function getCurrentAnalyticsPath() {
  if (typeof window === "undefined") {
    return "/";
  }

  return sanitizeClientAnalyticsPath(
    `${window.location.pathname}${window.location.search}`
  );
}

export function trackAnalyticsEvent(
  type: AnalyticsEventType,
  input: Omit<AnalyticsEventInput, "type"> = {},
  options: { keepalive?: boolean } = {}
) {
  if (typeof window === "undefined") {
    return;
  }

  if (isAnalyticsExcluded() || !hasAnalyticsConsent()) {
    return;
  }

  const payload = {
    ...input,
    type,
    path: sanitizeClientAnalyticsPath(input.path || getCurrentAnalyticsPath()),
    visitorId: getAnalyticsVisitorId(),
    sessionId: getAnalyticsSessionId(),
    campaignPath: getCampaignAttributionPath(),
  };
  const body = JSON.stringify(payload);

  if (options.keepalive && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/analytics/event", blob);
    return;
  }

  void fetch("/api/analytics/event", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    keepalive: Boolean(options.keepalive),
  }).catch(() => {
    // Analytics must never block the product experience.
  });
}
