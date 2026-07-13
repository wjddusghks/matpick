import { hasAnalyticsConsent } from "@/lib/privacyConsent";

const VISITOR_ID_KEY = "matpick_analytics_visitor_id";
const SESSION_ID_KEY = "matpick_analytics_session_id";
const SESSION_STARTED_KEY = "matpick_analytics_session_started";

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

function writeStorage(storage: Storage | undefined, key: string, value: string) {
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

export function getCurrentAnalyticsPath() {
  if (typeof window === "undefined") {
    return "/";
  }

  return `${window.location.pathname}${window.location.search}`;
}

export function trackAnalyticsEvent(
  type: AnalyticsEventType,
  input: Omit<AnalyticsEventInput, "type"> = {},
  options: { keepalive?: boolean } = {}
) {
  if (typeof window === "undefined") {
    return;
  }

  if (!hasAnalyticsConsent()) {
    return;
  }

  const payload = {
    ...input,
    type,
    path: input.path || getCurrentAnalyticsPath(),
    visitorId: getAnalyticsVisitorId(),
    sessionId: getAnalyticsSessionId(),
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
