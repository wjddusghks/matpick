function getHeader(req, name) {
  const value = req.headers?.[name] || req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value || "";
}

function getRequestProtocol(req) {
  return String(getHeader(req, "x-forwarded-proto") || "https").split(",")[0].trim();
}

function getRequestHost(req) {
  return String(
    getHeader(req, "x-forwarded-host") || getHeader(req, "host") || ""
  )
    .split(",")[0]
    .trim();
}

function getRequestOrigin(req) {
  return String(getHeader(req, "origin") || "").trim();
}

function getExpectedOrigin(req) {
  const host = getRequestHost(req);
  if (!host) {
    return "";
  }

  return `${getRequestProtocol(req)}://${host}`;
}

function getAllowedOrigins(req) {
  const configured = String(process.env.VITE_PUBLIC_APP_URL || "")
    .trim()
    .replace(/\/$/, "");
  const expected = getExpectedOrigin(req);
  const origins = new Set();

  if (configured) {
    origins.add(configured);
  }

  if (expected) {
    origins.add(expected);
  }

  return origins;
}

function applyApiSecurityHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
}

function enforceSameOrigin(req, res) {
  const origin = getRequestOrigin(req);
  const secFetchSite = String(getHeader(req, "sec-fetch-site") || "").trim();
  const allowedOrigins = getAllowedOrigins(req);

  if (!origin) {
    if (secFetchSite && !["same-origin", "same-site", "none"].includes(secFetchSite)) {
      res.status(403).json({ error: "Cross-site requests are not allowed." });
      return false;
    }

    return true;
  }

  if (!allowedOrigins.has(origin)) {
    res.status(403).json({ error: "Request origin is not allowed." });
    return false;
  }

  return true;
}

module.exports = {
  applyApiSecurityHeaders,
  enforceSameOrigin,
  getExpectedOrigin,
  getRequestOrigin,
};
