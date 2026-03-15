import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import {
  beginOAuthLogin,
  clearSavedPostLoginRedirect,
  consumeOAuthState,
  getOAuthAvailability,
  getOAuthProviderLabel,
  getOAuthRedirectUri,
  isOAuthProvider,
  takeSavedPostLoginRedirect,
  type OAuthProvider,
} from "@/lib/oauth";

export interface User {
  id: string;
  name: string;
  email?: string;
  profileImage?: string;
  provider: OAuthProvider;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  isAuthenticating: boolean;
  oauthEnabled: Record<OAuthProvider, boolean>;
  loginWithKakao: (redirectTo?: string) => void;
  loginWithNaver: (redirectTo?: string) => void;
  finishOAuthLogin: (
    provider: string,
    searchParams: URLSearchParams
  ) => Promise<string>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "matpick_auth_user";

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function persistUser(user: User | null) {
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    return;
  }

  localStorage.removeItem(AUTH_STORAGE_KEY);
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    if (payload?.error) {
      return payload.error;
    }
  } catch {
    // Ignore JSON parsing failures and fall back to a generic message.
  }

  return "로그인 처리 중 문제가 발생했습니다.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadStoredUser);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const oauthEnabled = getOAuthAvailability();

  const startProviderLogin = useCallback(
    (provider: OAuthProvider, redirectTo = "/") => {
      beginOAuthLogin(provider, redirectTo);
    },
    []
  );

  const loginWithKakao = useCallback(
    (redirectTo = "/") => startProviderLogin("kakao", redirectTo),
    [startProviderLogin]
  );

  const loginWithNaver = useCallback(
    (redirectTo = "/") => startProviderLogin("naver", redirectTo),
    [startProviderLogin]
  );

  const finishOAuthLogin = useCallback(
    async (providerValue: string, searchParams: URLSearchParams) => {
      if (!isOAuthProvider(providerValue)) {
        throw new Error("지원하지 않는 로그인 공급자입니다.");
      }

      const provider = providerValue;
      const label = getOAuthProviderLabel(provider);
      const error = searchParams.get("error");
      const errorDescription =
        searchParams.get("error_description") || searchParams.get("error_reason");

      if (error) {
        clearSavedPostLoginRedirect();
        throw new Error(errorDescription || `${label} 로그인에 실패했습니다.`);
      }

      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const savedState = consumeOAuthState(provider);

      if (!code || !state || !savedState || savedState !== state) {
        clearSavedPostLoginRedirect();
        throw new Error("로그인 요청이 만료되었거나 보안 검증에 실패했습니다.");
      }

      setIsAuthenticating(true);

      try {
        const response = await fetch(`/api/auth/${provider}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code,
            state,
            redirectUri: getOAuthRedirectUri(provider),
          }),
        });

        if (!response.ok) {
          throw new Error(await readErrorMessage(response));
        }

        const payload = (await response.json()) as { user?: User };
        if (!payload.user) {
          throw new Error(`${label} 사용자 정보를 불러오지 못했습니다.`);
        }

        setUser(payload.user);
        persistUser(payload.user);

        return takeSavedPostLoginRedirect() || "/";
      } finally {
        setIsAuthenticating(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    persistUser(null);
    clearSavedPostLoginRedirect();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isAuthenticating,
        oauthEnabled,
        loginWithKakao,
        loginWithNaver,
        finishOAuthLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return ctx;
}
