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

function normalizeOrigin(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.origin;
  } catch {
    return "";
  }
}

function getExpectedOrigin(req) {
  const host = getRequestHost(req);
  if (!host) {
    return "";
  }

  return `${getRequestProtocol(req)}://${host}`;
}

function getAllowedOrigins(req) {
  const configured = normalizeOrigin(process.env.VITE_PUBLIC_APP_URL);
  const additional = String(process.env.APP_ALLOWED_ORIGINS || "")
    .split(/[\s,]+/)
    .map(normalizeOrigin)
    .filter(Boolean);
  const expected = getExpectedOrigin(req);
  const origins = new Set();

  if (configured) {
    origins.add(configured);
  }

  additional.forEach((origin) => origins.add(origin));

  if (expected && (!configured || process.env.VERCEL_ENV !== "production")) {
    origins.add(expected);
  }

  return origins;
}

class RequestPayloadError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "RequestPayloadError";
    this.statusCode = statusCode;
  }
}

function getRequestBodyByteLength(req) {
  if (req.body == null) return 0;
  if (Buffer.isBuffer(req.body)) return req.body.byteLength;
  if (typeof req.body === "string") return Buffer.byteLength(req.body, "utf8");

  try {
    return Buffer.byteLength(JSON.stringify(req.body), "utf8");
  } catch {
    throw new RequestPayloadError("Invalid request payload.");
  }
}

function enforceRequestBodySize(req, res, maxBytes) {
  const declaredLength = Number(getHeader(req, "content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    res.status(413).json({ error: "Request payload is too large." });
    return false;
  }

  try {
    if (getRequestBodyByteLength(req) > maxBytes) {
      res.status(413).json({ error: "Request payload is too large." });
      return false;
    }
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message });
    return false;
  }

  return true;
}

function readJsonBody(req, options = {}) {
  const maxBytes = Math.max(256, Number(options.maxBytes) || 64_000);
  const contentType = String(getHeader(req, "content-type") || "").toLowerCase();
  if (contentType && !contentType.includes("application/json")) {
    throw new RequestPayloadError("Content-Type must be application/json.", 415);
  }

  if (getRequestBodyByteLength(req) > maxBytes) {
    throw new RequestPayloadError("Request payload is too large.", 413);
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      throw new RequestPayloadError("Malformed JSON request payload.");
    }
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RequestPayloadError("A JSON object payload is required.");
  }

  return body;
}

function isSafeIdentifier(value, maxLength = 160) {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= maxLength &&
    /^[a-zA-Z0-9_:-]+$/.test(value)
  );
}

function isAllowedRedirectUri(req, value, expectedPath) {
  try {
    const url = new URL(String(value || ""));
    if (url.username || url.password || url.hash || url.search) return false;
    if (!getAllowedOrigins(req).has(url.origin)) return false;
    if (expectedPath && url.pathname !== expectedPath) return false;
    return url.protocol === "https:" || ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
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
  RequestPayloadError,
  applyApiSecurityHeaders,
  enforceRequestBodySize,
  enforceSameOrigin,
  getExpectedOrigin,
  getRequestOrigin,
  isAllowedRedirectUri,
  isSafeIdentifier,
  readJsonBody,
};
