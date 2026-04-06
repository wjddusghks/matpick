export type OAuthProvider = "kakao" | "naver";

const OAUTH_STATE_STORAGE_KEY = "matpick_oauth_states";
const POST_LOGIN_REDIRECT_KEY = "matpick_post_login_redirect";

const OAUTH_PROVIDER_LABELS: Record<OAuthProvider, string> = {
  kakao: "카카오",
  naver: "네이버",
};

type OAuthStateMap = Partial<Record<OAuthProvider, string>>;

function createRandomState() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }

  return `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function readStoredStates(): OAuthStateMap {
  try {
    const raw = localStorage.getItem(OAUTH_STATE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OAuthStateMap) : {};
  } catch {
    return {};
  }
}

function writeStoredStates(states: OAuthStateMap) {
  localStorage.setItem(OAUTH_STATE_STORAGE_KEY, JSON.stringify(states));
}

function getClientId(provider: OAuthProvider) {
  return provider === "kakao"
    ? import.meta.env.VITE_KAKAO_REST_API_KEY?.trim()
    : import.meta.env.VITE_NAVER_LOGIN_CLIENT_ID?.trim();
}

function getBaseAppUrl() {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin;
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

export function getOAuthRedirectUri(provider: OAuthProvider) {
  return `${getBaseAppUrl()}/auth/callback/${provider}`;
}

function buildAuthorizeUrl(provider: OAuthProvider, state: string) {
  const clientId = getClientId(provider);
  if (!clientId) {
    throw new Error(`${getOAuthProviderLabel(provider)} 로그인이 아직 설정되지 않았습니다.`);
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: getOAuthRedirectUri(provider),
    state,
  });

  if (provider === "kakao") {
    return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
  }

  return `https://nid.naver.com/oauth2.0/authorize?${params.toString()}`;
}

export function beginOAuthLogin(provider: OAuthProvider, redirectTo = "/") {
  if (typeof window === "undefined") {
    return;
  }

  const state = createRandomState();
  const states = readStoredStates();
  states[provider] = state;
  writeStoredStates(states);
  localStorage.setItem(POST_LOGIN_REDIRECT_KEY, redirectTo);

  window.location.assign(buildAuthorizeUrl(provider, state));
}

export function consumeOAuthState(provider: OAuthProvider) {
  const states = readStoredStates();
  const value = states[provider] ?? null;
  delete states[provider];
  writeStoredStates(states);
  return value;
}

export function takeSavedPostLoginRedirect() {
  const value = localStorage.getItem(POST_LOGIN_REDIRECT_KEY);
  localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  return value;
}

export function clearSavedPostLoginRedirect() {
  localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
}
