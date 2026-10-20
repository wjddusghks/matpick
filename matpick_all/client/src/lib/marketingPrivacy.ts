/** Never send account/admin pages, OAuth codes, or arbitrary query values to ad vendors. */
export function isPrivateMarketingPath(path: string) {
  const pathname = path.split(/[?#]/, 1)[0];
  return /^\/(?:auth|admin|my)(?:\/|$)/i.test(pathname);
}

export function safeMarketingLocation(href: string) {
  const url = new URL(href, "https://matpick.co.kr");
  if (isPrivateMarketingPath(url.pathname)) return null;
  const safe = new URL(url.pathname, url.origin);
  const language = url.searchParams.get("lang");
  if (language === "ko" || language === "en") safe.searchParams.set("lang", language);
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
    const value = url.searchParams.get(key);
    if (value && /^[a-z0-9_-]{1,80}$/.test(value)) safe.searchParams.set(key, value);
  }
  return { page_path: safe.pathname, page_location: safe.href };
}
