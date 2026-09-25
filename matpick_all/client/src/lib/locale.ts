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
  미분류: "Unclassified",
  "카페·디저트": "Cafe & dessert",
};

export function getBrowserFallbackLocale(): AppLocale {
  // Canonical pages stay Korean for first-time visitors and search engines.
  // An explicit visitor choice, rather than IP/browser language, enables English.
  try {
    return window.localStorage.getItem("matpick_locale") === "en" ? "en" : "ko";
  } catch {
    return "ko";
  }
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
