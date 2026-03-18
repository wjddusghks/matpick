import { useMemo, useState } from "react";
import { Copy, Facebook, Instagram, Link2, X } from "lucide-react";
import { toast } from "sonner";
import matpickLogo from "@/assets/matpick-logo-final 2.png";

type ShareChannel = "copy" | "x" | "facebook" | "line" | "kakao" | "instagram";

interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  text: string;
  url: string;
  imageUrl?: string;
}

type KakaoWindow = Window & {
  Kakao?: {
    init: (key: string) => void;
    isInitialized: () => boolean;
    Share?: {
      sendDefault: (payload: Record<string, unknown>) => void;
    };
  };
};

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY?.trim() ?? "";
const KAKAO_SHARE_SCRIPT_ID = "matpick-kakao-share-sdk";
const KAKAO_SHARE_SCRIPT_SRC =
  "https://t1.kakaocdn.net/kakao_js_sdk/2.7.9/kakao.min.js";

function ShareIcon({ channel }: { channel: ShareChannel }) {
  switch (channel) {
    case "copy":
      return <Link2 className="h-5 w-5" />;
    case "x":
      return <X className="h-5 w-5" />;
    case "facebook":
      return <Facebook className="h-5 w-5" />;
    case "line":
      return <span className="text-[12px] font-black">LINE</span>;
    case "kakao":
      return <span className="text-[12px] font-black">Talk</span>;
    case "instagram":
      return <Instagram className="h-5 w-5" />;
  }
}

function getButtonStyle(channel: ShareChannel, disabled: boolean) {
  if (disabled) {
    return "border-[#ededed] bg-[#f5f5f5] text-[#b2b2b2]";
  }

  switch (channel) {
    case "copy":
      return "border-[#d8d8d8] bg-white text-[#171717]";
    case "x":
      return "border-[#0f0f10] bg-black text-white";
    case "facebook":
      return "border-[#d7e4ff] bg-[#1877F2] text-white";
    case "line":
      return "border-[#bcefcf] bg-[#06C755] text-white";
    case "kakao":
      return "border-[#fff0a8] bg-[#FEE500] text-[#3c1e1e]";
    case "instagram":
      return "border-[#f3c7dc] bg-[linear-gradient(135deg,#fdf1f6_0%,#fff5db_100%)] text-[#c13584]";
  }
}

function buildShareUrl(
  channel: Exclude<ShareChannel, "copy" | "kakao" | "instagram">,
  text: string,
  url: string
) {
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(url);

  switch (channel) {
    case "x":
      return `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    case "line":
      return `https://social-plugins.line.me/lineit/share?url=${encodedUrl}&text=${encodedText}`;
  }
}

async function ensureKakaoShareSdk() {
  if (typeof window === "undefined" || !KAKAO_JS_KEY) {
    return null;
  }

  const kakaoWindow = window as KakaoWindow;
  if (kakaoWindow.Kakao?.isInitialized()) {
    return kakaoWindow.Kakao;
  }

  if (kakaoWindow.Kakao && !kakaoWindow.Kakao.isInitialized()) {
    kakaoWindow.Kakao.init(KAKAO_JS_KEY);
    return kakaoWindow.Kakao;
  }

  const existingScript = document.getElementById(
    KAKAO_SHARE_SCRIPT_ID
  ) as HTMLScriptElement | null;

  if (!existingScript) {
    const script = document.createElement("script");
    script.id = KAKAO_SHARE_SCRIPT_ID;
    script.src = KAKAO_SHARE_SCRIPT_SRC;
    script.async = true;
    document.head.appendChild(script);
  }

  return new Promise<KakaoWindow["Kakao"] | null>((resolve, reject) => {
    const script =
      existingScript ??
      (document.getElementById(KAKAO_SHARE_SCRIPT_ID) as HTMLScriptElement | null);

    if (!script) {
      reject(new Error("카카오 공유 스크립트를 불러오지 못했어요."));
      return;
    }

    const finish = () => {
      const nextWindow = window as KakaoWindow;
      if (!nextWindow.Kakao) {
        reject(new Error("카카오 공유 SDK를 찾지 못했어요."));
        return;
      }

      if (!nextWindow.Kakao.isInitialized()) {
        nextWindow.Kakao.init(KAKAO_JS_KEY);
      }

      resolve(nextWindow.Kakao);
    };

    script.addEventListener("load", finish, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("카카오 공유 SDK 로딩에 실패했어요.")),
      { once: true }
    );

    if ((window as KakaoWindow).Kakao) {
      finish();
    }
  });
}

