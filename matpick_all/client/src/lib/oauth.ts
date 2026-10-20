export type OAuthProvider = "kakao" | "naver";

const POST_LOGIN_REDIRECT_KEY = "matpick_post_login_redirect";

const OAUTH_PROVIDER_LABELS: Record<OAuthProvider, string> = {
  kakao: "카카오",
  naver: "네이버",
};

function getClientId(provider: OAuthProvider) {
  return provider === "kakao"
    ? import.meta.env.VITE_KAKAO_REST_API_KEY?.trim()
    : import.meta.env.VITE_NAVER_LOGIN_CLIENT_ID?.trim();
}

export function getOAuthAvailability(): Record<OAuthProvider, boolean> {
  return {
    kakao: Boolean(getClientId("kakao")),
    naver: Boolean(getClientId("naver")),
  };
}

export function isOAuthProvider(value: string): value is OAuthProvider {
  return value === "kakao" || value === "naver";
}

export function getOAuthProviderLabel(provider: OAuthProvider) {
  return OAUTH_PROVIDER_LABELS[provider];
}

export async function beginOAuthLogin(
  provider: OAuthProvider,
  redirectTo = "/"
) {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, redirectTo);
  const response = await fetch(`/api/auth/${provider}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ action: "start" }),
  });
  const payload = (await response.json()) as {
    authorizeUrl?: string;
    error?: string;
  };
  if (!response.ok || !payload.authorizeUrl) {
    throw new Error(
      payload.error ||
        `${getOAuthProviderLabel(provider)} 로그인을 시작하지 못했습니다.`
    );
  }
  window.location.assign(payload.authorizeUrl);
}

export function takeSavedPostLoginRedirect() {
  const value = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
  sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  return value;
}

export function clearSavedPostLoginRedirect() {
  sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
}
