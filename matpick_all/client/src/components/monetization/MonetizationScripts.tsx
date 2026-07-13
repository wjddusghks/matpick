import { useEffect } from "react";
import { useState } from "react";
import {
  PRIVACY_PREFERENCES_EVENT,
  hasAdvertisingConsent,
  type PrivacyPreferences,
} from "@/lib/privacyConsent";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const ADSENSE_SCRIPT_ID = "matpick-adsense-sdk";
const ADSENSE_READY_EVENT = "matpick:adsense-ready";

function ensureScript(
  id: string,
  src: string,
  attributes: Record<string, string> = {}
) {
  if (typeof document === "undefined") {
    return null;
  }

  const existing =
    document.getElementById(id) ||
    Array.from(document.scripts).find((script) => script.src === src);
  if (existing) {
    if (!existing.id) {
      existing.id = id;
    }
    return existing;
  }

  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;

  Object.entries(attributes).forEach(([key, value]) => {
    script.setAttribute(key, value);
  });

  document.head.appendChild(script);
  return script;
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
  const adsenseClient = import.meta.env.VITE_ADSENSE_CLIENT?.trim() ?? "";
  const [advertisingAllowed, setAdvertisingAllowed] = useState(hasAdvertisingConsent);

  useEffect(() => {
    const handlePreferences = (event: Event) => {
      const preferences = (event as CustomEvent<PrivacyPreferences>).detail;
      setAdvertisingAllowed(preferences?.advertising === true);
    };

    window.addEventListener(PRIVACY_PREFERENCES_EVENT, handlePreferences as EventListener);
    return () =>
      window.removeEventListener(PRIVACY_PREFERENCES_EVENT, handlePreferences as EventListener);
  }, []);

  useEffect(() => {
    if (!adsenseClient) {
      return;
    }

    upsertMeta("google-adsense-account", adsenseClient);
    if (!advertisingAllowed) {
      return;
    }

    const script = ensureScript(
      ADSENSE_SCRIPT_ID,
      `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`,
      { crossorigin: "anonymous" }
    );

    if (!script) {
      return;
    }

    if (script.getAttribute("data-ready") === "true") {
      window.dispatchEvent(new CustomEvent(ADSENSE_READY_EVENT));
      return;
    }

    if (Array.isArray(window.adsbygoogle)) {
      script.setAttribute("data-ready", "true");
      window.dispatchEvent(new CustomEvent(ADSENSE_READY_EVENT));
      return;
    }

    const handleReady = () => {
      script.setAttribute("data-ready", "true");
      window.dispatchEvent(new CustomEvent(ADSENSE_READY_EVENT));
    };

    script.addEventListener("load", handleReady, { once: true });
    return () => script.removeEventListener("load", handleReady);
  }, [adsenseClient, advertisingAllowed]);

  return null;
}
