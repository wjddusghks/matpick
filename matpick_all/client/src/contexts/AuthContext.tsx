import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  clearSavedPostLoginRedirect,
  getOAuthAvailability,
  getOAuthProviderLabel,
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
import type { AgeProfile } from "@/lib/reviewAge";

export interface User {
  id: string;
  name: string;
  nickname?: string;
  email?: string;
  profileImage?: string;
  provider: OAuthProvider;
  consentAcceptedAt?: number;
  allowLocationPersonalization?: boolean;
  ageProfile?: AgeProfile | null;
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
  loginWithKakao: (redirectTo?: string) => Promise<void>;
  loginWithNaver: (redirectTo?: string) => Promise<void>;
  finishOAuthLogin: (
    provider: string,
    searchParams: URLSearchParams
  ) => Promise<string>;
  completeUserProfile: (input: CompleteUserProfileInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "matpick_auth_user";

function persistUserIdentity(user: User | null) {
  if (user)
    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ id: user.id })
    );
  else window.localStorage.removeItem(AUTH_STORAGE_KEY);
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
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const oauthEnabled = getOAuthAvailability();

  const startProviderLogin = useCallback(
    (provider: OAuthProvider, redirectTo = "/") => {
      setIsAuthenticating(true);
      return beginOAuthLogin(provider, redirectTo).catch(error => {
        setIsAuthenticating(false);
        throw error;
      });
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
        searchParams.get("error_description") ||
        searchParams.get("error_reason");

      if (error) {
        clearSavedPostLoginRedirect();
        throw new Error(errorDescription || `${label} 로그인에 실패했습니다.`);
      }

      const code = searchParams.get("code");
      const state = searchParams.get("state");
      if (!code || !state) {
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
            await persistRemoteAuthProfile({
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
        persistUserIdentity(mergedUser);

        if (isExistingMember) {
          toast.message(
            "이미 가입한 계정입니다. 기존 회원 정보로 로그인했습니다."
          );
        }

        return takeSavedPostLoginRedirect() || "/";
      } finally {
        setIsAuthenticating(false);
      }
    },
    []
  );

  const completeUserProfile = useCallback(
    async ({
      nickname,
      allowLocationPersonalization,
    }: CompleteUserProfileInput) => {
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
        await persistRemoteAuthProfile({
          nickname: nextNickname,
          consentAcceptedAt,
          allowLocationPersonalization,
        });
      } catch {
        // Keep the local profile even when remote sync is unavailable.
      }

      setUser(nextUser);
      persistUserIdentity(nextUser);
    },
    [user]
  );

  const logout = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/profile", {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!response.ok) {
        toast.error("로그아웃을 완료하지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      setUser(null);
      persistUserIdentity(null);
      clearSavedPostLoginRedirect();
    } catch {
      toast.error("로그아웃을 완료하지 못했습니다. 다시 시도해 주세요.");
    }
  }, []);

  useEffect(() => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    const controller = new AbortController();
    void fetch("/api/auth/profile", {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async response => {
        if (response.status === 401) return null;
        if (!response.ok) throw new Error("Session unavailable");
        const payload = (await response.json()) as { user?: User };
        return payload.user ? mergeUserProfile(payload.user) : null;
      })
      .then(nextUser => {
        if (!controller.signal.aborted) {
          setUser(nextUser);
          persistUserIdentity(nextUser);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setUser(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsAuthenticating(false);
      });
    return () => controller.abort();
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
