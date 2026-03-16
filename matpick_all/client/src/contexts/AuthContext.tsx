import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import {
  clearSavedPostLoginRedirect,
  consumeOAuthState,
  getOAuthAvailability,
  getOAuthProviderLabel,
  getOAuthRedirectUri,
  isOAuthProvider,
  takeSavedPostLoginRedirect,
  beginOAuthLogin,
  type OAuthProvider,
} from "@/lib/oauth";
import {
  hasCompletedProfile,
  mergeUserProfile,
  saveStoredAuthProfile,
  sanitizeNickname,
} from "@/lib/authProfile";
import { persistRemoteAuthProfile } from "@/lib/authProfileSync";
import { toast } from "sonner";

export interface User {
  id: string;
  name: string;
  nickname?: string;
  email?: string;
  profileImage?: string;
  provider: OAuthProvider;
  consentAcceptedAt?: number;
  allowLocationPersonalization?: boolean;
  syncToken?: string;
}

interface CompleteUserProfileInput {
  nickname: string;
  allowLocationPersonalization: boolean;
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
  completeUserProfile: (input: CompleteUserProfileInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "matpick_auth_user";

function loadStoredUser(): User | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return mergeUserProfile(JSON.parse(raw) as User);
  } catch {
    return null;
  }
}

function persistUser(user: User | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (user) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
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
        throw new Error("지원하지 않는 로그인 제공자입니다.");
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

        const mergedUser = mergeUserProfile(payload.user);
        const isExistingMember = hasCompletedProfile(mergedUser);

        if (isExistingMember) {
          try {
            await persistRemoteAuthProfile(mergedUser.id, mergedUser.syncToken, {
              nickname: mergedUser.nickname?.trim() || mergedUser.name.trim(),
              consentAcceptedAt: mergedUser.consentAcceptedAt ?? Date.now(),
              allowLocationPersonalization: Boolean(
                mergedUser.allowLocationPersonalization
              ),
            });
          } catch {
            // Keep login flow successful even when the remote profile store is unavailable.
          }
        }

        setUser(mergedUser);
        persistUser(mergedUser);

        if (isExistingMember) {
          toast.message("이미 가입한 계정입니다. 기존 회원 정보로 로그인했습니다.");
        }

        return takeSavedPostLoginRedirect() || "/";
      } finally {
        setIsAuthenticating(false);
      }
    },
    []
  );

  const completeUserProfile = useCallback(
    async ({ nickname, allowLocationPersonalization }: CompleteUserProfileInput) => {
      if (!user) {
        return;
      }

      const nextNickname = sanitizeNickname(nickname);
      if (!nextNickname) {
        throw new Error("닉네임을 입력해 주세요.");
      }

      const consentAcceptedAt = user.consentAcceptedAt ?? Date.now();
      const nextUser: User = {
        ...user,
        nickname: nextNickname,
        consentAcceptedAt,
        allowLocationPersonalization,
      };

      saveStoredAuthProfile(user.id, {
        nickname: nextNickname,
        consentAcceptedAt,
        allowLocationPersonalization,
      });

      try {
        await persistRemoteAuthProfile(user.id, user.syncToken, {
          nickname: nextNickname,
          consentAcceptedAt,
          allowLocationPersonalization,
        });
      } catch {
        // Keep the local profile even when remote sync is unavailable.
      }

      setUser(nextUser);
      persistUser(nextUser);
    },
    [user]
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
        completeUserProfile,
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
