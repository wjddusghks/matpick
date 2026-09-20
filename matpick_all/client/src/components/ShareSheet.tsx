import { useEffect, useRef, useState } from "react";
import { Copy, Facebook, Instagram, Share2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { copyShareLink, shareNatively } from "@/lib/share";
import { buildAbsoluteUrl } from "@/lib/seo";
import { useLocale } from "@/contexts/LocaleContext";

interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  text: string;
  url: string;
  imageUrl?: string;
}
type KakaoSdk = {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Share?: { sendDefault: (payload: Record<string, unknown>) => void };
};
const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY?.trim() ?? "";
let kakaoLoading: Promise<KakaoSdk> | null = null;
function ensureKakaoShareSdk(): Promise<KakaoSdk> {
  const readSdk = () => (window as Window & { Kakao?: KakaoSdk }).Kakao;
  const initialize = (sdk: KakaoSdk) => {
    if (!sdk.isInitialized()) sdk.init(KAKAO_JS_KEY);
    if (!sdk.Share) throw new Error("Share unavailable");
    return sdk;
  };
  const existing = readSdk();
  if (existing) return Promise.resolve().then(() => initialize(existing));
  if (kakaoLoading) return kakaoLoading;
  kakaoLoading = new Promise<KakaoSdk>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.9/kakao.min.js";
    script.async = true;
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      reject(new Error("Share unavailable"));
    };
    const timer = window.setTimeout(fail, 8000);
    script.onerror = fail;
    script.onload = () => {
      clearTimeout(timer);
      try {
        const sdk = readSdk();
        if (!sdk) throw new Error("No SDK");
        resolve(initialize(sdk));
      } catch {
        fail();
      }
    };
    document.head.appendChild(script);
  }).catch(error => {
    kakaoLoading = null;
    throw error;
  });
  return kakaoLoading;
}

export default function ShareSheet({
  open,
  onClose,
  title,
  text,
  url,
  imageUrl,
}: ShareSheetProps) {
  const { locale } = useLocale();
  const english = locale === "en";
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const shareUrl = buildAbsoluteUrl(url.trim());
  useEffect(() => {
    if (!open) return;
    setStatus("");
    if (KAKAO_JS_KEY) void ensureKakaoShareSdk().catch(() => {});
  }, [open, url]);
  const copy = async (instagram = false) => {
    const success = await copyShareLink(shareUrl);
    const message = success
      ? english
        ? "Link copied"
        : instagram
          ? "링크를 복사했어요. 인스타그램에 붙여 넣어 주세요."
          : "링크를 복사했어요."
      : english
        ? "Select the link below and copy it manually."
        : "아래 링크를 선택했어요. 길게 누르거나 Ctrl+C로 복사해 주세요.";
    setStatus(message);
    if (success) toast.success(message);
    else {
      input.current?.focus();
      input.current?.select();
    }
  };
  const nativeShare = async () => {
    const result = await shareNatively({ title, text, url: shareUrl });
    if (result === "unavailable")
      setStatus(
        english
          ? "Use Copy link or choose a service below."
          : "이 브라우저에서는 아래 링크 복사나 공유 서비스를 이용해 주세요."
      );
  };
  const kakaoShare = async () => {
    setBusy(true);
    try {
      const sdk = await ensureKakaoShareSdk();
      const candidate =
        imageUrl && !/^(data:|blob:)/.test(imageUrl)
          ? imageUrl
          : "/og-default.png";
      sdk.Share!.sendDefault({
        objectType: "feed",
        content: {
          title,
          description: text,
          imageUrl: buildAbsoluteUrl(candidate),
          link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
        },
        buttons: [
          {
            title: "맛집 보기",
            link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
          },
        ],
      });
    } catch {
      setStatus(
        english
          ? "KakaoTalk could not open. Use Copy link."
          : "카카오톡을 열지 못했어요. 링크 복사로 공유해 주세요."
      );
    } finally {
      setBusy(false);
    }
  };
  const links = [
    {
      name: "LINE",
      url: `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`,
      icon: <span className="text-xs font-black">LINE</span>,
      color: "bg-[#e9f9ee] text-[#168444]",
    },
    {
      name: "X",
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
      icon: <X className="h-5 w-5" />,
      color: "bg-[#f2f2f2] text-[#222]",
    },
    {
      name: english ? "Facebook" : "페이스북",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      icon: <Facebook className="h-5 w-5" />,
      color: "bg-[#edf3ff] text-[#2165d5]",
    },
  ];
  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] w-[calc(100%-32px)] max-w-[420px] overflow-y-auto rounded-3xl border-[#f0dfe4] bg-white p-5 sm:max-w-[420px] sm:p-6">
        <DialogTitle className="pr-6 text-xl font-bold text-[#292127]">
          {english ? "Share this place" : "같이 갈 사람에게 공유"}
        </DialogTitle>
        <DialogDescription className="text-sm text-[#85717a]">
          {title}
        </DialogDescription>
        <button
          type="button"
          onClick={() => void copy()}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ef6479] text-sm font-bold text-white hover:bg-[#df5269]"
        >
          <Copy className="h-4 w-4" />
          {english ? "Copy restaurant link" : "식당 링크 복사"}
        </button>
        {typeof navigator !== "undefined" &&
          typeof navigator.share === "function" && (
            <button
              type="button"
              onClick={() => void nativeShare()}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#eadde2] text-sm text-[#67535d]"
            >
              <Share2 className="h-4 w-4" />
              {english ? "More sharing options" : "기기 공유 메뉴 열기"}
            </button>
          )}
        <div className="grid grid-cols-3 gap-3">
          {links.map(link => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-16 flex-col items-center justify-center gap-1.5 text-[11px] text-[#67535d]"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${link.color}`}
              >
                {link.icon}
              </span>
              {link.name}
            </a>
          ))}
          {KAKAO_JS_KEY && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void kakaoShare()}
              className="flex min-h-16 flex-col items-center justify-center gap-1.5 text-[11px] text-[#67535d] disabled:opacity-50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fee500] text-xs font-black text-[#392223]">
                Talk
              </span>
              {english ? "KakaoTalk" : "카카오톡"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void copy(true)}
            className="flex min-h-16 flex-col items-center justify-center gap-1.5 text-[11px] text-[#67535d]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0f6] text-[#c33b76]">
              <Instagram className="h-5 w-5" />
            </span>
            {english ? "Instagram · copy" : "인스타 · 링크 복사"}
          </button>
        </div>
        <input
          ref={input}
          readOnly
          value={shareUrl}
          onFocus={event => event.currentTarget.select()}
          aria-label={english ? "Restaurant share link" : "공유할 식당 링크"}
          className="min-h-11 min-w-0 w-full rounded-xl border border-[#e8dce1] bg-[#fdfafa] px-3 text-xs text-[#67535d]"
        />
        <p role="status" className="min-h-5 text-xs leading-5 text-[#956173]">
          {status ||
            (english
              ? "Send the link in your usual messenger."
              : "평소 쓰는 메신저에 링크를 붙여 넣어 주세요.")}
        </p>
      </DialogContent>
    </Dialog>
  );
}