export default function ShareSheet({
  open,
  onClose,
  title,
  text,
  url,
  imageUrl,
}: ShareSheetProps) {
  const [isSharingKakao, setIsSharingKakao] = useState(false);
  const trimmedUrl = useMemo(() => url.trim(), [url]);
  const resolvedImageUrl = useMemo(() => {
    const candidate = (imageUrl || matpickLogo).trim();
    if (
      candidate.startsWith("http://") ||
      candidate.startsWith("https://") ||
      candidate.startsWith("data:") ||
      candidate.startsWith("blob:")
    ) {
      return candidate;
    }

    if (typeof window === "undefined") {
      return candidate;
    }

    return `${window.location.origin}${candidate.startsWith("/") ? "" : "/"}${candidate}`;
  }, [imageUrl]);

  const channels: Array<{
    key: ShareChannel;
    label: string;
    disabled?: boolean;
    helper?: string;
  }> = [
    { key: "copy", label: "URL복사" },
    { key: "line", label: "LINE" },
    { key: "x", label: "X" },
    { key: "facebook", label: "페이스북" },
    {
      key: "kakao",
      label: "카카오톡",
      disabled: !KAKAO_JS_KEY || isSharingKakao,
      helper: !KAKAO_JS_KEY ? "카카오 JavaScript 키를 넣으면 바로 쓸 수 있어요." : undefined,
    },
    {
      key: "instagram",
      label: "인스타",
      helper: "웹에서는 링크 복사 방식으로 안내할게요.",
    },
  ];

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,17,17,0.34)] px-4">
      <div className="w-full max-w-[420px] rounded-[30px] bg-white p-6 shadow-[0_28px_90px_rgba(0,0,0,0.16)]">
        <div className="flex items-center justify-between">
          <h2 className="text-[28px] font-black text-[#181818]">공유하기</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#8e8e8e] transition hover:bg-[#f6f6f6]"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-4 sm:grid-cols-6">
          {channels.map((channel) => (
            <button
              key={channel.key}
              type="button"
              disabled={channel.disabled}
              onClick={async () => {
                if (channel.key === "copy" || channel.key === "instagram") {
                  try {
                    await navigator.clipboard.writeText(trimmedUrl);
                    toast.success(
                      channel.key === "instagram"
                        ? "링크를 복사했어요. 인스타그램에서 붙여 넣어 공유해 주세요."
                        : "링크를 복사했어요."
                    );
                  } catch {
                    toast.error("링크 복사에 실패했어요.");
                  }
                  return;
                }

                if (channel.key === "kakao") {
                  if (!KAKAO_JS_KEY) {
                    toast("카카오톡 공유는 JavaScript 키가 필요해요.");
                    return;
                  }

                  try {
                    setIsSharingKakao(true);
                    const kakao = await ensureKakaoShareSdk();
                    kakao?.Share?.sendDefault({
                      objectType: "feed",
                      content: {
                        title,
                        description: text,
                        imageUrl: resolvedImageUrl,
                        link: {
                          mobileWebUrl: trimmedUrl,
                          webUrl: trimmedUrl,
                        },
                      },
                      buttons: [
                        {
                          title: "맛집 보기",
                          link: {
                            mobileWebUrl: trimmedUrl,
                            webUrl: trimmedUrl,
                          },
                        },
                      ],
                    });
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "카카오톡 공유에 실패했어요."
                    );
                  } finally {
                    setIsSharingKakao(false);
                  }
                  return;
                }

                window.open(
                  buildShareUrl(channel.key, text, trimmedUrl),
                  "_blank",
                  "noopener,noreferrer,width=600,height=720"
                );
              }}
              className="group flex min-w-0 flex-col items-center gap-2 text-center"
              title={channel.helper}
            >
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-sm font-bold transition ${
                  getButtonStyle(channel.key, Boolean(channel.disabled))
                }`}
              >
                {channel.key === "copy" ? <Copy className="h-5 w-5" /> : <ShareIcon channel={channel.key} />}
              </span>
              <span
                className={`whitespace-nowrap text-[11px] font-medium tracking-[-0.02em] ${
                  channel.disabled ? "text-[#b2b2b2]" : "text-[#4a4a4a]"
                }`}
              >
                {channel.label}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-[#d9d9d9]">
          <div className="flex items-center">
            <div className="min-w-0 flex-1 bg-[#fafafa] px-4 py-3 text-left text-sm text-[#2c6ff0]">
              <p className="truncate">{trimmedUrl}</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(trimmedUrl);
                  toast.success("링크를 복사했어요.");
                } catch {
                  toast.error("링크 복사에 실패했어요.");
                }
              }}
              className="flex h-[52px] items-center justify-center border-l border-[#d9d9d9] bg-white px-5 text-sm font-semibold text-[#6b6b6b] transition hover:bg-[#f7f7f7]"
            >
              복사
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
