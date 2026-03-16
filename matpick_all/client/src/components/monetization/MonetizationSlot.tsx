import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

function AdsenseSlot({ label }: { label?: string }) {
  const insRef = useRef<HTMLModElement | null>(null);
  const client = import.meta.env.VITE_ADSENSE_CLIENT?.trim() ?? "";
  const slot = import.meta.env.VITE_ADSENSE_SLOT_INLINE?.trim() ?? "";

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
    <div className="rounded-[24px] border border-[#efe5e6] bg-white p-4 shadow-[0_10px_32px_rgba(0,0,0,0.04)]">
      {label ? (
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1a6a7]">
          {label}
        </p>
      ) : null}
      <ins
        ref={insRef}
        className="adsbygoogle block min-h-[120px] overflow-hidden rounded-[18px] bg-[#faf7f8]"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

function KakaoAdfitSlot({ label }: { label?: string }) {
  const unit = import.meta.env.VITE_KAKAO_ADFIT_UNIT?.trim() ?? "";
  const width = import.meta.env.VITE_KAKAO_ADFIT_WIDTH?.trim() ?? "320";
  const height = import.meta.env.VITE_KAKAO_ADFIT_HEIGHT?.trim() ?? "100";

  if (!unit) {
    return null;
  }

  return (
    <div className="rounded-[24px] border border-[#efe5e6] bg-white p-4 shadow-[0_10px_32px_rgba(0,0,0,0.04)]">
      {label ? (
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1a6a7]">
          {label}
        </p>
      ) : null}
      <ins
        className="kakao_ad_area block overflow-hidden rounded-[18px] bg-[#faf7f8]"
        style={{ display: "none" }}
        data-ad-unit={unit}
        data-ad-width={width}
        data-ad-height={height}
      />
    </div>
  );
}

function CoupangSlot({ label }: { label?: string }) {
  const link = import.meta.env.VITE_COUPANG_PARTNERS_URL?.trim() ?? "";
  const image = import.meta.env.VITE_COUPANG_BANNER_IMAGE_URL?.trim() ?? "";
  const title = import.meta.env.VITE_COUPANG_BANNER_TITLE?.trim() ?? "추천 상품 보러가기";

  if (!link) {
    return null;
  }

  return (
    <div className="rounded-[24px] border border-[#efe5e6] bg-white p-4 shadow-[0_10px_32px_rgba(0,0,0,0.04)]">
      {label ? (
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1a6a7]">
          {label}
        </p>
      ) : null}
      <a
        href={link}
        target="_blank"
        rel="noreferrer sponsored"
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
    </div>
  );
}

export default function MonetizationSlot({ label }: { label?: string }) {
  const provider = import.meta.env.VITE_MONETIZATION_PROVIDER?.trim() ?? "";

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
