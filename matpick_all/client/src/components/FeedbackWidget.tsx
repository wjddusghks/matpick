import { useEffect, useState } from "react";
import { MessageSquareHeart } from "lucide-react";
import { useLocation } from "wouter";
import { useLocale } from "@/contexts/LocaleContext";
import { submitFeedback, type FeedbackCategory } from "@/lib/feedback";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const COPY = {
  ko: {
    button: "의견 보내기",
    invite: "맛픽을 더 좋게 만들 아이디어가 있나요?",
    title: "맛픽에 의견 보내기",
    desc: "개선 제안이나 불편 사항을 익명으로 남겨 주세요.",
    category: "의견 종류",
    improvement: "개선 제안",
    complaint: "불편 신고",
    other: "기타",
    message: "의견",
    placeholder:
      "어떤 점을 개선하면 좋을지 구체적으로 알려 주세요. (20자 이상)",
    privacy:
      "이메일·이름은 받지 않습니다. 현재 페이지의 경로, 선택한 언어, 작성 내용만 운영 검토를 위해 최대 90일간 보관합니다. 작성 내용에 이름, 연락처 등 개인정보를 넣지 마세요.",
    consent: "위 수집·보관 내용을 확인했으며 전송에 동의합니다.",
    send: "보내기",
    sending: "전송 중…",
    thanks: "소중한 의견을 보내주셔서 감사합니다.",
    close: "닫기",
    error:
      "전송하지 못했습니다. 같은 내용으로 다시 시도하거나 내용을 수정해 새로 보내 주세요.",
  },
  en: {
    button: "Send feedback",
    invite: "Have an idea that could make Matpick better?",
    title: "Send feedback",
    desc: "Share an improvement or report a problem anonymously.",
    category: "Feedback type",
    improvement: "Improvement",
    complaint: "Problem report",
    other: "Other",
    message: "Message",
    placeholder: "Tell us what could be improved. (At least 20 characters)",
    privacy:
      "We do not collect your name or email. We keep only this message, the current page path, and language for operational review for up to 90 days. Do not include names, contact details, or other personal information.",
    consent: "I understand and agree to this collection and retention.",
    send: "Send",
    sending: "Sending…",
    thanks: "Thank you. Your feedback has been received.",
    close: "Close",
    error:
      "We could not send this. Retry unchanged, or edit it to start a new submission.",
  },
};

export default function FeedbackWidget() {
  const { isEnglish } = useLocale();
  const [location] = useLocation();
  const isHiddenRoute =
    location.startsWith("/auth") || location.startsWith("/admin");
  const t = isEnglish ? COPY.en : COPY.ko;
  const [open, setOpen] = useState(false);
  const [invite, setInvite] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("improvement");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("matpick_feedback_invite_seen") === "1";
    } catch {}
    if (seen || isHiddenRoute) return;
    const timer = window.setTimeout(() => {
      setInvite(true);
      try {
        sessionStorage.setItem("matpick_feedback_invite_seen", "1");
      } catch {}
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [isHiddenRoute, location]);
  const show = () => {
    setInvite(false);
    if (status === "sent") setStatus("idle");
    setOpen(true);
  };
  const edit = (change: () => void) => {
    if (status === "error") {
      setRequestId(crypto.randomUUID());
      setStatus("idle");
    }
    change();
  };
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (message.trim().length < 20 || !consent) return;
    setStatus("sending");
    try {
      await submitFeedback({
        requestId,
        category,
        message,
        language: isEnglish ? "en" : "ko",
        consent,
        website,
      });
      setStatus("sent");
      setMessage("");
      setConsent(false);
      setWebsite("");
      setRequestId(crypto.randomUUID());
    } catch {
      setStatus("error");
    }
  }
  if (isHiddenRoute) return null;
  return (
    <>
      {invite ? (
        <aside
          className="fixed bottom-20 right-4 z-40 max-w-[min(21rem,calc(100vw-2rem))] rounded-2xl border border-[#ffd8de] bg-white p-4 shadow-xl"
          aria-label={t.invite}
        >
          <button
            onClick={() => setInvite(false)}
            className="absolute right-2 top-1 p-2 text-[#71666a]"
            aria-label={t.close}
          >
            ×
          </button>
          <p className="pr-6 text-sm font-bold text-[#292327]">{t.invite}</p>
          <button
            onClick={show}
            className="mt-3 rounded-full bg-[#ef6479] px-4 py-2 text-sm font-bold text-white"
          >
            {t.button}
          </button>
        </aside>
      ) : null}
      <button
        onClick={show}
        className="fixed bottom-4 right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#292327] px-4 py-3 text-sm font-bold text-white shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef6479] focus-visible:ring-offset-2"
        aria-label={t.button}
      >
        <MessageSquareHeart className="h-5 w-5" />
        <span className="hidden sm:inline">{t.button}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
            <DialogDescription>{t.desc}</DialogDescription>
          </DialogHeader>
          {status === "sent" ? (
            <div role="status">
              <p className="py-6 text-sm font-semibold">{t.thanks}</p>
              <button
                onClick={() => setOpen(false)}
                className="w-full rounded-lg bg-[#292327] px-4 py-3 font-bold text-white"
              >
                {t.close}
              </button>
            </div>
          ) : (
            <form onSubmit={send} className="space-y-4">
              <label className="block text-sm font-bold">
                {t.category}
                <select
                  value={category}
                  onChange={e =>
                    edit(() => setCategory(e.target.value as FeedbackCategory))
                  }
                  className="mt-2 w-full rounded-lg border border-[#d8ced1] bg-white px-3 py-3 font-normal"
                >
                  <option value="improvement">{t.improvement}</option>
                  <option value="complaint">{t.complaint}</option>
                  <option value="other">{t.other}</option>
                </select>
              </label>
              <label className="block text-sm font-bold">
                {t.message}
                <textarea
                  value={message}
                  onChange={e => edit(() => setMessage(e.target.value))}
                  maxLength={2000}
                  rows={6}
                  className="mt-2 w-full resize-y rounded-lg border border-[#d8ced1] px-3 py-3 font-normal"
                  placeholder={t.placeholder}
                  required
                />
              </label>
              <div
                aria-hidden="true"
                className="absolute -left-[10000px] h-px w-px overflow-hidden"
              >
                <label>
                  Website
                  <input
                    name="website"
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                    autoComplete="off"
                    tabIndex={-1}
                  />
                </label>
              </div>
              <p className="text-xs leading-5 text-[#71666a]">{t.privacy}</p>
              <label className="flex items-start gap-2 text-xs leading-5">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                  required
                />
                <span>{t.consent}</span>
              </label>
              {status === "error" ? (
                <p role="alert" className="text-sm font-semibold text-red-700">
                  {t.error}
                </p>
              ) : null}
              <button
                disabled={
                  status === "sending" || message.trim().length < 20 || !consent
                }
                className="w-full rounded-lg bg-[#ef6479] px-4 py-3 font-bold text-white disabled:opacity-50"
              >
                {status === "sending" ? t.sending : t.send}
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
