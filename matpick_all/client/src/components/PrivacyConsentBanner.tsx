import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import {
  PRIVACY_SETTINGS_OPEN_EVENT,
  readPrivacyPreferences,
  savePrivacyPreferences,
} from "@/lib/privacyConsent";

export default function PrivacyConsentBanner() {
  const { isEnglish } = useLocale();
  const [isOpen, setIsOpen] = useState(() => readPrivacyPreferences() === null);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(
    () => readPrivacyPreferences()?.analytics ?? false
  );
  const [advertising, setAdvertising] = useState(
    () => readPrivacyPreferences()?.advertising ?? false
  );

  useEffect(() => {
    const openSettings = () => {
      const stored = readPrivacyPreferences();
      setAnalytics(stored?.analytics ?? false);
      setAdvertising(stored?.advertising ?? false);
      setShowDetails(true);
      setIsOpen(true);
    };

    window.addEventListener(PRIVACY_SETTINGS_OPEN_EVENT, openSettings);
    return () => window.removeEventListener(PRIVACY_SETTINGS_OPEN_EVENT, openSettings);
  }, []);

  if (!isOpen) {
    return null;
  }

  const copy = isEnglish
    ? {
        title: "Privacy and cookie choices",
        body: "Analytics and personalized advertising run only after permission. Kakao AdFit and Coupang Partners placements may appear by default.",
        details: "Customize",
        essential: "Decline optional tools",
        accept: "Allow all",
        save: "Save choices",
        analytics: "Analytics",
        analyticsBody: "Helps us understand page usage and improve the service.",
        advertising: "Personalized ads",
        advertisingBody: "Allows Google and Meta advertising personalization and related measurement. Kakao AdFit and Coupang Partners placements may appear without this choice.",
        privacy: "Privacy policy",
        close: "Close privacy settings",
      }
    : {
        title: "개인정보 및 쿠키 설정",
        body: "분석 및 맞춤형 광고 도구는 허용한 경우에만 실행됩니다. 카카오 애드핏과 쿠팡 제휴 광고는 기본 광고 지면에 표시될 수 있습니다.",
        details: "상세 설정",
        essential: "선택형 도구 거부",
        accept: "모두 허용",
        save: "선택 저장",
        analytics: "서비스 분석",
        analyticsBody: "페이지 이용 현황을 파악하고 서비스를 개선하는 데 사용합니다.",
        advertising: "맞춤형 광고",
        advertisingBody: "Google·Meta의 광고 개인화와 관련 측정을 허용합니다. 카카오 애드핏과 쿠팡 제휴 광고는 이 선택과 관계없이 기본 광고 지면에 표시될 수 있습니다.",
        privacy: "개인정보처리방침",
        close: "개인정보 설정 닫기",
      };

  const save = (values: { analytics: boolean; advertising: boolean }) => {
    savePrivacyPreferences(values);
    setIsOpen(false);
    setShowDetails(false);
  };

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="privacy-consent-title"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-[8px] border border-[#ead9dc] bg-white p-5 shadow-[0_20px_70px_rgba(33,16,20,0.2)] sm:bottom-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff0f2] text-[#f45f70]">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="privacy-consent-title" className="text-base font-black text-[#20191a]">
                {copy.title}
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#6d6264]">{copy.body}</p>
            </div>
            {readPrivacyPreferences() ? (
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#786e70] hover:bg-[#f8f2f3]"
                aria-label={copy.close}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {showDetails ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer gap-3 rounded-[8px] border border-[#eee3e5] p-3">
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(event) => setAnalytics(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-[#f45f70]"
                />
                <span>
                  <strong className="block text-sm text-[#2c2325]">{copy.analytics}</strong>
                  <span className="mt-1 block text-xs leading-5 text-[#756b6d]">
                    {copy.analyticsBody}
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer gap-3 rounded-[8px] border border-[#eee3e5] p-3">
                <input
                  type="checkbox"
                  checked={advertising}
                  onChange={(event) => setAdvertising(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-[#f45f70]"
                />
                <span>
                  <strong className="block text-sm text-[#2c2325]">{copy.advertising}</strong>
                  <span className="mt-1 block text-xs leading-5 text-[#756b6d]">
                    {copy.advertisingBody}
                  </span>
                </span>
              </label>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {showDetails ? (
              <button
                type="button"
                onClick={() => save({ analytics, advertising })}
                className="h-10 rounded-[8px] bg-[#f45f70] px-4 text-sm font-bold text-white hover:bg-[#df4f60]"
              >
                {copy.save}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => save({ analytics: true, advertising: true })}
                  className="h-10 rounded-[8px] bg-[#f45f70] px-4 text-sm font-bold text-white hover:bg-[#df4f60]"
                >
                  {copy.accept}
                </button>
                <button
                  type="button"
                  onClick={() => save({ analytics: false, advertising: false })}
                  className="h-10 rounded-[8px] border border-[#e5d7da] bg-white px-4 text-sm font-bold text-[#4d4244] hover:bg-[#faf6f7]"
                >
                  {copy.essential}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDetails(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-[8px] px-3 text-sm font-bold text-[#6e6264] hover:bg-[#faf6f7]"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  {copy.details}
                </button>
              </>
            )}
            <Link href="/privacy" className="ml-auto text-xs font-bold text-[#e75b6c] underline">
              {copy.privacy}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
