export type AppLocale = "ko" | "en";

const cuisineTranslations: Record<string, string> = {
  한식: "Korean",
  중식: "Chinese",
  일식: "Japanese",
  양식: "Western",
  멕시칸: "Mexican",
  인도: "Indian",
  태국: "Thai",
  베트남: "Vietnamese",
};

export function getBrowserFallbackLocale(): AppLocale {
  if (typeof navigator === "undefined") {
    return "ko";
  }

  return navigator.language.toLowerCase().startsWith("ko") ? "ko" : "en";
}

export function isEnglishLocale(locale: AppLocale) {
  return locale === "en";
}

export function translateCuisineLabel(label: string, locale: AppLocale) {
  if (locale === "ko") {
    return label;
  }

  return cuisineTranslations[label] ?? label;
}

export function getLocaleMeta(locale: AppLocale) {
  return locale === "en"
    ? {
        htmlLang: "en",
        ogLocale: "en_US",
        alternateOgLocale: "ko_KR",
      }
    : {
        htmlLang: "ko",
        ogLocale: "ko_KR",
        alternateOgLocale: "en_US",
      };
}
