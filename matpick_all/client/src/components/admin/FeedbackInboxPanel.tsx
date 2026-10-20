import { useEffect, useState } from "react";
import { CheckCircle2, Inbox, LoaderCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  FEEDBACK_API,
  type FeedbackItem,
  type FeedbackStatus,
} from "@/lib/feedback";

const statusLabel: Record<FeedbackStatus, string> = {
  new: "신규",
  reviewing: "검토 중",
  resolved: "처리 완료",
};
const categoryLabel = {
  improvement: "개선 제안",
  complaint: "불편 신고",
  other: "기타",
};

export default function FeedbackInboxPanel() {
  const { user } = useAuth();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`${FEEDBACK_API}&page=${page}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async response => {
        const body = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(body?.items))
          throw new Error(body?.error || "의견함을 불러오지 못했습니다.");
        return body;
      })
      .then(body => {
        setItems(body.items);
        setTotal(Number(body.total) || 0);
      })
      .catch(reason => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "의견함을 불러오지 못했습니다."
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, revision, user]);
  async function update(item: FeedbackItem, status: FeedbackStatus) {
    setSaving(item.id);
    setError("");
    try {
      const response = await fetch(FEEDBACK_API, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: item.requestId, status }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok)
        throw new Error(body?.error || "상태를 저장하지 못했습니다.");
      setItems(current =>
        current.map(value =>
          value.id === item.id ? { ...value, status } : value
        )
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "상태를 저장하지 못했습니다."
      );
    } finally {
      setSaving("");
    }
  }
  return (
    <section
      className="mt-6 rounded-[8px] border border-[#eadfe2] bg-white px-5 py-5 shadow-[0_12px_32px_rgba(27,20,22,0.05)]"
      aria-labelledby="feedback-inbox-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="feedback-inbox-title"
            className="flex items-center gap-2 text-lg font-black"
          >
            <Inbox className="h-5 w-5 text-[#ef6479]" />
            사용자 의견함
          </h2>
          <p className="mt-2 text-sm text-[#6d6265]">
            익명 개선 제안과 불편 신고입니다. 항목은 최대 90일 보관됩니다.
          </p>
        </div>
        <button
          onClick={() => setRevision(v => v + 1)}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold"
        >
          <RefreshCw className="h-4 w-4" />
          새로고침
        </button>
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800"
        >
          {error}
        </p>
      ) : null}
      {loading ? (
        <p role="status" className="mt-5 flex items-center gap-2 text-sm">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          불러오는 중
        </p>
      ) : items.length === 0 ? (
        <p className="mt-5 text-sm text-[#6d6265]">접수된 의견이 없습니다.</p>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map(item => (
            <article
              key={item.id}
              className="rounded-xl border border-[#eadfe2] p-4"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="rounded-full bg-[#fff0f3] px-2 py-1 text-[#b83f53]">
                  {categoryLabel[item.category]}
                </span>
                <span>{statusLabel[item.status]}</span>
                <span className="text-[#75696d]">
                  {item.language.toUpperCase()} ·{" "}
                  {new Date(item.createdAt).toLocaleString("ko-KR")}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#292327]">
                {item.message}
              </p>
              <p className="mt-2 break-all text-xs text-[#75696d]">
                페이지: {item.pagePath}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(["new", "reviewing", "resolved"] as const).map(status => (
                  <button
                    key={status}
                    disabled={saving === item.id || status === item.status}
                    onClick={() => update(item, status)}
                    className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-45"
                  >
                    {status === "resolved" ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : null}
                    {statusLabel[status]}
                  </button>
                ))}
              </div>
            </article>
          ))}
          <div className="flex items-center justify-between pt-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(value => Math.max(0, value - 1))}
              className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40"
            >
              이전
            </button>
            <span className="text-xs font-semibold text-[#75696d]">
              {page + 1} / {Math.max(1, Math.ceil(total / 50))} 페이지 · 총{" "}
              {total}건
            </span>
            <button
              disabled={(page + 1) * 50 >= total}
              onClick={() => setPage(value => value + 1)}
              className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
