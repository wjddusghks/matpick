import { useEffect } from "react";

type SeoInput = {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: "website" | "article" | "profile";
  robots?: string;
  locale?: "ko" | "en";
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
};

const DEFAULT_SITE_URL = "https://matpick.co.kr";
const DEFAULT_OG_IMAGE = "/og-default.png";
const SITE_NAME = "맛픽";

function getSiteUrl() {
  return import.meta.env.VITE_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || DEFAULT_SITE_URL;
}

function makeAbsoluteUrl(path = "/") {
  const siteUrl = getSiteUrl();
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:") ||
    path.startsWith("blob:")
  ) {
    return path;
  }

  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function upsertMeta(name: string, content: string, attr: "name" | "property" = "name") {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attr, name);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

function removeMeta(name: string, attr: "name" | "property" = "name") {
  document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`)?.remove();
}

function upsertJsonLd(jsonLd: SeoInput["jsonLd"]) {
  const existing = document.head.querySelector<HTMLScriptElement>('script[data-matpick-seo="jsonld"]');
  if (!jsonLd) {
    existing?.remove();
    return;
  }

  const script = existing ?? document.createElement("script");
  script.type = "application/ld+json";
  script.dataset.matpickSeo = "jsonld";
  script.textContent = JSON.stringify(jsonLd);

  if (!existing) {
    document.head.appendChild(script);
  }
}

export function useSeo({
  title,
  description,
  path = "/",
  image = DEFAULT_OG_IMAGE,
  type = "website",
  robots = "index,follow",
  locale = "ko",
  jsonLd,
}: SeoInput) {
  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    const canonical = makeAbsoluteUrl(path);
    const imageUrl = makeAbsoluteUrl(image);
    const htmlLang = locale === "en" ? "en" : "ko";
    const ogLocale = locale === "en" ? "en_US" : "ko_KR";
    const alternateOgLocale = locale === "en" ? "ko_KR" : "en_US";

    document.title = fullTitle;
    document.documentElement.lang = htmlLang;
    upsertMeta("description", description);
    upsertMeta("language", htmlLang);
    upsertMeta("robots", robots);
    upsertMeta("og:locale", ogLocale, "property");
    upsertMeta("og:locale:alternate", alternateOgLocale, "property");
    upsertMeta("og:site_name", SITE_NAME, "property");
    upsertMeta("og:type", type, "property");
    upsertMeta("og:title", fullTitle, "property");
    upsertMeta("og:description", description, "property");
    upsertMeta("og:url", canonical, "property");
    upsertMeta("og:image", imageUrl, "property");
    upsertMeta("twitter:card", "summary_large_image");
    upsertMeta("twitter:title", fullTitle);
    upsertMeta("twitter:description", description);
    upsertMeta("twitter:image", imageUrl);
    upsertLink("canonical", canonical);
    upsertJsonLd(jsonLd);
    return () => {
      if (!jsonLd) {
        upsertJsonLd(undefined);
      }
      if (!description) {
        removeMeta("description");
      }
    };
  }, [description, image, jsonLd, locale, path, robots, title, type]);
}

export function buildAbsoluteUrl(path?: string) {
  return makeAbsoluteUrl(path);
}
