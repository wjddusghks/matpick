import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";

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
  const googleTagIds = useMemo(() => normalizeGoogleTagIds(), []);
  const metaPixelId = import.meta.env.VITE_META_PIXEL_ID?.trim() ?? "";

  useEffect(() => {
    ensureGoogleTag(googleTagIds);
  }, [googleTagIds]);

  useEffect(() => {
    ensureMetaPixel(metaPixelId);
  }, [metaPixelId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const payload = getPagePayload(location);

      if (googleTagIds.length > 0 && window.gtag) {
        window.gtag("event", "page_view", payload);
      }

      if (metaPixelId && window.fbq) {
        window.fbq("track", "PageView");
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [googleTagIds, location, metaPixelId]);

  return null;
}
