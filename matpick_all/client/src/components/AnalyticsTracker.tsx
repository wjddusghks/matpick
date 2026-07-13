import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  getCurrentAnalyticsPath,
  markAnalyticsSessionStarted,
  trackAnalyticsEvent,
} from "@/lib/analytics";
import { getMarketingEventName, type MarketingEventDetail } from "@/lib/marketing";
import {
  PRIVACY_PREFERENCES_EVENT,
  type PrivacyPreferences,
} from "@/lib/privacyConsent";

function isMapEvent(name: string) {
  return name.includes("map") || name.includes("directions");
}

function getSearchQuery(params: MarketingEventDetail["params"]) {
  const query = params?.query;
  return typeof query === "string" ? query : "";
}

function getEventTargetLabel(name: string, params: MarketingEventDetail["params"]) {
  const candidate =
    params?.label || params?.title || params?.restaurant || params?.destination || params?.query;
  return typeof candidate === "string" && candidate.trim() ? candidate : name;
}

function findTrackableElement(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest<HTMLElement>("a, button, [role='button']");
}

function getElementLabel(element: HTMLElement) {
  return (
    element.getAttribute("aria-label") ||
    element.getAttribute("title") ||
    element.textContent ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function getElementHref(element: HTMLElement) {
  return element instanceof HTMLAnchorElement ? element.href : "";
}

function classifyClick(element: HTMLElement) {
  const href = getElementHref(element);
  const label = getElementLabel(element);
  const signature = `${href} ${label} ${element.className} ${element.id}`.toLowerCase();

  if (signature.includes("coupang")) {
    return {
      type: "ad_click" as const,
      provider: "coupang" as const,
      targetLabel: label || href || "coupang",
      href,
    };
  }

  if (signature.includes("adfit") || signature.includes("kakao_ad")) {
    return {
      type: "ad_click" as const,
      provider: "adfit" as const,
      targetLabel: label || href || "adfit",
      href,
    };
  }

  if (
    href.includes("/map") ||
    href.includes("map.naver.com") ||
    href.includes("kakaomap") ||
    label.includes("지도")
  ) {
    return {
      type: "map_click" as const,
      targetLabel: label || href || "map",
      href,
    };
  }

  return null;
}

export default function AnalyticsTracker() {
  const [location] = useLocation();
  const activePathRef = useRef("");
  const pageStartedAtRef = useRef(Date.now());

  useEffect(() => {
    if (markAnalyticsSessionStarted()) {
      trackAnalyticsEvent("session_start");
    }
  }, []);

  useEffect(() => {
    const handlePreferences = (event: Event) => {
      const preferences = (event as CustomEvent<PrivacyPreferences>).detail;
      if (!preferences?.analytics) {
        return;
      }

      if (markAnalyticsSessionStarted()) {
        trackAnalyticsEvent("session_start");
      }
      activePathRef.current = getCurrentAnalyticsPath();
      pageStartedAtRef.current = Date.now();
      trackAnalyticsEvent("page_view", { path: activePathRef.current });
    };

    window.addEventListener(PRIVACY_PREFERENCES_EVENT, handlePreferences as EventListener);
    return () =>
      window.removeEventListener(PRIVACY_PREFERENCES_EVENT, handlePreferences as EventListener);
  }, []);

  useEffect(() => {
    const nextPath = getCurrentAnalyticsPath();
    const previousPath = activePathRef.current;
    const now = Date.now();

    if (previousPath && previousPath !== nextPath) {
      const durationMs = now - pageStartedAtRef.current;
      trackAnalyticsEvent(
        "duration",
        { path: previousPath, durationMs },
        { keepalive: true }
      );
    }

    activePathRef.current = nextPath;
    pageStartedAtRef.current = now;
    trackAnalyticsEvent("page_view", { path: nextPath });
  }, [location]);

  useEffect(() => {
    const sendDuration = () => {
      const path = activePathRef.current || getCurrentAnalyticsPath();
      const now = Date.now();
      const durationMs = now - pageStartedAtRef.current;
      pageStartedAtRef.current = now;
      trackAnalyticsEvent("duration", { path, durationMs }, { keepalive: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendDuration();
      }
    };

    window.addEventListener("pagehide", sendDuration);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", sendDuration);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handleMarketingEvent = (event: Event) => {
      const detail = (event as CustomEvent<MarketingEventDetail>).detail;
      if (!detail?.name) {
        return;
      }

      trackAnalyticsEvent("marketing_event", {
        name: detail.name,
        targetLabel: getEventTargetLabel(detail.name, detail.params),
      });

      if (detail.name === "search_submit") {
        trackAnalyticsEvent("search", {
          query: getSearchQuery(detail.params),
        });
      }

      if (isMapEvent(detail.name)) {
        trackAnalyticsEvent("map_click", {
          targetLabel: getEventTargetLabel(detail.name, detail.params),
        });
      }
    };

    window.addEventListener(getMarketingEventName(), handleMarketingEvent);
    return () => window.removeEventListener(getMarketingEventName(), handleMarketingEvent);
  }, []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const element = findTrackableElement(event.target);
      if (!element) {
        return;
      }

      const classified = classifyClick(element);
      if (!classified) {
        return;
      }

      if (classified.type === "ad_click") {
        trackAnalyticsEvent("ad_click", classified);
      } else {
        trackAnalyticsEvent("map_click", classified);
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
