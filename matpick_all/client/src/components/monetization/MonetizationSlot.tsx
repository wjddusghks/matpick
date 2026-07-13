import { useEffect, useRef, useState } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
    PartnersCoupang?: {
      G?: new (config: Record<string, string>) => unknown;
    };
  }
}

export type MonetizationProvider = "adsense" | "kakao" | "coupang";

function parseBannerDimension(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function useCompactViewport() {
  const [isCompactViewport, setIsCompactViewport] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const updateViewportMode = () => {
      setIsCompactViewport(mediaQuery.matches);
    };

    updateViewportMode();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateViewportMode);
      return () => mediaQuery.removeEventListener("change", updateViewportMode);
    }

    mediaQuery.addListener(updateViewportMode);
    return () => mediaQuery.removeListener(updateViewportMode);
  }, []);

  return isCompactViewport;
}

function SlotFrame({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-[#efe5e6] bg-white p-4 shadow-[0_10px_32px_rgba(0,0,0,0.04)]">
      {label ? (
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1a6a7]">
          {label}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function AdsenseSlot({
  label,
  slot = import.meta.env.VITE_ADSENSE_SLOT_INLINE?.trim() ?? "",
}: {
  label?: string;
  slot?: string;
}) {
  const insRef = useRef<HTMLModElement | null>(null);
  const client = import.meta.env.VITE_ADSENSE_CLIENT?.trim() ?? "";

  useEffect(() => {
    if (!client || !slot || !insRef.current) {
      return;
    }

    const element = insRef.current;

    const renderAd = () => {
      if (!element || element.getAttribute("data-adsbygoogle-status") === "done") {
        return;
      }

      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
      } catch {
        // noop
      }
    };

    renderAd();
    window.addEventListener("matpick:adsense-ready", renderAd);

    return () => {
      window.removeEventListener("matpick:adsense-ready", renderAd);
    };
  }, [client, slot]);

  useEffect(() => {
    if (!client || !slot) {
      return;
    }

    trackAnalyticsEvent("ad_impression", {
      provider: "adsense",
      targetLabel: slot,
    });
  }, [client, slot]);

  if (!client || !slot) {
    return null;
  }

  return (
    <SlotFrame label={label}>
      <ins
        ref={insRef}
        className="adsbygoogle block min-h-[120px] overflow-hidden rounded-[18px] bg-[#faf7f8]"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </SlotFrame>
  );
}

export function KakaoAdfitSlot({
  label,
  unit = import.meta.env.VITE_KAKAO_ADFIT_UNIT?.trim() ?? "",
  mobileUnit = import.meta.env.VITE_KAKAO_ADFIT_MOBILE_UNIT?.trim() ?? "",
  width = import.meta.env.VITE_KAKAO_ADFIT_WIDTH?.trim() ?? "320",
  height = import.meta.env.VITE_KAKAO_ADFIT_HEIGHT?.trim() ?? "100",
  mobileWidth = import.meta.env.VITE_KAKAO_ADFIT_MOBILE_WIDTH?.trim() ?? "320",
  mobileHeight = import.meta.env.VITE_KAKAO_ADFIT_MOBILE_HEIGHT?.trim() ?? "100",
}: {
  label?: string;
  unit?: string;
  mobileUnit?: string;
  width?: string;
  height?: string;
  mobileWidth?: string;
  mobileHeight?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isCompactViewport = useCompactViewport();
  const selectedUnit = isCompactViewport && mobileUnit ? mobileUnit : unit;
  const configuredAdWidth = parseBannerDimension(
    isCompactViewport && mobileUnit ? mobileWidth : width,
    320
  );
  const configuredAdHeight = parseBannerDimension(
    isCompactViewport && mobileUnit ? mobileHeight : height,
    100
  );
  const adWidth =
    isCompactViewport && configuredAdWidth > 360 ? 320 : configuredAdWidth;
  const adHeight =
    isCompactViewport && configuredAdWidth > 360 ? 100 : configuredAdHeight;

  useEffect(() => {
    if (!selectedUnit || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    container.innerHTML = "";

    const adElement = document.createElement("ins");
    adElement.className = "kakao_ad_area";
    adElement.style.display = "none";
    adElement.setAttribute("data-ad-unit", selectedUnit);
    adElement.setAttribute("data-ad-width", String(adWidth));
    adElement.setAttribute("data-ad-height", String(adHeight));

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://t1.daumcdn.net/kas/static/ba.min.js";

    container.appendChild(adElement);
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [adHeight, adWidth, selectedUnit]);

  useEffect(() => {
    if (!selectedUnit) {
      return;
    }

    trackAnalyticsEvent("ad_impression", {
      provider: "adfit",
      targetLabel: selectedUnit,
    });
  }, [selectedUnit]);

  if (!selectedUnit) {
    return null;
  }

  const handleAdfitClick = () => {
    trackAnalyticsEvent("ad_click", {
      provider: "adfit",
      targetLabel: selectedUnit,
    });
  };

  return (
    <div className="w-full overflow-hidden" aria-label={label} onClickCapture={handleAdfitClick}>
      <div
        ref={containerRef}
        className="mx-auto overflow-hidden rounded-[16px] bg-[#faf7f8]"
        style={{
          width: `${adWidth}px`,
          maxWidth: "100%",
          height: `${adHeight}px`,
          maxHeight: `${adHeight}px`,
          contain: "layout paint",
        }}
      />
    </div>
  );
}

export function CoupangSlot({
  label,
  link = import.meta.env.VITE_COUPANG_PARTNERS_URL?.trim() ?? "",
  image = import.meta.env.VITE_COUPANG_BANNER_IMAGE_URL?.trim() ?? "",
  title = import.meta.env.VITE_COUPANG_BANNER_TITLE?.trim() ?? "추천 상품 보러가기",
  dynamicBannerId = import.meta.env.VITE_COUPANG_DYNAMIC_BANNER_ID?.trim() ?? "",
  dynamicBannerTemplate =
    import.meta.env.VITE_COUPANG_DYNAMIC_BANNER_TEMPLATE?.trim() ?? "carousel",
  dynamicBannerTrackingCode =
    import.meta.env.VITE_COUPANG_DYNAMIC_BANNER_TRACKING_CODE?.trim() ?? "",
  dynamicBannerWidth =
    import.meta.env.VITE_COUPANG_DYNAMIC_BANNER_WIDTH?.trim() ?? "680",
  dynamicBannerHeight =
    import.meta.env.VITE_COUPANG_DYNAMIC_BANNER_HEIGHT?.trim() ?? "140",
}: {
  label?: string;
  link?: string;
  image?: string;
  title?: string;
  dynamicBannerId?: string;
  dynamicBannerTemplate?: string;
  dynamicBannerTrackingCode?: string;
  dynamicBannerWidth?: string;
  dynamicBannerHeight?: string;
}) {
  const dynamicBannerRef = useRef<HTMLDivElement | null>(null);
  const [measuredBannerWidth, setMeasuredBannerWidth] = useState(0);
  const isCompactViewport = useCompactViewport();
  const hasDynamicBanner = Boolean(dynamicBannerId && dynamicBannerTrackingCode);
  const configuredBannerWidth = parseBannerDimension(dynamicBannerWidth, 680);
  const configuredBannerHeight = parseBannerDimension(dynamicBannerHeight, 140);
  const effectiveBannerHeight = isCompactViewport
    ? Math.min(configuredBannerHeight, 120)
    : configuredBannerHeight;
  const viewportFallbackWidth =
    isCompactViewport && typeof window !== "undefined"
      ? Math.max(300, Math.floor(window.innerWidth - 32))
      : configuredBannerWidth;
  const effectiveBannerWidth =
    measuredBannerWidth > 0 ? measuredBannerWidth : viewportFallbackWidth;

  useEffect(() => {
    if (!hasDynamicBanner || !dynamicBannerRef.current || typeof ResizeObserver === "undefined") {
      return;
    }

    const container = dynamicBannerRef.current;
    const updateWidth = () => {
      const nextWidth = Math.max(300, Math.floor(container.clientWidth));
      setMeasuredBannerWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [hasDynamicBanner]);

  const dynamicBannerSrcDoc = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: transparent;
      }
    </style>
  </head>
  <body>
    <script src="https://ads-partners.coupang.com/g.js"><\/script>
    <script>
      new PartnersCoupang.G(${JSON.stringify({
        id: dynamicBannerId,
        template: dynamicBannerTemplate,
        trackingCode: dynamicBannerTrackingCode,
        width: String(effectiveBannerWidth),
        height: String(effectiveBannerHeight),
      })});
    <\/script>
  </body>
</html>`;

  const shouldRenderDynamicBanner = hasDynamicBanner;
  const shouldRenderFallbackCard =
    Boolean(link) && !hasDynamicBanner;

  useEffect(() => {
    if (shouldRenderDynamicBanner) {
      trackAnalyticsEvent("ad_impression", {
        provider: "coupang",
        targetLabel: dynamicBannerId || "dynamic-banner",
      });
      return;
    }

    if (shouldRenderFallbackCard) {
      trackAnalyticsEvent("ad_impression", {
        provider: "coupang",
        targetLabel: title || link || "fallback-banner",
      });
    }
  }, [dynamicBannerId, link, shouldRenderDynamicBanner, shouldRenderFallbackCard, title]);

  if (!shouldRenderDynamicBanner && !shouldRenderFallbackCard) {
    return null;
  }

  if (shouldRenderDynamicBanner) {
    return (
      <SlotFrame label={label}>
        <div
          ref={dynamicBannerRef}
          className="overflow-hidden rounded-[18px] bg-[#fffafb]"
          style={{
            width: "100%",
            height: `${effectiveBannerHeight}px`,
            maxHeight: `${effectiveBannerHeight}px`,
            contain: "layout paint",
          }}
        >
          <iframe
            key={`${dynamicBannerId}-${dynamicBannerTemplate}-${dynamicBannerTrackingCode}-${effectiveBannerWidth}-${effectiveBannerHeight}`}
            title={label || "Coupang partner banner"}
            srcDoc={dynamicBannerSrcDoc}
            className="block h-full w-full border-0"
            loading="lazy"
            scrolling="no"
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
          />
        </div>
      </SlotFrame>
    );
  }

  return (
    <SlotFrame label={label}>
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={() => {
          trackAnalyticsEvent("ad_click", {
            provider: "coupang",
            targetLabel: title || link || "fallback-banner",
            href: link,
          });
        }}
        className="flex items-center gap-4 rounded-[18px] border border-[#f2ecec] bg-[#fffafb] p-4 no-underline transition hover:border-[#ffd1d7] hover:bg-[#fff5f7]"
      >
        {image ? (
          <img src={image} alt={title} className="h-16 w-16 rounded-2xl object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fff0f2] text-xs font-bold text-[#ff7b83]">
            AD
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#1e1e1e]">{title}</p>
          <p className="mt-1 text-xs text-[#8c8c8c]">제휴 링크가 포함되어 있어요.</p>
        </div>
      </a>
    </SlotFrame>
  );
}

export default function MonetizationSlot({
  label,
  provider = (import.meta.env.VITE_MONETIZATION_PROVIDER?.trim() ??
    "adsense") as MonetizationProvider,
}: {
  label?: string;
  provider?: MonetizationProvider;
}) {
  if (provider === "adsense") {
    return <AdsenseSlot label={label} />;
  }

  if (provider === "kakao") {
    return <KakaoAdfitSlot label={label} />;
  }

  if (provider === "coupang") {
    return <CoupangSlot label={label} />;
  }

  return null;
}
