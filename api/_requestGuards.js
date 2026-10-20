function getHeader(req, name) {
  const value = req.headers?.[name] || req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value || "";
}

function getRequestProtocol(req) {
  return String(getHeader(req, "x-forwarded-proto") || "https").split(",")[0].trim();
}

function getRequestHost(req) {
  // Do not let an arbitrary forwarding header expand the origin allowlist.
  return String(getHeader(req, "host") || "")
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

function getConfiguredHttpsOrigin(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    ) {
      return "";
    }
    return url.origin;
  } catch {
    return "";
  }
}

function getAllowedOrigins(req) {
  const configured = String(process.env.VITE_PUBLIC_APP_URL || "")
    .trim()
    .replace(/\/$/, "");
  const expected = getExpectedOrigin(req);
  const origins = new Set();

  if (configured) origins.add(configured);
  const oauthOrigin = getConfiguredHttpsOrigin(process.env.OAUTH_PUBLIC_ORIGIN);
  if (oauthOrigin) origins.add(oauthOrigin);
  if (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") {
    origins.add("https://matpick.co.kr");
    origins.add("https://www.matpick.co.kr");
    // Only deployment names supplied by the platform, never request headers.
    for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) {
      if (host && /^[a-z0-9.-]+\.vercel\.app$/i.test(host)) origins.add(`https://${host}`);
    }
  } else if (expected) origins.add(expected);

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
    if (secFetchSite && !["same-origin", "none"].includes(secFetchSite)) {
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

function enforceBrowserRequest(req, res) {
  if (!enforceSameOrigin(req, res)) {
    return false;
  }

  const fetchSite = String(getHeader(req, "sec-fetch-site") || "")
    .trim()
    .toLowerCase();
  if (fetchSite === "same-origin") {
    return true;
  }

  const referer = String(getHeader(req, "referer") || "").trim();
  const allowedOrigins = getAllowedOrigins(req);
  try {
    if (referer && allowedOrigins.has(new URL(referer).origin)) {
      return true;
    }
  } catch {
    // Invalid referrers are rejected below.
  }

  res.status(403).json({ error: "This endpoint is only available from Matpick pages." });
  return false;
}

module.exports = {
  applyApiSecurityHeaders,
  enforceBrowserRequest,
  enforceSameOrigin,
  getExpectedOrigin,
  getRequestOrigin,
};
