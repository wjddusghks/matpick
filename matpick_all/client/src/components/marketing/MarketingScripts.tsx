import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  getMarketingEventName,
  type MarketingEventDetail,
} from "@/lib/marketing";
import {
  PRIVACY_PREFERENCES_EVENT,
  readPrivacyPreferences,
  type PrivacyPreferences,
} from "@/lib/privacyConsent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    __matpickGoogleTagReady?: boolean;
    __matpickMetaPixelInitialized?: boolean;
  }
}

const GOOGLE_TAG_SCRIPT_ID = "matpick-google-tag";
const META_PIXEL_SCRIPT_ID = "matpick-meta-pixel";
const GOOGLE_SITE_VERIFICATION_META_ID = "matpick-google-site-verification";
const NAVER_SITE_VERIFICATION_META_ID = "matpick-naver-site-verification";

function ensureScript(id: string, src: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const existing = document.getElementById(id);
  if (existing) {
    return existing;
  }

  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
  return script;
}

function normalizeGoogleTagIds() {
  return (import.meta.env.VITE_GOOGLE_TAG_IDS?.trim() ?? "")
    .split(",")
    .map((value: string) => value.trim())
    .filter(Boolean);
}

function upsertMetaTag(id: string, name: string, content: string) {
  if (typeof document === "undefined") {
    return () => {};
  }

  let meta = document.getElementById(id) as HTMLMetaElement | null;
  const created = !meta;

  if (!meta) {
    meta = document.createElement("meta");
    meta.id = id;
    meta.name = name;
    document.head.appendChild(meta);
  }

  meta.content = content;

  return () => {
    if (created) {
      meta?.remove();
    }
  };
}

function toMetaPixelPayload(
  name: string,
  params: Record<string, unknown>
): { mode: "standard" | "custom"; name: string } {
  switch (name) {
    case "search_submit":
      return { mode: "standard", name: "Search" };
    case "restaurant_view":
      return { mode: "standard", name: "ViewContent" };
    case "favorite_save":
    case "topic_save":
      return { mode: "standard", name: "AddToWishlist" };
    default:
      return { mode: "custom", name };
  }
}

function getPagePayload(path: string) {
  if (typeof window === "undefined") {
    return {
      page_path: path,
      page_location: path,
      page_title: "Matpick",
    };
  }

  return {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  };
}

function ensureGoogleTag(googleTagIds: string[]) {
  if (googleTagIds.length === 0 || typeof window === "undefined") {
    return;
  }

  ensureScript(
    GOOGLE_TAG_SCRIPT_ID,
    `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleTagIds[0])}`
  );

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };

  if (window.__matpickGoogleTagReady) {
    return;
  }

  window.__matpickGoogleTagReady = true;
  window.gtag("js", new Date());
  googleTagIds.forEach((tagId) => {
    window.gtag?.("config", tagId, { send_page_view: false });
  });
}

function ensureMetaPixel(metaPixelId: string) {
  if (!metaPixelId || typeof window === "undefined") {
    return;
  }

  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      (fbq as typeof fbq & { queue?: unknown[][]; callMethod?: (...args: unknown[]) => void }).callMethod
        ? (fbq as typeof fbq & { callMethod: (...args: unknown[]) => void }).callMethod(...args)
        : ((fbq as typeof fbq & { queue?: unknown[][] }).queue =
            (fbq as typeof fbq & { queue?: unknown[][] }).queue || []).push(args);
    };

    (fbq as typeof fbq & { push?: typeof fbq }).push = fbq;
    window.fbq = fbq;
    window._fbq = fbq;
  }

  ensureScript(META_PIXEL_SCRIPT_ID, "https://connect.facebook.net/en_US/fbevents.js");

  if (window.__matpickMetaPixelInitialized) {
    return;
  }

  window.__matpickMetaPixelInitialized = true;
  window.fbq("init", metaPixelId);
}

