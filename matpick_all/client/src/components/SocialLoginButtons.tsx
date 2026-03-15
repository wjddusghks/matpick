import { useAuth } from "@/contexts/AuthContext";

interface SocialLoginButtonsProps {
  redirectTo?: string;
  className?: string;
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3C6.48 3 2 6.38 2 10.5c0 2.65 1.8 4.99 4.49 6.32l-1 3.59a.43.43 0 0 0 .65.47l4.19-2.79c.55.08 1.11.12 1.67.12 5.52 0 10-3.38 10-7.71S17.52 3 12 3Z" />
    </svg>
  );
}

function NaverIcon() {
  return <span className="text-base font-black leading-none">N</span>;
}

export default function SocialLoginButtons({
  redirectTo = "/",
  className = "",
}: SocialLoginButtonsProps) {
  const { loginWithKakao, loginWithNaver, oauthEnabled, isAuthenticating } =
    useAuth();

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <button
        type="button"
        disabled={!oauthEnabled.kakao || isAuthenticating}
        onClick={() => loginWithKakao(redirectTo)}
        className="flex items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-4 py-3 text-sm font-semibold text-[#3C1E1E] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <KakaoIcon />
        {oauthEnabled.kakao ? "카카오 로그인" : "카카오 로그인 준비 중"}
      </button>
      <button
        type="button"
        disabled={!oauthEnabled.naver || isAuthenticating}
        onClick={() => loginWithNaver(redirectTo)}
        className="flex items-center justify-center gap-2 rounded-xl bg-[#03C75A] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <NaverIcon />
        {oauthEnabled.naver ? "네이버 로그인" : "네이버 로그인 준비 중"}
      </button>
    </div>
  );
}
