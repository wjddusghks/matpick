import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const ADSENSE_SCRIPT_ID = "matpick-adsense-sdk";
const KAKAO_ADFIT_SCRIPT_ID = "matpick-kakao-adfit-sdk";

function ensureScript(id: string, src: string, attributes: Record<string, string> = {}) {
  if (typeof document === "undefined") {
    return;
  }

  const existing = document.getElementById(id);
  if (existing) {
    return;
  }

  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;

  Object.entries(attributes).forEach(([key, value]) => {
    script.setAttribute(key, value);
  });

  document.head.appendChild(script);
}

export default function MonetizationScripts() {
  const provider = import.meta.env.VITE_MONETIZATION_PROVIDER?.trim() ?? "";
  const adsenseClient = import.meta.env.VITE_ADSENSE_CLIENT?.trim() ?? "";

  useEffect(() => {
    if (provider === "adsense" && adsenseClient) {
      ensureScript(
        ADSENSE_SCRIPT_ID,
        `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`,
        { crossorigin: "anonymous" }
      );
    }

    if (provider === "kakao") {
      ensureScript(KAKAO_ADFIT_SCRIPT_ID, "//t1.daumcdn.net/kas/static/ba.min.js");
    }
  }, [adsenseClient, provider]);

  return null;
}