export default function MarketingScripts() {
  const [location] = useLocation();
  const [preferences, setPreferences] = useState(() => readPrivacyPreferences());
  const googleTagIds = useMemo(() => normalizeGoogleTagIds(), []);
  const activeGoogleTagIds = useMemo(
    () =>
      googleTagIds.filter((tagId) =>
        tagId.startsWith("G-") ? preferences?.analytics : preferences?.advertising
      ),
    [googleTagIds, preferences?.advertising, preferences?.analytics]
  );
  const metaPixelId = import.meta.env.VITE_META_PIXEL_ID?.trim() ?? "";
  const googleSiteVerification =
    import.meta.env.VITE_GOOGLE_SITE_VERIFICATION?.trim() ?? "";
  const naverSiteVerification =
    import.meta.env.VITE_NAVER_SITE_VERIFICATION?.trim() ?? "";

  useEffect(() => {
    const handlePreferences = (event: Event) => {
      const next = (event as CustomEvent<PrivacyPreferences>).detail;
      if (next?.version === 1) {
        setPreferences(next);
      }
    };

    window.addEventListener(PRIVACY_PREFERENCES_EVENT, handlePreferences as EventListener);
    return () =>
      window.removeEventListener(PRIVACY_PREFERENCES_EVENT, handlePreferences as EventListener);
  }, []);

  useEffect(() => {
    if (activeGoogleTagIds.length === 0) {
      window.gtag?.("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
      return;
    }

    ensureGoogleTag(activeGoogleTagIds);
    window.gtag?.("consent", "update", {
      analytics_storage: preferences?.analytics ? "granted" : "denied",
      ad_storage: preferences?.advertising ? "granted" : "denied",
      ad_user_data: preferences?.advertising ? "granted" : "denied",
      ad_personalization: preferences?.advertising ? "granted" : "denied",
    });
  }, [activeGoogleTagIds, preferences?.advertising, preferences?.analytics]);

  useEffect(() => {
    if (!preferences?.advertising) {
      window.fbq?.("revokeConsent");
      return;
    }

    ensureMetaPixel(metaPixelId);
    window.fbq?.("grantConsent");
  }, [metaPixelId, preferences?.advertising]);

  useEffect(() => {
    const cleanups: Array<() => void> = [];

    if (googleSiteVerification) {
      cleanups.push(
        upsertMetaTag(
          GOOGLE_SITE_VERIFICATION_META_ID,
          "google-site-verification",
          googleSiteVerification
        )
      );
    }

    if (naverSiteVerification) {
      cleanups.push(
        upsertMetaTag(
          NAVER_SITE_VERIFICATION_META_ID,
          "naver-site-verification",
          naverSiteVerification
        )
      );
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [googleSiteVerification, naverSiteVerification]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const payload = getPagePayload(location);

      if (activeGoogleTagIds.length > 0 && window.gtag) {
        window.gtag("event", "page_view", payload);
      }

      if (preferences?.advertising && metaPixelId && window.fbq) {
        window.fbq("track", "PageView");
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeGoogleTagIds, location, metaPixelId, preferences?.advertising]);

  useEffect(() => {
    const eventName = getMarketingEventName();

    const handleTrack = (event: Event) => {
      const detail = (event as CustomEvent<MarketingEventDetail>).detail;

      if (!detail?.name) {
        return;
      }

      const params = detail.params ?? {};

      if (activeGoogleTagIds.length > 0 && window.gtag) {
        window.gtag("event", detail.name, params);
      }

      if (preferences?.advertising && metaPixelId && window.fbq) {
        const metaPixelPayload = toMetaPixelPayload(detail.name, params);
        if (metaPixelPayload.mode === "standard") {
          window.fbq("track", metaPixelPayload.name, params);
        } else {
          window.fbq("trackCustom", metaPixelPayload.name, params);
        }
      }
    };

    window.addEventListener(eventName, handleTrack as EventListener);
    return () => {
      window.removeEventListener(eventName, handleTrack as EventListener);
    };
  }, [activeGoogleTagIds, metaPixelId, preferences?.advertising]);

  return null;
}
