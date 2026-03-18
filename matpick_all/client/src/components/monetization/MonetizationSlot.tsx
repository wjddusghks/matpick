import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
    PartnersCoupang?: {
      G: new (config: {
        id: string | number;
        template: string;
        trackingCode: string;
        width: string;
        height: string;
      }) => unknown;
    };
  }
}

export type MonetizationProvider = "adsense" | "kakao" | "coupang";

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
  const hasDynamicBanner = Boolean(dynamicBannerId && dynamicBannerTrackingCode);

  useEffect(() => {
    if (!hasDynamicBanner || !dynamicBannerRef.current) {
      return;
    }

    const container = dynamicBannerRef.current;
    container.innerHTML = "";

    const sdkScript = document.createElement("script");
    sdkScript.src = "https://ads-partners.coupang.com/g.js";
    sdkScript.async = true;

    const inlineScript = document.createElement("script");
    inlineScript.text = `
      new PartnersCoupang.G({
        id: ${JSON.stringify(dynamicBannerId)},
        template: ${JSON.stringify(dynamicBannerTemplate)},
        trackingCode: ${JSON.stringify(dynamicBannerTrackingCode)},
        width: ${JSON.stringify(dynamicBannerWidth)},
        height: ${JSON.stringify(dynamicBannerHeight)}
      });
    `;

    sdkScript.onload = () => {
      container.appendChild(inlineScript);
    };

    container.appendChild(sdkScript);

    return () => {
      container.innerHTML = "";
    };
  }, [
    dynamicBannerHeight,
    dynamicBannerId,
    dynamicBannerTemplate,
    dynamicBannerTrackingCode,
    dynamicBannerWidth,
    hasDynamicBanner,
  ]);

  if (!hasDynamicBanner && !link) {
    return null;
  }

  if (hasDynamicBanner) {
    return (
      <SlotFrame label={label}>
        <div
          ref={dynamicBannerRef}
          className="overflow-hidden rounded-[18px] bg-[#fffafb]"
          style={{
            width: "100%",
            minHeight: `${dynamicBannerHeight}px`,
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
