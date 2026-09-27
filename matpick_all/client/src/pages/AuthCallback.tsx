import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { getOAuthProviderLabel, isOAuthProvider } from "@/lib/oauth";
import { useLocale } from "@/contexts/LocaleContext";

export default function AuthCallback({ provider }: { provider: string }) {
  const [, navigate] = useLocation();
  const { finishOAuthLogin } = useAuth();
  const { isEnglish } = useLocale();
  const [message, setMessage] = useState(() =>
    isEnglish ? "Checking your sign-in…" : "로그인 정보를 확인하고 있습니다."
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      if (!isOAuthProvider(provider)) {
        setError(isEnglish ? "This sign-in provider is not supported." : "지원하지 않는 로그인 경로입니다.");
        return;
      }

      try {
        setMessage(isEnglish ? `Loading your ${getOAuthProviderLabel(provider)} sign-in…` : `${getOAuthProviderLabel(provider)} 로그인 정보를 불러오는 중입니다.`);
        const redirectTo = await finishOAuthLogin(
          provider,
          new URLSearchParams(window.location.search)
        );

        if (!cancelled) {
          setMessage(isEnglish ? "You’re signed in. Redirecting…" : "로그인이 완료되었습니다. 잠시 후 이동합니다.");
          window.location.replace(redirectTo);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : isEnglish ? "There was a problem signing you in." : "로그인 처리 중 문제가 발생했습니다."
          );
        }
      }
    }

    handleCallback();

    return () => {
      cancelled = true;
    };
  }, [finishOAuthLogin, isEnglish, navigate, provider]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fffaf9] px-4">
      <div className="w-full max-w-md rounded-[28px] border border-[#ffd7d7] bg-white px-8 py-10 text-center shadow-[0_24px_80px_rgba(255,105,135,0.14)]">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff6a6a_0%,#ff00d4_100%)] text-2xl font-black text-white">
          {isEnglish ? "M" : "맛"}
        </div>
        <h1 className="mb-3 text-2xl font-black text-[#151515]">{isEnglish ? "Matpick sign-in" : "맛픽 로그인"}</h1>
        {error ? (
          <>
            <p className="text-sm leading-6 text-[#666]">{error}</p>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mt-6 rounded-full bg-[#ff6a6a] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-95"
            >
              {isEnglish ? "Return home" : "홈으로 돌아가기"}
            </button>
          </>
        ) : (
          <p className="text-sm leading-6 text-[#666]">{message}</p>
        )}
      </div>
    </div>
  );
}
