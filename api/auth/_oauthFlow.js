const { getExpectedOrigin } = require("../_requestGuards");
const { createOAuthTransaction } = require("./_sessionStore");

const PRODUCTION_ORIGIN = "https://matpick.co.kr";
const PRODUCTION_ORIGINS = new Set([
  PRODUCTION_ORIGIN,
  "https://www.matpick.co.kr",
]);

class OAuthConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "OAuthConfigurationError";
    this.status = 500;
  }
}

function parseOrigin(value, { allowHttp = false } = {}) {
  const configured = String(value || "").trim();
  if (!configured) return "";
  try {
    const url = new URL(configured);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      (!allowHttp && url.protocol !== "https:") ||
      (allowHttp && !["http:", "https:"].includes(url.protocol))
    ) {
      return "";
    }
    return url.origin;
  } catch {
    return "";
  }
}

function isCurrentPreviewOrigin(origin) {
  let host;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  return [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
    .filter(value => value && /^[a-z0-9.-]+\.vercel\.app$/i.test(value))
    .some(value => value.toLowerCase() === host.toLowerCase());
}

function getPublicOrigin(req) {
  const preview = process.env.VERCEL_ENV === "preview";
  const deployed =
    process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

  if (String(process.env.OAUTH_PUBLIC_ORIGIN || "").trim()) {
    const origin = parseOrigin(process.env.OAUTH_PUBLIC_ORIGIN);
    if (!origin) {
      throw new OAuthConfigurationError(
        "OAUTH_PUBLIC_ORIGIN must be an HTTPS origin without a path, credentials, query, or fragment.",
      );
    }
    if (preview && PRODUCTION_ORIGINS.has(origin)) {
      throw new OAuthConfigurationError(
        "Preview OAuth is not configured. Set OAUTH_PUBLIC_ORIGIN to the registered HTTPS preview origin.",
      );
    }
    return origin;
  }

  if (String(process.env.VITE_PUBLIC_APP_URL || "").trim()) {
    const origin = parseOrigin(process.env.VITE_PUBLIC_APP_URL, {
      allowHttp: !deployed,
    });
    if (!origin) {
      throw new OAuthConfigurationError(
        "VITE_PUBLIC_APP_URL must be a valid application origin.",
      );
    }
    if (preview && !isCurrentPreviewOrigin(origin)) {
      throw new OAuthConfigurationError(
        "Preview OAuth is not configured. Set OAUTH_PUBLIC_ORIGIN to the registered HTTPS preview origin.",
      );
    }
    return origin;
  }

  if (preview) {
    throw new OAuthConfigurationError(
      "Preview OAuth is not configured. Set OAUTH_PUBLIC_ORIGIN to the registered HTTPS preview origin.",
    );
  }
  if (deployed) return PRODUCTION_ORIGIN;
  return getExpectedOrigin(req);
}

async function beginOAuth(req, res, provider) {
  const origin = getPublicOrigin(req);
  if (!origin) return null;
  const redirectUri = `${origin}/auth/callback/${provider}`;
  const state = await createOAuthTransaction(res, { provider, redirectUri });
  const params = new URLSearchParams({
    response_type: "code",
    state,
    redirect_uri: redirectUri,
  });
  if (provider === "naver") {
    const clientId =
      process.env.NAVER_LOGIN_CLIENT_ID ||
      process.env.VITE_NAVER_LOGIN_CLIENT_ID;
    if (!clientId) return null;
    params.set("client_id", clientId);
    return `https://nid.naver.com/oauth2.0/authorize?${params}`;
  }
  const clientId =
    process.env.KAKAO_REST_API_KEY || process.env.VITE_KAKAO_REST_API_KEY;
  if (!clientId) return null;
  params.set("client_id", clientId);
  return `https://kauth.kakao.com/oauth/authorize?${params}`;
}

module.exports = {
  OAuthConfigurationError,
  beginOAuth,
  getPublicOrigin,
};
