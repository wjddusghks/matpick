import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getBrowserFallbackLocale,
  isEnglishLocale,
  type AppLocale,
} from "@/lib/locale";

type RuntimeLocalePayload = {
  locale?: AppLocale;
  country?: string;
  region?: string;
  city?: string;
  isOverseas?: boolean;
};

type LocaleContextValue = {
  locale: AppLocale;
  country: string;
  region: string;
  city: string;
  isEnglish: boolean;
  isOverseas: boolean;
  isReady: boolean;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: "ko",
  country: "",
  region: "",
  city: "",
  isEnglish: false,
  isOverseas: false,
  isReady: false,
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>(getBrowserFallbackLocale);
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [isOverseas, setIsOverseas] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function hydrateRuntimeContext() {
      try {
        const response = await fetch("/api/runtime-context", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Failed to read runtime locale");
        }

        const payload = (await response.json()) as RuntimeLocalePayload;

        if (ignore) {
          return;
        }

        const nextLocale = payload.locale === "en" ? "en" : "ko";
        setLocale(nextLocale);
        setCountry(String(payload.country || ""));
        setRegion(String(payload.region || ""));
        setCity(String(payload.city || ""));
        setIsOverseas(Boolean(payload.isOverseas));
      } catch {
        if (!ignore) {
          setLocale(getBrowserFallbackLocale());
        }
      } finally {
        if (!ignore) {
          setIsReady(true);
        }
      }
    }

    void hydrateRuntimeContext();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.lang = locale === "en" ? "en" : "ko";
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      country,
      region,
      city,
      isEnglish: isEnglishLocale(locale),
      isOverseas,
      isReady,
    }),
    [city, country, isOverseas, isReady, locale, region]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
