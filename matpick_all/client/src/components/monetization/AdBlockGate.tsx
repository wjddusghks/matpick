import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { ShieldCheck, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocale } from "@/contexts/LocaleContext";
import { detectAdBlock, isAdGateExempt } from "@/lib/adBlockDetection";

export default function AdBlockGate({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const { isEnglish } = useLocale();
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkedAgain, setCheckedAgain] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const checkRef = useRef<() => void>(() => {});
  const exempt = isAdGateExempt(path);

  useEffect(() => {
    let active = true;
    let busy = false;
    setBlocked(false);
    setCheckedAgain(false);
    const check = async (manual = false) => {
      if (busy || exempt || document.visibilityState !== "visible") return;
      busy = true;
      setChecking(true);
      const result = await detectAdBlock();
      if (active) {
        // Unknown is fail-open; do not trap visitors during an outage.
        setBlocked(result === "blocked");
        setChecking(false);
        if (manual) setCheckedAgain(true);
      }
      busy = false;
    };
    checkRef.current = () => {
      void check(true);
    };
    const onFocus = () => {
      void check();
    };
    const timer = window.setTimeout(onFocus, 700);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [exempt]);

  const gated = blocked && !exempt;
  return (
    <>
      <div hidden={gated} inert={gated} aria-hidden={gated || undefined}>
        {children}
      </div>
      <Dialog open={gated}>
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={e => e.preventDefault()}
          onPointerDownOutside={e => e.preventDefault()}
          className="max-h-[90dvh] overflow-y-auto rounded-3xl border-rose-100 p-7 sm:p-9"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
            <ShieldCheck aria-hidden="true" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-xl leading-snug">
              {isEnglish
                ? "Please allow ads on Matpick"
                : "맛픽에서 광고 차단을 해제해 주세요"}
            </DialogTitle>
            <DialogDescription className="pt-2 leading-relaxed">
              {isEnglish
                ? "Ads help us maintain this restaurant guide. Pause your ad blocker for matpick.co.kr, then check again to view the content. No ad clicks are required."
                : "맛픽은 광고 수익으로 식당 정보를 정리하고 서비스를 운영합니다. matpick.co.kr의 광고 차단을 해제한 뒤 다시 확인하면 콘텐츠를 볼 수 있어요. 광고를 클릭할 필요는 없습니다."}
            </DialogDescription>
          </DialogHeader>
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            aria-expanded={showHelp}
            className="rounded-xl border border-rose-100 px-4 py-3 text-sm font-semibold"
          >
            {isEnglish
              ? "How to turn off ad blocking"
              : "광고 차단 해제 방법 보기"}
          </button>
          {showHelp && (
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
              <li>
                {isEnglish
                  ? "Open your browser’s Extensions menu (often a puzzle icon), or its content-blocker settings on mobile."
                  : "브라우저의 확장 프로그램(퍼즐 아이콘) 또는 모바일 콘텐츠 차단 설정을 여세요."}
              </li>
              <li>
                {isEnglish
                  ? "In AdBlock, uBlock Origin, AdGuard or your browser’s shield, allow ads on matpick.co.kr."
                  : "AdBlock·uBlock Origin·AdGuard 또는 브라우저 보호 설정에서 matpick.co.kr을 허용하세요."}
              </li>
              <li>
                {isEnglish
                  ? "Return here and select Check again. If prompted by your extension, reload the page."
                  : "이 화면으로 돌아와 다시 확인을 누르세요. 확장 프로그램에서 새로고침을 요구하면 페이지를 새로고침하세요."}
              </li>
            </ol>
          )}
          <button
            type="button"
            disabled={checking}
            onClick={() => checkRef.current()}
            className="flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-3 font-bold text-white hover:bg-rose-600 disabled:opacity-60"
          >
            <RefreshCw
              className={checking ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              aria-hidden="true"
            />
            {checking
              ? isEnglish
                ? "Checking…"
                : "확인 중…"
              : isEnglish
                ? "I’ve allowed ads — check again"
                : "해제 후 다시 확인"}
          </button>
          <p role="status" className="text-xs leading-relaxed text-slate-500">
            {checkedAgain
              ? isEnglish
                ? "Ad blocking still appears active. Check the settings above or contact us if this is a mistake."
                : "광고 차단이 아직 감지됩니다. 위 설정을 확인하거나, 잘못 감지된 경우 문의해 주세요."
              : isEnglish
                ? "Matpick cannot change your browser extension settings for you."
                : "사이트에서 브라우저 확장 프로그램을 직접 끌 수는 없어요."}
          </p>
          <div className="flex gap-4 text-xs text-slate-500 underline">
            <a href="/contact">{isEnglish ? "Contact us" : "문의하기"}</a>
            <a href="/privacy">{isEnglish ? "Privacy" : "개인정보처리방침"}</a>
            <a href="/terms">{isEnglish ? "Terms" : "이용약관"}</a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
