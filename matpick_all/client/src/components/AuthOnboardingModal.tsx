import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getDisplayName,
  hasCompletedProfile,
  sanitizeNickname,
} from "@/lib/authProfile";

export default function AuthOnboardingModal() {
  const { user, isLoggedIn, completeUserProfile } = useAuth();
  const [nickname, setNickname] = useState("");
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedIdentity, setAcceptedIdentity] = useState(false);
  const [allowLocationPersonalization, setAllowLocationPersonalization] = useState(
    false
  );
  const [error, setError] = useState<string | null>(null);

  const shouldOpen = isLoggedIn && user != null && !hasCompletedProfile(user);

  useEffect(() => {
    if (!shouldOpen || !user) {
      return;
    }

    setNickname(user.nickname ?? "");
    setAcceptedPrivacy(Boolean(user.consentAcceptedAt));
    setAcceptedIdentity(Boolean(user.consentAcceptedAt));
    setAllowLocationPersonalization(
      Boolean(user.allowLocationPersonalization)
    );
    setError(null);
  }, [
    shouldOpen,
    user?.allowLocationPersonalization,
    user?.consentAcceptedAt,
    user?.id,
    user?.nickname,
  ]);

  const normalizedNickname = useMemo(() => sanitizeNickname(nickname), [nickname]);

  if (!shouldOpen || !user) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,17,17,0.38)] px-4">
      <div className="w-full max-w-[480px] rounded-[30px] border border-[#ffd7dd] bg-white p-7 shadow-[0_28px_90px_rgba(0,0,0,0.16)]">
        <p className="text-sm font-semibold text-[#ff7b83]">첫 로그인 설정</p>
        <h2 className="mt-2 text-[26px] font-black leading-tight text-[#171717]">
          닉네임과 동의 정보를
          <br />
          한 번만 설정해 주세요
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#737373]">
          {getDisplayName(user)} 계정으로 로그인되었습니다. 서비스 안에서 보여줄 닉네임을
          정하고, 기본 동의 항목을 확인해 주세요.
        </p>

        <div className="mt-6">
          <label className="text-sm font-semibold text-[#222222]">닉네임</label>
          <input
            type="text"
            value={nickname}
            onChange={(event) => {
              setNickname(sanitizeNickname(event.target.value));
              setError(null);
            }}
            placeholder="최대 6자"
            maxLength={6}
            className="mt-2 h-12 w-full rounded-2xl border border-[#ffd5db] px-4 text-sm font-medium text-[#171717] outline-none transition focus:border-[#ff7b83] focus:shadow-[0_0_0_3px_rgba(255,123,131,0.12)]"
          />
          <p className="mt-2 text-xs text-[#9a9a9a]">{normalizedNickname.length}/6자</p>
        </div>

        <div className="mt-6 space-y-3 rounded-[24px] bg-[#fff7f8] p-5">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-[#333333]">
            <input
              type="checkbox"
              checked={acceptedPrivacy}
              onChange={(event) => {
                setAcceptedPrivacy(event.target.checked);
                setError(null);
              }}
              className="mt-1 h-4 w-4 rounded border-[#ffb8c1] text-[#ff7b83] focus:ring-[#ffb8c1]"
            />
            <span>[필수] 서비스 이용 안내와 개인정보 처리 안내를 확인했습니다.</span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 text-sm text-[#333333]">
            <input
              type="checkbox"
              checked={acceptedIdentity}
              onChange={(event) => {
                setAcceptedIdentity(event.target.checked);
                setError(null);
              }}
              className="mt-1 h-4 w-4 rounded border-[#ffb8c1] text-[#ff7b83] focus:ring-[#ffb8c1]"
            />
            <span>[필수] 소셜 로그인 식별값을 회원 식별과 계정 유지에 사용하는 데 동의합니다.</span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 text-sm text-[#333333]">
            <input
              type="checkbox"
              checked={allowLocationPersonalization}
              onChange={(event) => setAllowLocationPersonalization(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-[#ffb8c1] text-[#ff7b83] focus:ring-[#ffb8c1]"
            />
            <span>[선택] 위치 기반 추천과 가까운 맛집 정렬에 활용하는 데 동의합니다.</span>
          </label>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl bg-[#fff1f3] px-4 py-3 text-sm text-[#8b4d59]">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={async () => {
            if (!normalizedNickname) {
              setError("닉네임을 입력해 주세요.");
              return;
            }

            if (!acceptedPrivacy || !acceptedIdentity) {
              setError("필수 동의 항목을 먼저 확인해 주세요.");
              return;
            }

            try {
              await completeUserProfile({
                nickname: normalizedNickname,
                allowLocationPersonalization,
              });
            } catch (profileError) {
              setError(
                profileError instanceof Error
                  ? profileError.message
                  : "프로필 설정 중 문제가 발생했습니다."
              );
            }
          }}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-[#ff7b83] text-sm font-semibold text-white transition hover:brightness-95"
        >
          시작하기
        </button>
      </div>
    </div>
  );
}
