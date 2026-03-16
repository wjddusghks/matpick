import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const ADSENSE_SCRIPT_ID = "matpick-adsense-sdk";
const KAKAO_ADFIT_SCRIPT_ID = "matpick-kakao-adfit-sdk";
const ADSENSE_READY_EVENT = "matpick:adsense-ready";

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

function upsertMeta(name: string, content: string) {
  if (typeof document === "undefined" || !content) {
    return;
  }

  let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    document.head.appendChild(meta);
  }

  meta.setAttribute("content", content);
}

export default function MonetizationScripts() {
  const provider = import.meta.env.VITE_MONETIZATION_PROVIDER?.trim() ?? "";
  const adsenseClient = import.meta.env.VITE_ADSENSE_CLIENT?.trim() ?? "";

  useEffect(() => {
    if (provider === "adsense" && adsenseClient) {
      upsertMeta("google-adsense-account", adsenseClient);
      ensureScript(
        ADSENSE_SCRIPT_ID,
        `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`,
        { crossorigin: "anonymous" }
      );

      const script = document.getElementById(ADSENSE_SCRIPT_ID);
      if (script?.getAttribute("data-ready") === "true") {
        window.dispatchEvent(new CustomEvent(ADSENSE_READY_EVENT));
        return;
      }

      if (Array.isArray(window.adsbygoogle)) {
        script?.setAttribute("data-ready", "true");
        window.dispatchEvent(new CustomEvent(ADSENSE_READY_EVENT));
        return;
      }

      const handleReady = () => {
        script?.setAttribute("data-ready", "true");
        window.dispatchEvent(new CustomEvent(ADSENSE_READY_EVENT));
      };

      script?.addEventListener("load", handleReady, { once: true });
      return () => script?.removeEventListener("load", handleReady);
    }

    if (provider === "kakao") {
      ensureScript(KAKAO_ADFIT_SCRIPT_ID, "//t1.daumcdn.net/kas/static/ba.min.js");
    }
  }, [adsenseClient, provider]);

  return null;
}
