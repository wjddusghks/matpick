function getHeader(req, name) {
  const value = req.headers?.[name] || req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value || "";
}

function getFallbackLocale(acceptLanguage) {
  return String(acceptLanguage || "").toLowerCase().startsWith("ko") ? "ko" : "en";
}

module.exports = function handler(req, res) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const country = String(getHeader(req, "x-vercel-ip-country") || "").toUpperCase();
  const region = String(getHeader(req, "x-vercel-ip-country-region") || "");
  const city = String(getHeader(req, "x-vercel-ip-city") || "");
  const acceptLanguage = String(getHeader(req, "accept-language") || "");
  const fallbackLocale = getFallbackLocale(acceptLanguage);
  const isOverseas = Boolean(country) && country !== "KR";
  const locale = isOverseas ? "en" : fallbackLocale;

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Vary", "X-Vercel-IP-Country, X-Vercel-IP-Country-Region, Accept-Language");

  return res.status(200).json({
    locale,
    country,
    region,
    city,
    isOverseas,
    acceptLanguage,
  });
};
