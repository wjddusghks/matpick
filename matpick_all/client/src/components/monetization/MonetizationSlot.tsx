import { useEffect, useRef, useState } from "react";

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
  unit = import.meta.env.VITE_KAKAO_ADFIT_UNIT?.trim() ?? "",
  width = import.meta.env.VITE_KAKAO_ADFIT_WIDTH?.trim() ?? "320",
  height = import.meta.env.VITE_KAKAO_ADFIT_HEIGHT?.trim() ?? "100",
}: {
  label?: string;
  unit?: string;
  width?: string;
  height?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!unit || !containerRef.current) {
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://t1.daumcdn.net/kas/static/ba.min.js";
    containerRef.current.appendChild(script);

    return () => {
      script.remove();
    };
  }, [unit, width, height]);

  if (!unit) {
    return null;
  }

  return (
    <div ref={containerRef} className="w-full">
      <ins
        className="kakao_ad_area"
        style={{ display: "none" }}
        data-ad-unit={unit}
        data-ad-width={width}
        data-ad-height={height}
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
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [dynamicBannerFailed, setDynamicBannerFailed] = useState(false);
  const hasDynamicBanner = Boolean(dynamicBannerId && dynamicBannerTrackingCode);
  const configuredBannerWidth = parseBannerDimension(dynamicBannerWidth, 680);
  const configuredBannerHeight = parseBannerDimension(dynamicBannerHeight, 140);
  const effectiveBannerWidth =
    measuredBannerWidth > 0 ? measuredBannerWidth : configuredBannerWidth;

  useEffect(() => {
    if (!hasDynamicBanner || !dynamicBannerRef.current || typeof ResizeObserver === "undefined") {
      return;
    }

    const container = dynamicBannerRef.current;
    const updateWidth = () => {
      const nextWidth = Math.max(280, Math.floor(container.clientWidth));
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

  useEffect(() => {
    if (!hasDynamicBanner || isCompactViewport || !dynamicBannerRef.current) {
      setDynamicBannerFailed(false);
      return;
    }

    const host = dynamicBannerRef.current;
    let cancelled = false;
    let renderCheckTimer: number | undefined;

    const markFailed = () => {
      if (!cancelled) {
        setDynamicBannerFailed(true);
      }
    };

    const checkBannerRendered = () => {
      if (cancelled) {
        return;
      }

      const renderedNode = host.querySelector(
        "iframe, img, a, [class*='coupang'], [id*='coupang']"
      );
      const hasVisibleContent =
        Boolean(renderedNode) || Boolean(host.textContent?.trim().length);

      if (!hasVisibleContent) {
        markFailed();
      }
    };

    const mountBanner = () => {
      if (cancelled) {
        return;
      }

      setDynamicBannerFailed(false);
      host.innerHTML = "";

      const inlineScript = document.createElement("script");
      inlineScript.async = true;
      inlineScript.text = `new PartnersCoupang.G(${JSON.stringify({
        id: dynamicBannerId,
        template: dynamicBannerTemplate,
        trackingCode: dynamicBannerTrackingCode,
        width: String(effectiveBannerWidth),
        height: String(configuredBannerHeight),
      })});`;

      host.appendChild(inlineScript);
      renderCheckTimer = window.setTimeout(checkBannerRendered, 2500);
    };

    host.innerHTML = "";

    if (window.PartnersCoupang?.G) {
      mountBanner();
    } else {
      const loaderScript = document.createElement("script");
      loaderScript.async = true;
      loaderScript.src = "https://ads-partners.coupang.com/g.js";
      loaderScript.onload = mountBanner;
      loaderScript.onerror = markFailed;
      host.appendChild(loaderScript);
    }

    return () => {
      cancelled = true;
      if (renderCheckTimer) {
        window.clearTimeout(renderCheckTimer);
      }
      host.innerHTML = "";
    };
  }, [
    configuredBannerHeight,
    dynamicBannerId,
    dynamicBannerTemplate,
    dynamicBannerTrackingCode,
    effectiveBannerWidth,
    hasDynamicBanner,
    isCompactViewport,
  ]);

  const shouldRenderDynamicBanner = hasDynamicBanner && !isCompactViewport && !dynamicBannerFailed;
  const shouldRenderFallbackCard =
    Boolean(link) && (!hasDynamicBanner || isCompactViewport || dynamicBannerFailed);

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
            minHeight: `${configuredBannerHeight}px`,
          }}
        />
      </SlotFrame>
    );
  }

  return (
    <SlotFrame label={label}>
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer sponsored"
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
